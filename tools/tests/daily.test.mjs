// Daily systems rules (F041–F045, F050, F057). Run: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const build = new URL('../../.test-build/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const load = p => require(build + p);
const { newSave } = load('game/save/SaveData.js');
const { SaveService } = load('game/save/SaveService.js');
const Daily = load('game/domain/Daily.js');
const { recordActivity } = load('game/domain/Activity.js');

const json = p => JSON.parse(fs.readFileSync(new URL('../../assets/bundles/common/config/' + p, import.meta.url), 'utf8'));
const cfg = json('economy.json');
const rules = json('daily.json');
Daily.configureDaily(rules, cfg);

const service = () => {
  const store = { data: null, read() { return this.data && JSON.parse(JSON.stringify(this.data)); }, write(d) { this.data = JSON.parse(JSON.stringify(d)); } };
  return new SaveService(store, () => newSave(120, 5, 5));
};
const act = (save, activity, day) => save.transact(d => recordActivity(d, activity, day));
const win = (save, day, firstClear = true) => act(save, { kind: 'puzzleWin', levelNumber: 1, firstClear, mode: 'classic' }, day);

test('tasks: variants follow progress, are locked at day start, pay once', () => {
  const save = service();
  const day = '2026-11-05';
  assert.deepEqual(Daily.taskKinds(save.data), ['play', 'build', 'level']);
  save.transact(d => Daily.startDay(d, day));
  for (let i = 0; i < 4; i++) win(save, day);
  save.transact(d => { d.mainline.cleared.push(cfg.mainline.endlessUnlockLevel); });
  assert.deepEqual(Daily.tasksOf(save.data, day).map(t => [t.kind, t.progress]), [['play', 3], ['build', 0], ['level', 1]], 'locked variant, capped progress');
  const honey = save.data.wallet.honey;
  Daily.claimTask(save, day, 0);
  Daily.claimTask(save, day, 0);
  assert.equal(save.data.wallet.honey - honey, 120);
  assert.throws(() => Daily.claimTask(save, day, 1));
  const next = '2026-11-06';
  save.transact(d => Daily.startDay(d, next));
  assert.deepEqual(Daily.tasksOf(save.data, next).map(t => t.kind), ['play', 'build', 'endless'], 'new day, new variants');
});

test('tasks: endless placements and builds count; invalid endless runs do not count as games', () => {
  const save = service();
  const day = '2026-11-05';
  save.transact(d => { d.mainline.cleared.push(cfg.mainline.endlessUnlockLevel); Daily.startDay(d, day); });
  for (let i = 0; i < 12; i++) act(save, { kind: 'endlessPlace' }, day);
  act(save, { kind: 'build', chapter: 0, buildingId: 0, level: 1 }, day);
  act(save, { kind: 'endlessRun', score: 99, valid: false }, day);
  assert.deepEqual(Daily.tasksOf(save.data, day).map(t => t.progress), [0, 1, 12]);
});

test('weekly: 15 games on 4 active days → 300 once; a new week starts over', () => {
  const save = service();
  const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
  for (let i = 0; i < 15; i++) win(save, days[i % 4]);
  assert.equal(Daily.weeklyDone(save.data, '2026-11-05'), true);
  const honey = save.data.wallet.honey;
  Daily.claimWeekly(save, '2026-11-05');
  Daily.claimWeekly(save, '2026-11-05');
  assert.deepEqual([save.data.wallet.honey - honey, save.data.daily.stamps], [300, ['2026-11-02']]);
  assert.deepEqual(Daily.weeklyProgress(save.data, '2026-11-09'), { games: 0, activeDays: 0 });
});

test('sign-in: one cell per new login day, missed days kept, rewards in order, day 7 hat', () => {
  const save = service();
  save.transact(d => Daily.startDay(d, '2026-11-01'));
  save.transact(d => Daily.startDay(d, '2026-11-01'));
  assert.equal(save.data.daily.signinDays, 1);
  save.transact(d => Daily.startDay(d, '2026-11-04'));
  save.transact(d => Daily.startDay(d, '2026-10-30'));
  assert.equal(save.data.daily.signinDays, 2, 'clock moved back does not add a day');
  const before = { ...save.data.wallet };
  assert.deepEqual([Daily.claimSignin(save, '2026-11-04'), Daily.claimSignin(save, '2026-11-04')], [1, 2]);
  assert.throws(() => Daily.claimSignin(save, '2026-11-04'));
  assert.equal(save.data.wallet.honey - before.honey, 80);
  for (let i = 5; i <= 9; i++) { save.transact(d => Daily.startDay(d, `2026-11-0${i}`)); Daily.claimSignin(save, `2026-11-0${i}`); }
  assert.deepEqual([save.data.wallet.honey - before.honey, save.data.wallet.hints - before.hints, save.data.daily.outfits], [480, 2, ['picnic_hat']]);
  save.transact(d => Daily.startDay(d, '2026-11-10'));
  assert.equal(save.data.daily.signinDays, 7);
});

test('achievements: collect when reached, badges only', () => {
  const save = service();
  assert.throws(() => Daily.collectAchievement(save, 'garden'));
  save.transact(d => { d.garden.chapter = 1; });
  const honey = save.data.wallet.honey;
  Daily.collectAchievement(save, 'garden');
  assert.deepEqual([Daily.achievementCollected(save.data, 'garden'), save.data.wallet.honey], [true, honey]);
});

test('picnic: counts valid games only after the second garden, caps at 20, pays 100 once', () => {
  const save = service();
  win(save, 'd');
  save.transact(d => { d.garden.chapter = 1; });
  assert.equal(Daily.picnicPoints(save.data), 0, 'games before opening do not count');
  for (let i = 0; i < 25; i++) win(save, 'd');
  assert.equal(Daily.picnicPoints(save.data), 20);
  const honey = save.data.wallet.honey;
  Daily.claimPicnic(save);
  Daily.claimPicnic(save);
  assert.equal(save.data.wallet.honey - honey, 100);
});

test('red dots', () => {
  const save = service();
  const dots = Daily.dailyRedDots(save.data, '2026-11-05');
  assert.deepEqual(dots, { signin: true, tasks: false, event: false, achievement: false, mail: true, supply: true });
  save.transact(d => Daily.markMailRead(d, 'welcome'));
  assert.equal(Daily.dailyRedDots(save.data, '2026-11-05').mail, false);
});
