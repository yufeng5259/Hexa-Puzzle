// Full smoke test: opens every page/popup, presses every button, records errors, stuck input blocks and screenshots.
// Usage: node smoke.mjs <buildDir> <outDir> [onlyViewNames,comma]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const [buildDir, outDir, onlyArg] = process.argv.slice(2);
const only = onlyArg ? new Set(onlyArg.split(',')) : null;
fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  const file = path.join(buildDir, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);

const ATTEMPT = n => `{ attemptId: 'attempt-smoke', levelNumber: ${n}, placements: {}, moves: 0, hintsUsed: 0, extraMoves: 0, continued: false, featured: false, ads: {} }`;
// Each case: view class name, optional save patch (JS statements on draft `d`), args (JS expression, may be async).
const CASES = [
  { view: 'MapPage', args: '({})' },
  { view: 'LevelPreviewPopup', args: '({ level: 1 })' },
  { view: 'LevelPreviewPopup', tag: 'challenge', args: '({ level: 6 })' },
  { view: 'PuzzlePage', patch: `d.attempt = ${ATTEMPT(1)};`, args: '({ level: 1 })' },
  { view: 'PuzzlePage', tag: 'challenge', patch: `d.attempt = ${ATTEMPT(6)};`, args: '({ level: 6 })' },
  { view: 'PausePopup', patch: `d.attempt = ${ATTEMPT(1)};`, args: '({ level: 1 })' },
  { view: 'ChallengeFailPopup', patch: `d.attempt = ${ATTEMPT(6)};`, args: '({ level: 6 })' },
  { view: 'HintEmptyPopup', patch: `d.attempt = ${ATTEMPT(1)}; d.wallet.hints = 0;` },
  { view: 'ResumePopup', patch: `d.attempt = ${ATTEMPT(1)};` },
  { view: 'PuzzleWinPopup', args: `({ attemptId: 'a1', levelNumber: 5, mode: 'classic', firstClear: true, honey: 80, stars: 0, bestStars: 0, replayCapped: false })` },
  { view: 'PuzzleWinPopup', tag: 'challenge', args: `({ attemptId: 'a2', levelNumber: 6, mode: 'challenge', firstClear: false, honey: 40, stars: 3, bestStars: 3, replayCapped: false })` },
  { view: 'FeaturedPopup' },
  { view: 'GardenPage' },
  { view: 'GardenPage', tag: 'built', patch: 'd.garden.buildings = [5, 5, 5, 5, 5];' },
  { view: 'WorldMapPage', patch: 'd.garden.chapter = 1; d.claims["chapter:0"] = {};' },
  { view: 'ChapterCompletePopup', patch: 'd.garden.buildings = [5, 5, 5, 5, 5];' },
  { view: 'NextThemePopup', patch: 'd.garden.buildings = [5, 5, 5, 5, 5]; d.claims["chapter:0"] = {};' },
  { view: 'JourneyCompletePopup', patch: 'd.garden.chapter = 2; d.garden.buildings = [5, 5, 5, 5, 5];' },
  { view: 'EndlessIntroPopup' },
  { view: 'EndlessPage', open: `(async () => { const intro = await hexa.ui.open(cc.js.getClassByName('EndlessIntroPopup')); await sleep(500); intro.onStart(null, ''); await sleep(1500); })()` },
  { view: 'EndlessRevivePopup', open: `(async () => { const intro = await hexa.ui.open(cc.js.getClassByName('EndlessIntroPopup')); await sleep(500); intro.onStart(null, ''); await sleep(1500); await hexa.ui.open(cc.js.getClassByName('EndlessRevivePopup'), { onRevived: () => {} }); })()` },
  { view: 'EndlessResultPopup', args: `({ runId: 'r1', score: 1200, best: 1200, newBest: true, honey: 60, valid: true })` },
  { view: 'CompanionListPage' },
  { view: 'CompanionDetailPage', args: `({ bee: 'xiaomi' })` },
  { view: 'CompanionDecorPopup', patch: 'd.collection.affinity.xiaomi = 30;', args: `({ bee: 'xiaomi' })` },
  { view: 'StoryPopup', patch: 'd.collection.affinity.xiaomi = 15;', args: `({ storyId: 'bee.xiaomi' })` },
  { view: 'StoryPopup', tag: 'chapter', patch: 'd.garden.chapter = 1; d.claims["chapter:0"] = {};', args: `({ storyId: 'chapter.1' })` },
  { view: 'WardrobePage' },
  { view: 'AlbumPage' },
  { view: 'PhotoDetailPopup', patch: 'd.collection.photos = [0];', args: `({ photoId: 0 })` },
  { view: 'AlbumRewardPopup', patch: 'd.collection.photos = [0, 1, 2, 3, 4, 5];', args: `({ book: 0 })` },
  { view: 'WeeklyStampPopup', args: `({ week: '2026-11-02', games: 15, activeDays: 4 })` },
  { view: 'TasksPage' },
  { view: 'WeeklyPage' },
  { view: 'SigninPage' },
  { view: 'AchievementPage' },
  { view: 'EventPage', patch: 'd.garden.chapter = 1;' },
  { view: 'EventDetailPage', patch: 'd.garden.chapter = 1;', open: `(async () => { const overview = await hexa.ui.open(cc.js.getClassByName('EventPage')); await sleep(500); await hexa.ui.open(cc.js.getClassByName('EventDetailPage'), { overview }); })()` },
  { view: 'EventRewardPopup', patch: 'd.garden.chapter = 1; d.daily.validByChapter = [0, 20];' },
  { view: 'MailboxPage' },
  { view: 'MailDetailPopup', args: `cc.assetManager.getBundle('common').get('config/daily', cc.JsonAsset).json.mails[0]` },
  { view: 'SupplyPopup' },
  { view: 'SettingsPopup' },
  { view: 'HelpPopup', args: '({})' },
  { view: 'HelpPopup', tag: 'article', args: `({ article: 'build' })` },
  { view: 'PrivacyPopup' },
  { view: 'LocalSavePopup' },
  { view: 'AdStatusPopup', args: `({ state: 'loading', reward: '+1' })` },
  { view: 'AdStatusPopup', tag: 'cooldown', args: `({ state: 'cooldown', seconds: 90 })` },
  { view: 'ConfirmPopup', args: `({ titleKey: 'block.288d0398c71e.text.065c8903bb20', messageKey: 'block.288d0398c71e.text.c443ef8ffa25', confirmKey: 'block.288d0398c71e.text.f431d66b83ad', cancelKey: 'block.288d0398c71e.text.ee92c5c44254', onConfirm: () => {} })` },
].filter(c => !only || only.has(c.view));

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
let errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().split('\n').slice(0, 3).join(' | ')); });
page.on('pageerror', e => errors.push('[uncaught] ' + e.message.split('\n')[0]));
await page.goto(`http://localhost:${server.address().port}/index.html`);
await page.waitForFunction(() => window.hexa && hexa.ui && hexa.ui.top(0) && hexa.ui.top(0).constructor.name === 'MapPage', { timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

// In-page helpers: baseline reset, button discovery (test harness only), state probe.
await page.evaluate(() => {
  window.sleep = ms => new Promise(r => setTimeout(r, ms));
  cc.profiler.hideStats();
  hexa.save.transact(d => {
    d.wallet.honey = 100000; d.wallet.hints = 10;
    d.mainline.cleared = Array.from({ length: 12 }, (_, i) => i + 1);
    d.guide.done = ['ftue.1', 'ftue.2', 'ftue.3', 'ftue.4', 'ftue.5', 'ftue.6', 'ftue.7', 'endless.1'];
  });
  window.__seed = JSON.parse(JSON.stringify(hexa.save.data));
  window.__reset = async patch => {
    for (const record of [...hexa.ui.records.values()]) if (record.view) hexa.ui.close(record.view);
    await sleep(400);
    hexa.save.transact(d => { for (const k of Object.keys(window.__seed)) d[k] = JSON.parse(JSON.stringify(window.__seed[k])); if (patch) patch(d); });
    await hexa.ui.open(cc.js.getClassByName('MapPage'), {});
    await sleep(400);
  };
  window.__buttons = view => {
    const out = [];
    const walk = (node, p) => {
      const b = node.getComponent(cc.Button);
      if (b && node.activeInHierarchy && b.interactable && b.clickEvents.length) out.push({ button: b, path: p, handler: b.clickEvents[0].handler, data: b.clickEvents[0].customEventData });
      for (const c of node.children) walk(c, p + '/' + c.name);
    };
    walk(view.node, view.node.name);
    return out;
  };
  window.__state = () => ({ block: hexa.ui.root.block.active, page: hexa.ui.top(0)?.constructor.name ?? null, popup: hexa.ui.top(1)?.constructor.name ?? null });
});

const report = [];
for (const c of CASES) {
  const name = c.view + (c.tag ? '#' + c.tag : '');
  const prepare = async () => {
    await page.evaluate(`window.__reset(${c.patch ? `d => { ${c.patch} }` : 'null'})`);
    if (c.open) await page.evaluate(c.open);
    else await page.evaluate(`(async () => { await hexa.ui.open(cc.js.getClassByName('${c.view}')${c.args ? ', ' + c.args : ''}); })()`);
    await new Promise(r => setTimeout(r, 700));
  };
  errors = [];
  try { await prepare(); } catch (e) { errors.push('[prepare] ' + e.message.slice(0, 200)); }
  const opened = await page.evaluate(`(() => { const v = [...hexa.ui.records.values()].map(r => r.view).find(v => v && v.constructor.name === '${c.view}'); return v ? window.__buttons(v).map(b => ({ path: b.path, handler: b.handler, data: b.data })) : null; })()`);
  await page.screenshot({ path: path.join(outDir, name.replace('#', '_') + '.png') });
  const entry = { view: name, openErrors: errors, buttons: [] };
  report.push(entry);
  if (!opened) { entry.openErrors.push('view did not open'); console.log(name, 'DID NOT OPEN', errors); continue; }
  for (let i = 0; i < opened.length; i++) {
    errors = [];
    try { await prepare(); } catch (e) { errors.push('[prepare] ' + e.message.slice(0, 200)); }
    const sync = await page.evaluate(`(() => { const v = [...hexa.ui.records.values()].map(r => r.view).find(v => v && v.constructor.name === '${c.view}');
      const b = window.__buttons(v)[${i}]; if (!b) return 'button missing';
      try { (cc.EventHandler || cc.Component.EventHandler).emitEvents(b.button.clickEvents, { type: 'smoke' }); return null; } catch (e) { return e.message; } })()`);
    if (sync) errors.push('[sync] ' + sync);
    await new Promise(r => setTimeout(r, 1300));
    const state = await page.evaluate('window.__state()');
    const result = { ...opened[i], errors, after: state };
    if (state.block) result.errors.push('INPUT STUCK BLOCKED');
    entry.buttons.push(result);
  }
  const bad = entry.openErrors.length + entry.buttons.filter(b => b.errors.length).length;
  console.log(`${name}: ${opened.length} buttons, ${bad ? bad + ' problems' : 'ok'}`);
  for (const e of entry.openErrors) console.log('    [open]', e.slice(0, 300));
  for (const b of entry.buttons) if (b.errors.length) console.log('   ', b.handler, b.data, '→', b.errors.join(' || ').slice(0, 300));
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
const problems = report.flatMap(r => [...r.openErrors.map(e => `${r.view} [open] ${e}`), ...r.buttons.flatMap(b => b.errors.map(e => `${r.view} ${b.path} → ${b.handler}(${b.data}) : ${e}`))]);
fs.writeFileSync(path.join(outDir, 'problems.txt'), problems.join('\n'));
console.log(`\n${problems.length} problems`);
await browser.close();
server.close();
