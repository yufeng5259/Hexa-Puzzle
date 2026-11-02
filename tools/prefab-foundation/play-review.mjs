import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PROJECT, WORKSPACE, PROTOTYPE } from './io.mjs';

const source = path.join(WORKSPACE, 'tmp/prototype/single-level-play/native');
const sizes = [[390, 844], [375, 667], [360, 640], [320, 568]];
const pieceCounts = [3, 4, 6, 7];
const references = [
  ['普通关原稿 · 三块', 'T02-01_普通异形拼图_三块.png'],
  ['限步关原稿', 'T05-01_限步异形拼图_局内.png'],
  ['普通关原稿 · 六块托盘', 'T02-02_普通异形拼图_六块托盘.png'],
  ['限步关原稿 · 七块托盘', 'T05-02_限步拼图_七块托盘规格.png']
];
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function imageFile(file) {
  assert(typeof file === 'string' && path.basename(file) === file && /^[a-z0-9][a-z0-9_.-]*\.png$/i.test(file), 'Unsafe gameplay screenshot path');
  const location = path.join(source, file);
  assert(fs.existsSync(location), 'Missing native gameplay image: ' + file);
  assert(fs.readFileSync(location).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Not a PNG: ' + file);
}

function assertFreshEvidence(report) {
  assert.equal(report.status, 'PASS', 'Native gameplay must pass before publication');
  assert.deepEqual(report.errors, [], 'Native gameplay errors remain');
  assert.deepEqual(report.failedResources, [], 'Native gameplay resource failures remain');
  assert(Array.isArray(report.warnings), 'Missing native diagnostics');
  assert.equal(report.httpStatus, 200, 'Native preview did not return HTTP 200');
  assert.equal(report.resources?.activeScopes, 2, 'Only the map and catalog scopes may remain');
  assert.equal(report.resources.createdScopes - report.resources.releasedScopes, 2, 'Scope ownership counts disagree');
  assert.deepEqual(report.resources.localStorageWrites, [], 'Gameplay must not write player storage');
  assert.deepEqual(report.resources.ownership, ['current-map', 'boot-level-catalog']);
  assert(Number.isFinite(Date.parse(report.finishedAt)), 'Missing native completion time');
  assert(Number.isFinite(Date.parse(report.createdAt)) && Date.parse(report.createdAt) <= Date.parse(report.finishedAt), 'Invalid native verification interval');
  assert(Array.isArray(report.checks), 'Missing native operation evidence');
  const check = kind => {
    const matches = report.checks.filter(value => value.kind === kind);
    assert.equal(matches.length, 1, 'Missing or duplicate native check: ' + kind);
    assert.equal(matches[0].passed, true, 'Native check did not pass: ' + kind);
    return matches[0];
  };
  const multitouch = check('multitouch-lifecycle-cancel');
  assert.equal(multitouch.pointerSource, 'chrome-cdp');
  assert.equal(multitouch.cancellationSource, 'pause-lifecycle');
  assert.equal(multitouch.draggingCleared, true);
  assert.equal(multitouch.unchanged, true);
  const syntheticCancel = check('synthetic-dom-touchcancel');
  assert.equal(syntheticCancel.pointerSource, 'chrome-cdp');
  assert.equal(syntheticCancel.cancellationSource, 'synthetic-dom-event-through-creator-input');
  assert.equal(syntheticCancel.isTrusted, false, 'Synthetic DOM cancellation must not be represented as hardware input');
  assert.equal(syntheticCancel.cancelable, true);
  assert.equal(syntheticCancel.defaultPrevented, true);
  assert.equal(syntheticCancel.unchanged, true);
  assert.equal(check('post-cancel-single-pointer').pointerSource, 'playwright-mouse');
  for (const kind of ['restart-cancel', 'overlay-drag-cancel', 'resize-drag-cancel']) check(kind);
  for (const route of ['pause', 'help-detail', 'settings', 'mainline-map']) {
    assert(report.checks.some(value => value.kind === 'lifecycle-preservation' && value.route === route && value.passed === true),
      'Missing actual attempt preservation: ' + route);
  }
  const limitation = report.limitations?.find(value => value.kind === 'creator-noncancelable-touchcancel');
  assert(limitation && typeof limitation.detail === 'string' && limitation.detail.length > 0, 'The known Creator touchcancel limitation must remain visible');
  assert.equal(limitation.previousFailure, 'earlier-noncancelable-touchcancel-failure.json');
  const previous = json(path.join(source, limitation.previousFailure));
  assert.equal(previous.status, 'FAIL', 'Earlier touchcancel failure must not be rewritten as passing');
  assert(previous.errors?.some(error => error.includes('Ignored attempt to cancel a touchcancel event')), 'Missing retained noncancelable touchcancel diagnostic');
  assert(report.checks.some(check => check.kind === 'button-pointer' && check.field === 'returnPieceButton'), 'Missing real return button operation');
  assert(report.checks.some(check => check.kind === 'button-pointer' && check.action === 'confirm:restart'), 'Missing real restart confirmation');
  assert(report.checks.some(check => check.kind === 'button-pointer' && check.action === 'play:retry'), 'Missing real free retry operation');
  const drags = report.checks.filter(check => check.kind === 'real-drag');
  assert(drags.filter(check => !check.unchanged && !check.outside && check.afterMoves === check.beforeMoves + 1).length >= 80,
    'Missing four-size source solutions through actual pointer placements');
  assert(drags.some(check => check.unchanged === true && check.afterMoves === check.beforeMoves), 'Missing illegal/no-op pointer operation');
  assert(drags.some(check => check.outside === true && !check.unchanged && check.afterMoves === check.beforeMoves + 1), 'Missing outside-board return operation');

  const levels = json(path.join(PROJECT, 'assets/bundles/puzzle/config/level-catalog.json')).levels;
  assert(Array.isArray(report.screenshots), 'Missing gameplay screenshots');
  const solutions = report.screenshots.filter(shot => shot.outcomeFile !== undefined);
  assert.equal(solutions.length, 16, 'Exactly sixteen four-size playable cases are required');
  const files = new Set();
  for (const [width, height] of sizes) for (const count of pieceCounts) {
    const matches = solutions.filter(shot => shot.width === width && shot.height === height && shot.pieceCount === count);
    assert.equal(matches.length, 1, `Missing/duplicate ${width}x${height}/${count}-piece play case`);
    const shot = matches[0], level = levels.find(level => level.id === shot.id);
    assert(level && level.pieces.length === count, 'Screenshot question identity differs from the formal catalog');
    assert.equal(shot.stage, 'before-final-placement');
    assert.equal(shot.outcomeStage, 'completed-result');
    assert.equal(shot.pointerCompleted, true, 'A static screenshot does not prove gameplay');
    assert.equal(shot.playing?.status, 'active', 'The playing screenshot must precede completion');
    assert.equal(shot.playing.moves, count - 1);
    assert.equal(Object.keys(shot.playing.placements).length, count - 1);
    assert.equal(shot.final?.status, 'completed', 'Result screenshot requires a rule-driven completion');
    assert.equal(shot.final.moves, count);
    assert.equal(Object.keys(shot.final.placements).length, count);
    for (const snapshot of [shot.playing, shot.final]) {
      assert.equal(snapshot.levelId, shot.id);
      assert.equal(snapshot.attemptId, shot.attemptId, 'Screenshots must show the same active attempt');
    }
    for (const file of [shot.file, shot.outcomeFile]) {
      imageFile(file); assert(!files.has(file), 'Duplicate gameplay image: ' + file); files.add(file);
    }
  }
  const failures = report.screenshots.filter(shot => shot.final?.status === 'failed');
  assert.equal(failures.length, 1, 'Missing native challenge failure image');
  assert.equal(report.screenshots.length, 17, 'Unexpected gameplay screenshot records');
  assert.equal(failures[0].stage, 'failed-result');
  imageFile(failures[0].file);
  assert(!files.has(failures[0].file), 'Challenge failure image aliases another screenshot');
  files.add(failures[0].file);
  for (const file of files) assert(fs.statSync(path.join(source, file)).mtimeMs >= Date.parse(report.createdAt) - 1000,
    'Gameplay image predates this verification run: ' + file);

  for (const [name, expected] of [['lastMove', 'completed'], ['exhaustion', 'failed']]) {
    const snapshot = report[name], level = levels.find(level => level.id === snapshot?.levelId);
    assert(level?.mode === 'challenge' && level.mainlineNumber !== null, 'Challenge evidence must use a formal mainline question');
    assert.equal(snapshot.status, expected);
    assert.equal(snapshot.moves, level.moveLimit, 'Challenge terminal state must occur on the actual final allowed move');
  }
  assert.equal(failures[0].final.attemptId, report.exhaustion.attemptId);
  assert.equal(report.retry?.status, 'active');
  assert.equal(report.retry.levelId, report.exhaustion.levelId);
  assert.equal(report.retry.moves, 0);
  assert.deepEqual(report.retry.placements, {});
  assert.notEqual(report.retry.attemptId, report.exhaustion.attemptId, 'Retry must create a new attempt');
  for (const [, file] of references) assert(fs.existsSync(path.join(PROTOTYPE, 'assets/block-reference', file)), 'Missing original source reference: ' + file);

  const latest = fs.statSync(path.join(source, 'report.json')).mtimeMs;
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(ts|prefab|scene|json|meta)$/.test(file)) assert(fs.statSync(file).mtimeMs <= latest, 'Native gameplay evidence is stale: ' + file);
    }
  };
  walk(path.join(PROJECT, 'assets'));
}

/** Read-only publication gate; a failed or stale run never becomes an official gallery. */
export function readPlayEvidence() {
  const report = json(path.join(source, 'report.json'));
  assertFreshEvidence(report);
  return report;
}

/** Same destination contract as level-review: destination is the Prefab foundation gallery root. */
export function publishPlayEvidence(destination, report) {
  assertFreshEvidence(report);
  assert.deepEqual(report, json(path.join(source, 'report.json')), 'Gameplay evidence changed after it was read');
  const output = path.join(destination, 'single-level-play');
  fs.mkdirSync(path.join(output, 'screenshots'), { recursive: true });
  for (const shot of report.screenshots) for (const file of [shot.file, shot.outcomeFile].filter(Boolean)) {
    fs.copyFileSync(path.join(source, file), path.join(output, 'screenshots', file));
  }
  fs.copyFileSync(path.join(source, 'report.json'), path.join(output, 'native-report.json'));
  const earlierFailure = report.limitations.find(value => value.kind === 'creator-noncancelable-touchcancel').previousFailure;
  fs.copyFileSync(path.join(source, earlierFailure), path.join(output, earlierFailure));
  const image = (file, caption) => `<figure><figcaption>${escape(caption)}</figcaption><a href="screenshots/${escape(file)}"><img loading="lazy" src="screenshots/${escape(file)}" alt="${escape(caption)}"></a></figure>`;
  const levels = json(path.join(PROJECT, 'assets/bundles/puzzle/config/level-catalog.json')).levels;
  const cards = pieceCounts.map(count => `<section><h2>${count} 块 · 四尺寸实际操作</h2><div class="cases">${report.screenshots.filter(shot => shot.pieceCount === count && shot.outcomeFile).map(shot => `<article><h3>${shot.width} × ${shot.height}</h3><p>${escape(shot.id)}${levels.find(level => level.id === shot.id).mainlineNumber === null ? ' · 储备题开发入口' : ''}</p><div class="pair">${image(shot.file, `完成前 · 已摆 ${count - 1}/${count} 块 · ${shot.playing.moves} 步`)}${image(shot.outcomeFile, `完成后 · 规则触发结果界面 · ${shot.final.moves} 步`)}</div></article>`).join('')}</div></section>`).join('');
  const failure = report.screenshots.find(shot => shot.final?.status === 'failed');
  const originals = references.map(([label, file]) => {
    const url = '../../../../assets/block-reference/' + encodeURIComponent(file);
    return `<figure><figcaption>${escape(label)}</figcaption><a href="${url}"><img loading="lazy" src="${url}" alt="${escape(label)}"></a></figure>`;
  }).join('');
  fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html><html lang="zh-CN"><head><link rel="icon" href="data:,"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>单关可玩闭环 · 原生操作验收</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3f1e9;color:#25372f;font:15px/1.65 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1680px;margin:auto;padding:24px}a{color:#21644f}section,.note{background:white;border:1px solid #d4ded4;border-radius:12px;padding:20px;margin:20px 0}.note{background:#fff4d7}h2{margin-top:0}.cases,.originals{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px;align-items:start}article{min-width:0}article p{font-size:12px;overflow-wrap:anywhere}h3{margin:0}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}figure{margin:0}figcaption{font-size:12px;padding:8px 0}img{display:block;width:100%;height:auto;border:1px solid #bdcdbf;border-radius:4px}.failure{max-width:390px}nav{display:flex;flex-wrap:wrap;gap:16px}code{overflow-wrap:anywhere}@media(max-width:1050px){.cases,.originals{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:550px){main{padding:12px}section{padding:14px}.cases{grid-template-columns:1fr}.originals{gap:12px}}
</style></head><body><main><nav><a href="../index.html">全部 Prefab</a><a href="../level-data/index.html">上一阶段题目展示</a><a href="native-report.json">本批完整原生报告</a></nav><h1>单关可玩闭环 · 原生操作验收</h1><p>Creator 3.8.8，验证完成于 ${escape(report.finishedAt)}。普通关与限步关使用正式题库、整块 Prefab 和真实鼠标／触摸输入；四尺寸共16组题目，每组保留完成前与完成后两张实屏。点击图片查看原尺寸。</p><section><h2>本批已验证的操作</h2><p>拼块平移、候选吸附、障碍与重叠拒绝、原位放回不计步、盘外取回与取回按钮。取消验证分为真实 Chrome CDP 双指触摸后由暂停生命周期中断，以及单独的合成 DOM touchcancel 分支；后者 isTrusted=false、cancelable=true，不作为可信硬件取消证据。取消后实际鼠标拖放与取回恢复正常。限步最后一步填满优先成功；耗尽且未填满进入失败，免费重试创建新的尝试。页面往返和重开取消的保局检查见原生报告。</p><p>当前上述验收范围内运行错误 ${report.errors.length}，资源失败 ${report.failedResources.length}；操作阶段玩家存储写入0。最终保留地图与题目目录2个资源 scope，其余 ${report.resources.releasedScopes} 个已释放。</p></section><section><h2>已保留的引擎取消事件限制</h2><p>此前直接使用 Chrome CDP touchCancel 会生成 cancelable=false 事件；Creator 3.8.8 的 pal/input/web/touch-input.js 对该事件无条件调用 preventDefault，浏览器因此报告错误。<a href="${escape(earlierFailure)}">此前失败的完整原生报告</a>保留原始 FAIL 状态与错误信息。</p><p>本轮没有过滤该错误、修改引擎或把旧失败改为通过；验证改为明确区分真实双指的暂停生命周期取消与可取消的合成 DOM 分支。当前范围的零错误不表示可信硬件 touchcancel 已零错误通过，该引擎限制仍待后续处理。</p></section><div class="note"><strong>验收边界</strong><p>本批可实际游玩，并在当前运行期间保留尝试。尚未接入持久化存档、杀进程恢复、首通／复玩奖励、花蜜经济、真实解锁、广告与提示库存。结果界面是规则结果，不表示奖励已到账。7块储备题仅通过开发入口验证，不增加产品地图关卡。</p><p>下面“完成前”截图拍于最后一块松手提交之前的稳定局面，并非拖动中的候选状态；“完成后”截图展示规则触发的结果界面，不能当作全部拼块的无弹窗棋盘图。原稿保留作布局、素材和层序对照；木纹、高光、阴影及接缝仍待最终美术验收，未计算或宣称像素相似度。</p></div><section><h2>原稿对照</h2><p>沿用已交付的普通／限步原稿与分层资产。真实题目形状和数值由题库决定；本批截图不要求复刻原稿中的示例摆放。</p><div class="originals">${originals}</div></section>${cards}<section><h2>限步耗尽 · 规则触发失败界面</h2><p>${escape(failure.id)}，${failure.final.moves} 步耗尽。失败后输入不再改变当前尝试；免费重试得到0步、空棋盘的新尝试。</p><div class="failure">${image(failure.file, `${failure.width} × ${failure.height} · 失败结果阶段`)}</div></section></main></body></html>`);
  return output;
}
