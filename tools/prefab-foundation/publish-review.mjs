import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PROJECT, WORKSPACE, PROTOTYPE, SCRATCH, sha256, normalize } from './io.mjs';
import { prefabCatalog } from './catalog.mjs';
import {readUiEvidence,publishUiEvidence} from './ui-review.mjs';
import {readLevelEvidence,publishLevelEvidence} from './level-review.mjs';
import {readPlayEvidence,publishPlayEvidence} from './play-review.mjs';

const NATIVE = path.join(SCRATCH,'native');
const DESTINATION = path.join(PROTOTYPE,'review/cocos-production/prefab-foundation');
const json = file => JSON.parse(fs.readFileSync(file,'utf8'));
const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pageIds = ['loading','mainline-map','garden','puzzle','settings','mail-detail'];
const allIds = [...pageIds,'virtual-list'];
const screenSizes = [{width:390,height:844},{width:320,height:568}];
const titles = {loading:'Loading', 'mainline-map':'主线地图',garden:'家园',puzzle:'拼图',settings:'设置','mail-detail':'信件详情','virtual-list':'虚拟列表独立样板'};

function walk(directory,accept) {
  const result=[];
  if(!fs.existsSync(directory))return result;
  for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())result.push(...walk(file,accept));
    else if(entry.isFile()&&accept(file))result.push(file);
  }
  return result;
}

function assertReady(report) {
  if(report.status!=='PASS_NATIVE_PREFAB_FOUNDATION')throw new Error(`Refusing publication: native report is ${report.status}, not PASS_NATIVE_PREFAB_FOUNDATION`);
  if(report.errors?.length||report.failedResources?.length||report.errorCount)throw new Error('Refusing publication: active Main preview contains errors or failed resources');
  if(report.native?.engineVersion!=='3.8.8')throw new Error('Refusing publication: Creator 3.8.8 evidence is required');
  if(report.native?.prefabCount!==prefabCatalog.length||report.native?.prefabs?.length!==prefabCatalog.length)throw new Error('Refusing publication: native Prefab coverage is incomplete');
  const covered=new Set(report.native.prefabs.map(p=>p.id));
  if(prefabCatalog.some(p=>!covered.has(p.id)))throw new Error('Refusing publication: native Prefab IDs do not match the current inventory');
  for(const p of report.native.prefabs) {
    if(!p.validated?.length||!p.activatedBindings?.length)throw new Error('Missing native binding activation: '+p.id);
    if(p.buttons>p.buttonHandlers)throw new Error('Missing serialized native Button handlers: '+p.id);
  }
  if(report.native?.virtualList?.status!=='PASS_NATIVE_LIST')throw new Error('Refusing publication: native list evidence is incomplete');
  if(report.native?.resourceScopes?.status!=='PASS_NATIVE_RESOURCE_OWNERSHIP')throw new Error('Refusing publication: native resource ownership evidence is incomplete');
  for(const id of allIds)for(const {width,height} of screenSizes) {
    const shot=report.screenshots?.find(s=>s.id===id&&s.viewport?.width===width&&s.viewport?.height===height);
    if(!shot||path.basename(shot.file)!==shot.file||!shot.file.endsWith('.png')||!fs.existsSync(path.join(NATIVE,shot.file)))throw new Error(`Missing approved screenshot: ${id}/${width}x${height}`);
    if(id==='virtual-list'&&!shot.listViewport)throw new Error(`VirtualList viewport evidence is absent at ${width}x${height}`);
  }
  if(report.screenshots.length!==allIds.length*2)throw new Error('Expected exactly fourteen native screenshots');
  const latest=fs.statSync(path.join(NATIVE,'report.json')).mtimeMs;
  const stale=walk(path.join(PROJECT,'assets'),file=>/\.(ts|prefab|scene)$/.test(file)).find(file=>fs.statSync(file).mtimeMs>latest);
  if(stale)throw new Error('Refusing publication: native evidence predates changed asset '+normalize(path.relative(PROJECT,stale)));
  for(const id of pageIds) {
    const sourcePage=prefabCatalog.find(p=>p.id===id).sourcePage;
    if(!fs.existsSync(path.join(PROTOTYPE,'assets/block-reference',sourcePage+'.png')))throw new Error('Missing original reference: '+sourcePage);
  }
}

function runCheck(name,args) {
  const startedAt=new Date().toISOString();
  const result=spawnSync(process.execPath,args,{cwd:PROJECT,encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true});
  const output=(result.stdout||'')+(result.stderr||'');
  if(result.error||result.status!==0)throw new Error(`${name} failed; review remains unpublished.\n${result.error?.message||output}`);
  return {name,command:['node',...args].join(' '),startedAt,completedAt:new Date().toISOString(),exitCode:result.status,output};
}

function buildHtml(report,audit,verification) {
  const prefabs=report.native.prefabs;
  const nativeButtons=prefabs.reduce((n,p)=>n+(p.buttons||0),0);
  const eventExamples=prefabs.filter(p=>p.actionEvent).length;
  const shots=id=>screenSizes.map(({width,height})=>{
    const s=report.screenshots.find(s=>s.id===id&&s.viewport.width===width&&s.viewport.height===height);
    return `<figure><figcaption>Cocos ${s.viewport.width} × ${s.viewport.height}</figcaption><a href="screenshots/${escape(s.file)}"><img loading="lazy" src="screenshots/${escape(s.file)}" alt="${escape(titles[id])} ${width}px Cocos 实屏"></a></figure>`;
  }).join('');
  const sections=pageIds.map(id=>{
    const prefab=prefabCatalog.find(p=>p.id===id);
    const src='../../../assets/block-reference/'+encodeURIComponent(prefab.sourcePage)+'.png';
    return `<section id="${id}"><h2>${escape(titles[id])}</h2><p class="source">来源：${escape(prefab.sourcePage)} · ${escape(prefab.path)}</p><div class="comparison"><figure><figcaption>原稿 ${escape(prefab.sourcePage)}</figcaption><a href="${src}"><img loading="lazy" src="${src}" alt="${escape(titles[id])} 原稿"></a></figure>${shots(id)}</div></section>`;
  }).join('');
  const snapshots=report.native.virtualList.snapshots.map(s=>`<tr><td>${escape(s.label)}</td><td>${s.active}</td><td>${s.retained}</td><td>${escape((s.indexes||[]).join(', '))}</td></tr>`).join('');
  const rows=prefabs.map(p=>`<tr><td>${escape(p.id)}</td><td>${p.nodeCount}</td><td>${p.buttons}</td><td>${p.buttonHandlers}</td><td>${escape(p.validated.join(', '))}</td><td>${p.actionEvent?escape(p.actionEvent.actionId):'—'}</td></tr>`).join('');
  return `<!doctype html><html lang="zh-CN"><head><link rel="icon" href="data:,"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prefab 基础阶段 · Cocos 原生对照画册</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f3f1e9;color:#25372f;font:15px/1.65 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1380px;margin:auto;padding:24px}h1{font-size:28px}h2{margin-top:0}section,.summary{background:white;padding:22px;margin:22px 0;border-radius:14px;border:1px solid #d4ded4}a{color:#21644f}.note{background:#fff4d7;border-left:4px solid #a97a23;padding:14px 18px}.source{overflow-wrap:anywhere;color:#52645b}.comparison{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:start}figure{margin:0}figcaption{padding:8px 0;font-weight:600}img{max-width:100%;height:auto;display:block;border:1px solid #bdcdbf;border-radius:5px}.samples{display:flex;gap:22px;align-items:start}.samples figure{max-width:390px;flex:1}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #d4ded4;text-align:left;padding:8px;vertical-align:top}nav{display:flex;flex-wrap:wrap;gap:14px}code{font-size:12px;overflow-wrap:anywhere}summary{cursor:pointer;font-weight:600}@media(max-width:700px){main{padding:12px}.comparison{gap:8px}section{padding:12px}figcaption{font-size:11px}.samples{gap:12px}h1{font-size:23px}}
  </style></head><body><main><h1>Prefab 基础阶段 · Cocos 原生对照画册</h1><p>Creator ${escape(report.native.engineVersion)}，报告 ${escape(report.createdAt)}。这是正式工程中的框架、分层展示与节点绑定验收；该画册核查框架与绑定；实际单关玩法见最新验收。</p><nav>${allIds.map(id=>`<a href="#${id}">${escape(titles[id])}</a>`).join('')}<a href="#evidence">检查证据</a><a href="ui-integration/index.html">界面链路与实际点击验收</a><a href="level-data/index.html">真实关卡与整块 Prefab</a><a href="single-level-play/index.html">单关可玩 · 最新验收</a></nav>
  <div class="summary"><h2>报告实测结果</h2><p>${escape(report.status)}；${audit.prefabs} 个 Prefab、${audit.nodes} 个序列化节点、${audit.buttons} 个 Button、${audit.references} 处内部／资源引用；${audit.originalImages} 张原图与 ${audit.derivatives} 张必要派生。真实引擎逐一加载、实例化并启用 ${report.native.prefabCount} 个 Prefab；原生记录 ${nativeButtons} 个 Button，${eventExamples} 个 Prefab 记录了处理器事件样例。事件样例由验证器触发，不能据此宣称全部业务点击可用。</p><p>当前测试：${verification.tests.tests} 项，${verification.tests.passed} 通过，${verification.tests.failed} 失败；TypeScript 与静态资源／绑定审核的进程退出码均为 0。两个视口共 ${report.screenshots.length} 张 Cocos 实屏。活动 Main 页脚本错误 ${report.errors.length}、资源失败 ${report.failedResources.length}；载入 Main 之前的旧预览记录另存于原生报告（${report.initialPreview?.errors?.length||0} 条），不混为本轮结果。</p></div>
  <div class="note"><strong>对照边界</strong><p>本画册没有进行整页像素相似度评估，不宣称像素一致。数值由只读展示数据驱动；地图中尚未接入的菜单只提示当前阶段。棋盘已按原稿格点绘制异形边界、凹槽和遮罩木纹；边缘高光、阴影与纹理接缝仍有差异，尚未完成逐页美术验收。页面适配截图用于检查导入、层序与小屏结构，不能替代后续逐页美术验收。</p><p>拖拽与拼图判定见单关可玩画册。业务存档、花蜜经济、奖励发放、广告、解锁及无尽清线尚未接入。列表和资源 scope 的框架测试已覆盖原生运行，列表样板使用本地演示数据。</p></div>
  ${sections}<section id="virtual-list"><h2>虚拟列表独立样板</h2><p>${escape(report.native.virtualList.status)}；样板 viewport 在 Canvas 内。空列表、单项、1000 项、快速跳转、重复绑定、横向、尺寸变化、清空及父节点销毁前状态以当前原生报告为准。缺绑定检查实际报错：<code>${escape(report.native.virtualList.missingBinding)}</code>。</p><div class="samples">${shots('virtual-list')}</div><div class="table-wrap"><table><thead><tr><th>场景</th><th>活动项</th><th>保留项</th><th>索引</th></tr></thead><tbody>${snapshots}</tbody></table></div><p>资源 scope：${escape(report.native.resourceScopes.status)}。引用数 ${report.native.resourceScopes.baseline} → ${report.native.resourceScopes.sharedRefs} → ${report.native.resourceScopes.afterDestroy} → ${report.native.resourceScopes.afterRelease}。</p></section>
  <section id="evidence"><h2>检查证据</h2><p><a href="native-report.json">完整原生报告</a> · <a href="static-audit.json">静态审核</a> · <a href="verification.json">测试与类型检查命令记录</a> · <a href="tests.tap">测试输出</a> · <a href="source-fingerprints.json">源码指纹清单</a> · <a href="source-art-manifest.json">素材来源登记</a> · <a href="generated-files.json">生成文件保护登记</a></p><details><summary>${prefabs.length} 个 Prefab 原生验证明细</summary><div class="table-wrap"><table><thead><tr><th>ID</th><th>节点</th><th>按钮</th><th>序列化处理器</th><th>激活绑定组件</th><th>事件样例</th></tr></thead><tbody>${rows}</tbody></table></div></details></section></main></body></html>`;
}

export function publishReview() {
  const playReport=readPlayEvidence();
  const levelReport=readLevelEvidence();
  const uiReport=readUiEvidence();
  const nativeFile=path.join(NATIVE,'report.json');
  const report=json(nativeFile);
  assertReady(report); // No official review files are written for a failed run.
  const testArgs=['--test','--test-reporter=tap','tools/prefab-foundation/tests/framework.test.mjs','tools/prefab-foundation/tests/assets.test.mjs','tools/prefab-foundation/tests/generator-ownership.test.mjs','tools/prefab-foundation/tests/scene-contract.test.mjs','tools/prefab-foundation/tests/ui-flow.test.mjs','tools/prefab-foundation/tests/presentation.test.mjs','tools/prefab-foundation/tests/source-geometry.test.mjs','tools/prefab-foundation/tests/core-bindings.test.mjs','tools/prefab-foundation/tests/level-data.test.mjs','tools/prefab-foundation/tests/puzzle-display.test.mjs','tools/prefab-foundation/tests/mainline-presentation.test.mjs','tools/prefab-foundation/tests/level-prefabs.test.mjs'];
  testArgs.push('tools/prefab-foundation/tests/puzzle-session.test.mjs','tools/prefab-foundation/tests/play-input.test.mjs','tools/prefab-foundation/tests/play-flow.test.mjs','tools/prefab-foundation/tests/play-prefabs.test.mjs');
  const tests=runCheck('test',testArgs);
  const number=label=>Number(tests.output.match(new RegExp('^# '+label+' (\\d+)\\s*$','m'))?.[1]??NaN);
  const testCounts={tests:number('tests'),passed:number('pass'),failed:number('fail'),skipped:number('skipped'),cancelled:number('cancelled')};
  if(!Number.isFinite(testCounts.tests)||testCounts.tests<=0||testCounts.failed!==0||testCounts.cancelled!==0||testCounts.skipped!==0||testCounts.tests!==testCounts.passed)throw new Error('Refusing publication: complete passing TAP summary is required');
  const typecheck=runCheck('typecheck',['tools/prefab-foundation/typecheck.mjs']);
  const auditCheck=runCheck('audit',['tools/prefab-foundation/audit.mjs']);
  const audit=json(path.join(SCRATCH,'audit.json'));
  if(audit.status!=='PASS_STATIC_PREFAB_AND_SOURCE_CONTRACTS'||audit.businessConnected!==false)throw new Error('Invalid static foundation audit');
  // Checks must not silently mutate the runtime inputs after native validation.
  assertReady(report);
  const verification={createdAt:new Date().toISOString(),scope:'Foundation framework only; no business behavior accepted',tests:testCounts,checks:[tests,typecheck,auditCheck]};
  const codeFiles=[...walk(path.join(PROJECT,'assets'),file=>/\.(ts|prefab|scene|json|meta)$/.test(file)),...walk(path.join(PROJECT,'tools/prefab-foundation'),file=>/\.(mjs|py|json)$/.test(file)),path.join(PROJECT,'package.json'),path.join(PROJECT,'tsconfig.json'),...['block-data.js','app.js','meta.js','block-source-core.js','block-home-meta.js','block-services.js','block-fidelity.js'].map(file=>path.join(PROTOTYPE,file))];
  const fingerprints={schema:'hexa.prefab-foundation.review-fingerprints.v1',createdAt:new Date().toISOString(),nativeReportSha256:sha256(fs.readFileSync(nativeFile)),files:[...new Set(codeFiles)].sort().map(file=>({path:normalize(path.relative(WORKSPACE,file)),sha256:sha256(fs.readFileSync(file))}))};
  const html=buildHtml(report,audit,verification);
  fs.mkdirSync(path.join(DESTINATION,'screenshots'),{recursive:true});
  publishUiEvidence(DESTINATION,uiReport);
  publishLevelEvidence(DESTINATION,levelReport);
  publishPlayEvidence(DESTINATION,playReport);
  for(const shot of report.screenshots)fs.copyFileSync(path.join(NATIVE,shot.file),path.join(DESTINATION,'screenshots',shot.file));
  fs.copyFileSync(nativeFile,path.join(DESTINATION,'native-report.json'));
  fs.copyFileSync(path.join(SCRATCH,'audit.json'),path.join(DESTINATION,'static-audit.json'));
  fs.copyFileSync(path.join(PROJECT,'tools/prefab-foundation/generated-files.json'),path.join(DESTINATION,'generated-files.json'));
  fs.copyFileSync(path.join(PROJECT,'assets/resources/framework/config/source-art-manifest.json'),path.join(DESTINATION,'source-art-manifest.json'));
  fs.writeFileSync(path.join(DESTINATION,'verification.json'),JSON.stringify(verification,null,2)+'\n');
  fs.writeFileSync(path.join(DESTINATION,'source-fingerprints.json'),JSON.stringify(fingerprints,null,2)+'\n');
  fs.writeFileSync(path.join(DESTINATION,'tests.tap'),tests.output);
  fs.writeFileSync(path.join(DESTINATION,'index.html'),html);
  const docFile=path.join(PROJECT,'docs/prefab-foundation.md');
  const publishedLines=[
    '<!-- PUBLISHED_VERIFICATION_START -->',
    `发布于 ${verification.createdAt}，原生状态为 \`${report.status}\`。`,
    '',
    `- 当前新基线测试 ${testCounts.tests} 项，${testCounts.passed} 通过，${testCounts.failed} 失败；TypeScript 与静态审核均退出 0。`,
    `- 静态审核：${audit.prefabs} 个 Prefab、${audit.nodes} 个节点、${audit.buttons} 个 Button、${audit.references} 处引用、${audit.originalImages} 张原图及 ${audit.derivatives} 张派生。`,
    `- Creator ${report.native.engineVersion} 实际逐一加载并启用 ${report.native.prefabCount} 个 Prefab，核验字段和事件引用；两个尺寸共 ${report.screenshots.length} 张实屏。`,
    `- 原生列表：\`${report.native.virtualList.status}\`；资源引用所有权：\`${report.native.resourceScopes.status}\`；活动 Main 页脚本错误 ${report.errors.length}、资源失败 ${report.failedResources.length}。`,
    '- [正式对照画册](../../prototype/review/cocos-production/prefab-foundation/index.html)、[原生报告](../../prototype/review/cocos-production/prefab-foundation/native-report.json)、[命令验证](../../prototype/review/cocos-production/prefab-foundation/verification.json)。',
    '',
    '上述通过只涵盖本阶段框架、展示与绑定；业务及视觉差异仍遵循本节明确边界。',
    '<!-- PUBLISHED_VERIFICATION_END -->',
  ];
  fs.writeFileSync(docFile,fs.readFileSync(docFile,'utf8').replace(/<!-- PUBLISHED_VERIFICATION_START -->[\s\S]*?<!-- PUBLISHED_VERIFICATION_END -->/,publishedLines.join('\n')));
  const result={status:'PUBLISHED_PASS_REVIEW',path:normalize(path.relative(WORKSPACE,path.join(DESTINATION,'index.html'))),prefabs:report.native.prefabCount,screenshots:report.screenshots.length,tests:testCounts};
  console.log(JSON.stringify(result,null,2));
  return result;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))publishReview();
