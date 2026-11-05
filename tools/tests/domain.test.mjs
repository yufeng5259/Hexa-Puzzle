// Domain rule tests. Run: npm test (compiles assets/scripts domain code to .test-build first).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const build = new URL('../../.test-build/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const load = p => require(build + p);
const { newSave } = load('game/save/SaveData.js');
const { SaveService } = load('game/save/SaveService.js');
const { LevelCatalog } = load('game/domain/puzzle/LevelCatalog.js');
const Mainline = load('game/domain/Mainline.js');
const Garden = load('game/domain/Garden.js');
const Endless = load('game/domain/Endless.js');
const Clock = load('game/domain/Clock.js');

const cfg = JSON.parse(fs.readFileSync(new URL('../../assets/bundles/common/config/economy.json', import.meta.url), 'utf8'));
const catalog = new LevelCatalog(JSON.parse(fs.readFileSync(new URL('../../assets/bundles/puzzle/config/level-catalog.json', import.meta.url), 'utf8')));

function memory(initial = null) {
  const store = { data: initial, writes: 0, fail: false,
    read() { return this.data && JSON.parse(JSON.stringify(this.data)); },
    write(d) { if (this.fail) throw new Error('disk full'); this.writes++; this.data = JSON.parse(JSON.stringify(d)); } };
  return store;
}
const service = (honey = 120) => {
  const store = memory();
  const save = new SaveService(store, () => newSave(honey, 5, 5));
  return { save, store };
};
const winAttempt = (save, n, patch = {}) => save.transact(d => ({ ...Mainline.startAttempt(d, n), ...patch }));

test('catalog maps 96 mainline levels; every 6th is a challenge', () => {
  assert.equal(catalog.mainline.length, 96);
  assert.equal(catalog.getMainline(6).mode, 'challenge');
  assert.equal(catalog.getMainline(5).mode, 'classic');
});

test('classic first clear 80, replay 20 up to 5 per day, settlement idempotent', () => {
  const { save } = service();
  const level = catalog.getMainline(1);
  const a = winAttempt(save, 1);
  const first = Mainline.settleWin(save, cfg.mainline, level, a, '2026-11-05');
  assert.deepEqual([first.firstClear, first.honey, save.data.wallet.honey], [true, 80, 200]);
  assert.equal(Mainline.settleWin(save, cfg.mainline, level, a, '2026-11-05').honey, 80);
  assert.equal(save.data.wallet.honey, 200, 'same attempt pays once');
  const replays = [];
  for (let i = 0; i < 6; i++) replays.push(Mainline.settleWin(save, cfg.mainline, level, winAttempt(save, 1), '2026-11-05').honey);
  assert.deepEqual(replays, [20, 20, 20, 20, 20, 0]);
  assert.equal(Mainline.settleWin(save, cfg.mainline, level, winAttempt(save, 1), '2026-11-06').honey, 20, 'quota resets next day');
  assert.equal(Mainline.reachableLevel(save.data, cfg.mainline), 2);
});

test('challenge: 120 first clear without star bonus, then +20 per improved star', () => {
  const { save } = service();
  const level = catalog.getMainline(6);
  const r1 = Mainline.settleWin(save, cfg.mainline, level, winAttempt(save, 6, { continued: true, moves: 3 }), 'd');
  assert.deepEqual([r1.honey, r1.stars], [120, 1]);
  const r2 = Mainline.settleWin(save, cfg.mainline, level, winAttempt(save, 6, { moves: level.pieces.length }), 'd');
  assert.deepEqual([r2.honey, r2.stars, r2.bestStars], [40, 3, 3]);
  const r3 = Mainline.settleWin(save, cfg.mainline, level, winAttempt(save, 6, { moves: level.pieces.length, hintsUsed: 1 }), 'd');
  assert.deepEqual([r3.honey, r3.stars, r3.bestStars], [0, 2, 3]);
});

test('endless unlocks after clearing level 4', () => {
  const { save } = service();
  for (let n = 1; n <= 3; n++) Mainline.settleWin(save, cfg.mainline, catalog.getMainline(n), winAttempt(save, n), 'd');
  assert.equal(Mainline.isEndlessUnlocked(save.data, cfg.mainline), false);
  Mainline.settleWin(save, cfg.mainline, catalog.getMainline(4), winAttempt(save, 4), 'd');
  assert.equal(Mainline.isEndlessUnlocked(save.data, cfg.mainline), true);
});

test('garden: upgrade spends exactly the price; stale command rejected; totals 1600/2600/4600', () => {
  const { save } = service(40);
  save.transact(d => Garden.upgrade(d, cfg.garden, 0, 0));
  assert.deepEqual([save.data.wallet.honey, save.data.garden.buildings[0], Garden.gardenProgress(save.data)], [0, 1, 1]);
  assert.throws(() => save.transact(d => Garden.upgrade(d, cfg.garden, 0, 0)));
  assert.equal(Garden.shortage(save.data, cfg.garden, 0), 40);
  assert.deepEqual(cfg.garden.prices.map(p => p.reduce((a, b) => a + b, 0) * 5), [1600, 2600, 4600]);
});

test('garden: chapter reward once, depart needs the reward and resets buildings', () => {
  const { save } = service(100000);
  assert.throws(() => Garden.claimChapter(save, cfg.garden));
  for (let b = 0; b < 5; b++) for (let l = 0; l < 5; l++) save.transact(d => Garden.upgrade(d, cfg.garden, b, l));
  assert.throws(() => save.transact(d => Garden.depart(d, cfg.garden, 0)), /not claimed/);
  const honey = save.data.wallet.honey;
  Garden.claimChapter(save, cfg.garden);
  Garden.claimChapter(save, cfg.garden);
  assert.deepEqual([save.data.wallet.honey - honey, save.data.wallet.hints], [100, 6]);
  save.transact(d => Garden.depart(d, cfg.garden, 0));
  assert.throws(() => save.transact(d => Garden.depart(d, cfg.garden, 0)));
  assert.deepEqual([save.data.garden.chapter, Garden.gardenProgress(save.data)], [1, 0]);
});

test('save: failed write keeps the committed snapshot', () => {
  const { save, store } = service(40);
  store.fail = true;
  assert.throws(() => save.transact(d => Garden.upgrade(d, cfg.garden, 0, 0)));
  assert.deepEqual([save.data.wallet.honey, save.data.garden.buildings[0]], [40, 0]);
});

test('endless board: 37 cells and 21 lines', () => {
  assert.equal(Endless.boardCells(3).length, 37);
  assert.equal(Endless.boardLines(3).length, 21);
});

function emptyRun(tray) {
  return { runId: 'r', revision: 0, rngState: 1, board: {}, tray, score: 0, combo: 0, placements: 0, undoUsed: false, continues: 0, previous: null };
}
const single = { shapeId: 'single', cells: [{ q: 0, r: 0 }], color: 0 };

test('endless scoring: 10 per cell, lines 100n + 50n(n-1), combo from 2nd consecutive clear', () => {
  const run = emptyRun([single, single, single]);
  // Fill line q=3 (4 cells: r=-3..0) except one cell, and line q=-3 except one cell.
  for (const r of [-3, -2, -1]) run.board['3,' + r] = 1;
  for (const r of [0, 1, 2]) run.board['-3,' + r] = 1;
  const a = Endless.place(run, cfg.endless, 0, { q: 3, r: 0 });
  assert.deepEqual([a.lines, a.cellScore, a.lineScore, a.comboScore], [1, 10, 100, 0]);
  const b = Endless.place(run, cfg.endless, 1, { q: -3, r: 3 });
  assert.deepEqual([b.lines, b.lineScore, b.comboScore], [1, 100, 50]);
  assert.equal(run.score, 10 + 100 + 10 + 100 + 50);
  const c = Endless.place(run, cfg.endless, 2, { q: 0, r: 0 });
  assert.deepEqual([c.lines, c.comboScore, run.combo, c.dealt], [0, 0, 0, true]);
  assert.equal(run.tray.filter(Boolean).length, 3);
});

test('endless: two lines through one placement score 300 and clear the union once', () => {
  const run = emptyRun([single, null, null]);
  for (const r of [-3, -2, -1]) run.board['3,' + r] = 1;          // q = 3 line missing (3,0)
  for (const q of [0, 1, 2]) run.board[q + ',' + (-q)] = 1;        // s = 0 ... not through (3,0); use r = 0 line instead
  delete run.board['0,0']; delete run.board['1,-1']; delete run.board['2,-2'];
  for (const q of [-3, -2, -1, 0, 1, 2]) run.board[q + ',0'] = 1;  // r = 0 line missing (3,0)
  const res = Endless.place(run, cfg.endless, 0, { q: 3, r: 0 });
  assert.equal(res.lines, 2);
  assert.equal(res.lineScore, 300);
  assert.equal(res.cleared.length, 4 + 7 - 1);
});

test('endless undo restores the run once', () => {
  const save = service().save;
  const run = save.transact(d => Endless.createRun(d, cfg.endless, 7));
  const before = JSON.stringify({ ...run, previous: null });
  const anchor = Endless.boardCells(3).find(a => Endless.fits(run, cfg.endless, run.tray[0], a));
  Endless.place(run, cfg.endless, 0, anchor);
  Endless.undo(run);
  assert.equal(JSON.stringify({ ...run, previous: null, undoUsed: false, revision: 0 }), before);
  assert.throws(() => Endless.undo(run));
});

test('endless first two runs use the fixed seeds', () => {
  const { save } = service();
  const a = save.transact(d => Endless.createRun(d, cfg.endless, 999));
  const { save: other } = service();
  const b = other.transact(d => Endless.createRun(d, cfg.endless, 123));
  assert.deepEqual(a.tray, b.tray);
});

test('endless harvest: 99→0, 100→5, 2400→120, daily cap 240, valid run rule', () => {
  const amounts = [99, 100, 2400].map(score => {
    const { save } = service();
    save.transact(d => { Endless.createRun(d, cfg.endless, 1); d.endless.run.score = score; });
    return Endless.harvest(save, cfg.endless, 'd').honey;
  });
  assert.deepEqual(amounts, [0, 5, 120]);
  const { save } = service();
  save.transact(d => { Endless.createRun(d, cfg.endless, 1); d.endless.run.score = 3000; d.endless.run.placements = 6; d.endless.dailyDay = 'd'; d.endless.dailyGranted = 235; });
  const r = Endless.harvest(save, cfg.endless, 'd');
  assert.deepEqual([r.honey, r.valid, r.best], [5, true, 3000]);
});

test('endless revive plan clears the fewest cells and frees a verified move', () => {
  const run = emptyRun([single, null, null]);
  for (const c of Endless.boardCells(3)) run.board[c.q + ',' + c.r] = 1;
  assert.equal(Endless.hasMove(run, cfg.endless), false);
  const plan = Endless.revivePlan(run, cfg.endless);
  assert.equal(plan.clearCells.length, 1);
  Endless.applyRevive(run, cfg.endless, plan);
  assert.equal(Endless.hasMove(run, cfg.endless), true);
  assert.equal(Endless.revivePlan(run, cfg.endless), null);
});

test('clock: week starts Monday, day never moves backwards', () => {
  assert.equal(Clock.weekKey(new Date(2026, 10, 8)), '2026-11-02');
  assert.equal(Clock.dayKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(Clock.acceptDay('2026-11-05', '2026-11-04'), '2026-11-05');
});

test('hex outline: shared edges cancel (1 cell 6 edges, 2 cells 10, ring keeps the hole)', () => {
  const { boundaryEdges } = load('game/domain/puzzle/HexOutline.js');
  assert.equal(boundaryEdges([{ q: 0, r: 0 }]).length, 6);
  assert.equal(boundaryEdges([{ q: 0, r: 0 }, { q: 1, r: 0 }]).length, 10);
  const ring = Endless.boardCells(1).filter(c => c.q || c.r);
  assert.equal(boundaryEdges(ring).length, 18 + 6);
});
