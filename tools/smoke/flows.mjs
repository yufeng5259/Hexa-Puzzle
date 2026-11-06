// End-to-end flows in a web-mobile debug build: plays through real handlers and checks save results.
// Usage: node flows.mjs <buildDir>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const [buildDir] = process.argv.slice(2);
const server = http.createServer((req, res) => {
  const f = path.join(buildDir, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  fs.createReadStream(f).pipe(res);
}).listen(0);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text().slice(0, 300)); });
page.on('pageerror', e => errors.push('[uncaught] ' + e.message.slice(0, 300)));
await page.goto(`http://localhost:${server.address().port}/index.html`);
await page.waitForFunction(() => window.hexa && hexa.ui && hexa.ui.top(0) && hexa.ui.top(0).constructor.name === 'MapPage', { timeout: 30000 });
await new Promise(r => setTimeout(r, 1000));

await page.evaluate(() => {
  window.sleep = ms => new Promise(r => setTimeout(r, ms));
  window.cls = n => cc.js.getClassByName(n);
  window.view = n => [...hexa.ui.records.values()].map(r => r.view).find(v => v && v.constructor.name === n) ?? null;
  window.press = async (v, handler, data = '') => { v[handler](null, data); await sleep(700); };
  cc.profiler.hideStats();
  hexa.save.transact(d => { d.guide.done = ['ftue.1', 'ftue.2', 'ftue.3', 'ftue.4', 'ftue.5', 'ftue.6', 'ftue.7', 'endless.1']; });
});

const results = [];
async function flow(name, fn) {
  const before = errors.length;
  let outcome;
  try { outcome = await page.evaluate(fn); } catch (e) { outcome = { fail: e.message.slice(0, 300) }; }
  const errs = errors.slice(before);
  const ok = !outcome?.fail && errs.length === 0;
  results.push({ name, ok, outcome, errs });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, JSON.stringify(outcome), errs.length ? errs : '');
}

// Real touch drag of a mainline piece onto its answer cells.
async function solveCurrentPuzzle() {
  const n = await page.evaluate(() => view('PuzzlePage').pieces.length);
  for (let i = 0; i < n; i++) {
    const [a, b] = await page.evaluate(i => {
      const pg = view('PuzzlePage'); const p = pg.pieces[i]; const piece = pg.level.pieces.find(x => x.id === p.id);
      const w = (node, x, y) => { const v = node.getComponent('cc.UITransform').convertToWorldSpaceAR(new cc.Vec3(x, y, 0)); return [v.x, 1844 - v.y]; };
      const t = pg.board.pointOf(piece.targetCells[0]);
      return [w(p.shape.node, 0, 0), w(pg.board.node, t.x, t.y - pg.board.radius * 1.4)];
    }, i);
    const s = 390 / 853, toCss = ([x, y]) => [x * s, (y - 922) * s + 422];
    const [ca, cb] = [toCss(a), toCss(b)];
    const client = await page.target().createCDPSession();
    const touch = (type, p) => client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: p[0], y: p[1] }] });
    await touch('touchStart', ca);
    for (let k = 1; k <= 8; k++) await touch('touchMove', [ca[0] + (cb[0] - ca[0]) * k / 8, ca[1] + (cb[1] - ca[1]) * k / 8]);
    await touch('touchEnd', cb);
    await new Promise(r => setTimeout(r, 400));
  }
  await new Promise(r => setTimeout(r, 1200));
}

// 1. Mainline: levels 1–6 by real drag (6 is the first challenge level), then replay quota.
for (let n = 1; n <= 6; n++) {
  await page.evaluate(async n => { const map = view('MapPage'); await hexa.ui.open(cls('LevelPreviewPopup'), { level: n }); await sleep(800); await press(view('LevelPreviewPopup'), 'onStart'); await sleep(1500); }, n);
  await solveCurrentPuzzle();
  await flow(`mainline level ${n} solved by drag`, `(async () => { const win = view('PuzzleWinPopup'); if (!win) return { fail: 'no win popup', popup: hexa.ui.top(1)?.constructor.name };
    const r = win.args; const s = hexa.save.data; win.onBack(); await sleep(800);
    return { honey: r.honey, stars: r.stars, cleared: s.mainline.cleared.length, wallet: s.wallet.honey, endlessUnlocked: s.mainline.cleared.includes(4) }; })()`);
}
await flow('mainline totals', `(async () => { const s = hexa.save.data; const expect = 120 + 80 * 5 + 120;
  return s.wallet.honey === expect ? { honey: s.wallet.honey } : { fail: 'honey ' + s.wallet.honey + ' expected ' + expect }; })()`);

// 2. Garden: build all five buildings to max, claim, depart (story shows), photos recorded.
await flow('garden build, claim, depart', `(async () => {
  hexa.save.transact(d => { d.wallet.honey = 2000; });
  const g = await hexa.ui.open(cls('GardenPage')); await sleep(1500);
  for (let lv = 0; lv < 5; lv++) for (let b = 0; b < 5; b++) { g.slots[b].onUpgrade(null, ''); await sleep(120); }
  await sleep(1500);
  const s1 = hexa.save.data; const spent = 2000 - s1.wallet.honey;
  const popup = hexa.ui.top(1)?.constructor.name;
  if (spent !== 1600) return { fail: 'spent ' + spent, levels: s1.garden.buildings };
  if (popup !== 'ChapterCompletePopup') return { fail: 'popup ' + popup };
  await press(view('ChapterCompletePopup'), 'onClaim'); await sleep(800);
  const next = view('NextThemePopup'); if (!next) return { fail: 'no next theme', popup: hexa.ui.top(1)?.constructor.name };
  await press(next, 'onGo'); await sleep(1200);
  const story = view('StoryPopup'); const s2 = hexa.save.data;
  return story && s2.garden.chapter === 1 && s2.collection.photos.length === 6 && s2.wallet.hints >= 6
    ? { chapter: 1, photos: s2.collection.photos, story: story.args.storyId } : { fail: 'after depart', story: !!story, chapter: s2.garden.chapter, photos: s2.collection.photos };
})()`);
await page.evaluate(async () => { for (const r of [...hexa.ui.records.values()]) if (r.view && r.view.constructor.name !== 'MapPage') hexa.ui.close(r.view); await sleep(800); });

// 3. Endless: start, place pieces through the domain-equivalent drop handler, undo once, harvest.
await flow('endless place, undo, harvest', `(async () => {
  await hexa.ui.open(cls('EndlessIntroPopup')); await sleep(600); await press(view('EndlessIntroPopup'), 'onStart'); await sleep(1500);
  const pg = view('EndlessPage'); if (!pg) return { fail: 'no endless page' };
  const E = { cells: [] }; let placed = 0;
  for (let k = 0; k < 9; k++) {
    const run = hexa.save.data.endless.run; const slot = run.tray.findIndex(p => p);
    if (slot < 0) break;
    const piece = run.tray[slot];
    const radius = hexa.config.endless.radius; let anchor = null;
    for (let q = -radius; q <= radius && !anchor; q++) for (let r = -radius; r <= radius && !anchor; r++) {
      if (Math.abs(q + r) > radius) continue;
      if (piece.cells.every(c => { const x = c.q + q, y = c.r + r; return Math.abs(x) <= radius && Math.abs(y) <= radius && Math.abs(x + y) <= radius && run.board[x + ',' + y] === undefined; })) anchor = { q, r };
    }
    if (!anchor) break;
    pg.commitPlacement ? pg.commitPlacement(slot, anchor) : pg.placeAt(slot, anchor);
    placed++; await sleep(150);
  }
  const before = hexa.save.data.endless.run;
  if (!before || before.placements !== placed) return { fail: 'placements ' + (before && before.placements) + ' vs ' + placed };
  await press(pg, 'onUndo');
  const undone = hexa.save.data.endless.run;
  if (undone.placements !== placed - 1 || !undone.undoUsed) return { fail: 'undo', placements: undone.placements };
  const score = undone.score, honey0 = hexa.save.data.wallet.honey;
  await press(pg, 'onHarvest'); await sleep(500);
  await press(view('ConfirmPopup'), 'onConfirm'); await sleep(1200);
  const result = view('EndlessResultPopup'); const s = hexa.save.data;
  const expect = Math.min(120, Math.floor(score / 100) * 5);
  return result && s.endless.run === null && s.wallet.honey - honey0 === expect && s.endless.best === score
    ? { placed, score, honey: expect } : { fail: 'harvest', result: !!result, gained: s.wallet.honey - honey0, expect, best: s.endless.best };
})()`);
await page.evaluate(async () => { for (const r of [...hexa.ui.records.values()]) if (r.view && r.view.constructor.name !== 'MapPage') hexa.ui.close(r.view); await sleep(800); });

// 4. Daily: sign-in day 1, task claim with affinity, free hint, map red dots.
await flow('daily sign-in, task, supply, red dots', `(async () => {
  const map = view('MapPage'); const dotsBefore = Object.fromEntries(map.entries.map(e => [e.id, e.redDot.active]));
  const h0 = hexa.save.data.wallet.honey;
  const si = await hexa.ui.open(cls('SigninPage')); await sleep(800); await press(si, 'onClaim'); si.close(); await sleep(600);
  const signinHoney = hexa.save.data.wallet.honey - h0;
  const tp = await hexa.ui.open(cls('TasksPage')); await sleep(800);
  const claimable = tp.rows.findIndex(r => r.claimButton.active);
  let affinity = null;
  if (claimable >= 0) { tp.rows[claimable].onClaim(null, ''); await sleep(600); const c = hexa.save.data.collection; affinity = c.affinity[c.follow] ?? 0; }
  tp.close(); await sleep(600);
  const hints0 = hexa.save.data.wallet.hints;
  const sp = await hexa.ui.open(cls('SupplyPopup')); await sleep(800); await press(sp, 'onFreeHint'); sp.close(); await sleep(600);
  return signinHoney === 40 && hexa.save.data.wallet.hints === hints0 + 1 && (claimable < 0 || affinity === 1)
    ? { signinHoney, claimable, affinity, dotsBefore } : { fail: 'daily', signinHoney, claimable, affinity, hints: hexa.save.data.wallet.hints - hints0 };
})()`);

// 5. Persistence: reload and the save survives.
const snapshot = await page.evaluate(() => JSON.stringify({ honey: hexa.save.data.wallet.honey, chapter: hexa.save.data.garden.chapter, cleared: hexa.save.data.mainline.cleared.length }));
await page.reload();
await page.waitForFunction(() => window.hexa && hexa.ui && hexa.ui.top(0) && hexa.ui.top(0).constructor.name === 'MapPage', { timeout: 30000 });
await flow('save survives reload', `(() => { const now = JSON.stringify({ honey: hexa.save.data.wallet.honey, chapter: hexa.save.data.garden.chapter, cleared: hexa.save.data.mainline.cleared.length });
  return now === ${JSON.stringify(snapshot)} ? JSON.parse(now) : { fail: now + ' vs ' + ${JSON.stringify(snapshot)} }; })()`);

console.log(`\n${results.filter(r => r.ok).length}/${results.length} flows passed`);
await browser.close();
server.close();
