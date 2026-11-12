import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loader } from '../env.mjs';

const load = loader();
const { defaultRules, puzzleIdFor } = load('assets/scripts/core/DefaultRules');
const { Store } = load('assets/scripts/core/Store');
const { SAVE_KEY } = load('assets/scripts/core/State');
const Energy = load('assets/scripts/core/Energy');
const Main = load('assets/scripts/core/Mainline');
const Prog = load('assets/scripts/core/Progress');
const Daily = load('assets/scripts/core/Daily');
const Guide = load('assets/scripts/core/Guide');
const Clock = load('assets/scripts/core/Clock');

const MIN = 60000, T0 = Date.UTC(2026, 10, 9, 2); // Monday 10:00 at UTC+8
const DAY = '2026-11-09';
function memory() { const data = new Map(); return { data, fail: false, getItem: k => data.get(k) ?? null, setItem(k, v) { if (this.fail) throw new Error('disk full'); data.set(k, v); } }; }
const rules = defaultRules();
const fresh = () => { const storage = memory(); return { storage, store: new Store(storage, rules) }; };

/** Clears level 1 and finishes the guide build + welcome, like a real first run. */
function finishGuide(store) {
    store.commit(s => Main.startAttempt(s, rules, T0, 1, 'a1'));
    store.commit(s => Main.completeAttempt(s, rules, 'a1', DAY));
    store.commit(s => Prog.startBuild(s, rules, 'M01', 'B01', 'b1'));
    store.commit(s => Prog.finishBuild(s, rules, 'b1', DAY));
    store.commit(s => Guide.claimWelcome(s, rules));
}

test('mainline order maps to the 110 catalog puzzles', () => {
    assert.equal(puzzleIdFor(1), 'classic-001');
    assert.equal(puzzleIdFor(5), 'classic-005');
    assert.equal(puzzleIdFor(6), 'challenge-001');
    assert.equal(puzzleIdFor(7), 'classic-006');
    assert.equal(puzzleIdFor(95), 'classic-080');
    assert.equal(puzzleIdFor(96), 'challenge-016');
    assert.equal(puzzleIdFor(110), 'challenge-030');
    assert.equal(new Set(rules.mainline.map(l => l.puzzleId)).size, 110);
});

test('a failed write leaves state and storage untouched', () => {
    const { storage, store } = fresh();
    storage.fail = true;
    assert.throws(() => store.commit(s => Main.startAttempt(s, rules, T0, 1, 'a1')));
    assert.equal(store.state.mainline.attempt, null);
    assert.equal(storage.data.has(SAVE_KEY), false);
    storage.fail = false;
    store.commit(s => Main.startAttempt(s, rules, T0, 1, 'a1'));
    assert.equal(new Store(storage, rules).state.mainline.attempt.attemptId, 'a1');
});

test('energy: first level free, recovery every 300s, paused at max, no gain from clock rollback', () => {
    const { store } = fresh();
    store.commit(s => Main.startAttempt(s, rules, T0, 1, 'a1'));
    assert.equal(store.state.energy.value, 5);
    store.commit(s => Main.completeAttempt(s, rules, 'a1', DAY));
    store.commit(s => Main.startAttempt(s, rules, T0, 2, 'a2'));
    assert.equal(store.state.energy.value, 4);
    store.commit(s => Energy.settleEnergy(s, rules, T0 + 4 * MIN));
    assert.equal(store.state.energy.value, 4);
    assert.equal(Energy.secondsToNextEnergy(store.state, rules, T0 + 4 * MIN), 60);
    // spending again keeps the running countdown
    store.commit(s => Energy.spendEnergy(s, rules, T0 + 4 * MIN, 1));
    store.commit(s => Energy.settleEnergy(s, rules, T0 + 5 * MIN));
    assert.equal(store.state.energy.value, 4);
    store.commit(s => Energy.settleEnergy(s, rules, T0 - 60 * MIN));
    assert.equal(store.state.energy.value, 4);
    store.commit(s => Energy.settleEnergy(s, rules, T0 + 600 * MIN));
    assert.equal(store.state.energy.value, 5);
    assert.equal(store.state.energy.anchor, null);
});

test('mainline: no energy keeps the old attempt; win pays once; replay pays lower reward', () => {
    const { store } = fresh();
    store.commit(s => { s.energy.value = 0; s.mainline.cleared[1] = true; s.mainline.nextLevelNo = 2; });
    store.commit(s => { s.mainline.attempt = { attemptId: 'old', levelNo: 2, mode: 'main', board: { saved: 1 } }; });
    assert.throws(() => store.commit(s => Main.startAttempt(s, rules, T0, 2, 'new')), /energy/i);
    assert.equal(store.state.mainline.attempt.attemptId, 'old');
    assert.equal(store.commit(s => Main.completeAttempt(s, rules, 'old', DAY)), 'firstClear');
    assert.equal(store.state.wallet.coins, 100);
    assert.equal(store.commit(s => Main.completeAttempt(s, rules, 'old', DAY)), 'duplicate');
    assert.equal(store.state.wallet.coins, 100);
    assert.equal(store.state.mainline.nextLevelNo, 3);
    store.commit(s => { s.energy.value = 1; });
    store.commit(s => Main.startAttempt(s, rules, T0, 2, 'r1'));
    assert.equal(store.state.mainline.attempt.mode, 'replay');
    assert.equal(store.commit(s => Main.completeAttempt(s, rules, 'r1', DAY)), 'replay');
    assert.equal(store.state.wallet.coins, 120);
    assert.equal(store.state.mainline.nextLevelNo, 3);
});

test('guide resumes from real records and welcome is granted once with guide completion', () => {
    const { store } = fresh();
    assert.equal(Guide.guideStep(store.state, rules), 'firstPuzzle');
    store.commit(s => Main.startAttempt(s, rules, T0, 1, 'a1'));
    store.commit(s => Main.completeAttempt(s, rules, 'a1', DAY));
    assert.equal(Guide.guideStep(store.state, rules), 'goBuild');
    assert.equal(Guide.guideAllowsBuild(store.state, rules, 'B02'), false);
    store.commit(s => Prog.startBuild(s, rules, 'M01', 'B01', 'b1'));
    assert.equal(Guide.guideStep(store.state, rules), 'finishBuild');
    store.commit(s => Prog.finishBuild(s, rules, 'b1', DAY));
    assert.equal(Guide.guideStep(store.state, rules), 'welcome');
    store.commit(s => Guide.claimWelcome(s, rules));
    assert.equal(store.state.wallet.coins, 100 - 40 + 100);
    assert.equal(store.state.wallet.hints, 6);
    assert.throws(() => store.commit(s => Guide.claimWelcome(s, rules)));
    assert.equal(Guide.guideStep(store.state, rules), 'done');
});

test('build is two-step: pay once, interrupted build finishes without a second charge', () => {
    const { storage, store } = fresh();
    store.commit(s => { s.wallet.coins = 100; });
    store.commit(s => Prog.startBuild(s, rules, 'M01', 'B02', 'b1'));
    assert.equal(store.state.wallet.coins, 60);
    assert.throws(() => store.commit(s => Prog.startBuild(s, rules, 'M01', 'B03', 'b2')), /progress/);
    const reopened = new Store(storage, rules); // app killed during construction
    assert.equal(reopened.state.pendingBuild.buildId, 'b1');
    reopened.commit(s => Prog.finishBuild(s, rules, 'b1', DAY));
    assert.equal(reopened.state.maps.levels.M01.B02, 1);
    assert.equal(reopened.state.wallet.coins, 60);
    assert.equal(reopened.state.player.exp, 20);
    assert.throws(() => reopened.commit(s => Prog.finishBuild(s, rules, 'b1', DAY)));
    assert.throws(() => reopened.commit(s => { s.wallet.coins = 0; Prog.startBuild(s, rules, 'M01', 'B02', 'b3'); }), /coins/);
});

test('25/25 completes the map once with building-max and level rewards, then moves to map 2', () => {
    const { store } = fresh();
    store.commit(s => { s.wallet.coins = 2000; });
    let n = 0;
    for (const b of rules.maps[0].buildings) for (let lv = 0; lv < 5; lv++) {
        const id = `b${n++}`;
        store.commit(s => Prog.startBuild(s, rules, 'M01', b.id, id));
        store.commit(s => Prog.finishBuild(s, rules, id, DAY));
    }
    const s = store.state;
    assert.deepEqual(Prog.mapProgress(s, rules, 'M01'), { built: 25, total: 25 });
    assert.equal(s.maps.completed.M01, true);
    assert.equal(s.player.level, 6); // 500 exp
    assert.equal(s.wallet.coins, 5 * 30 + 200);
    assert.equal(s.wallet.hints, 5 + 1); // level 6 bonus hint
    assert.equal(s.energy.value, 5 + 5);
    const types = s.displayQueue.map(e => e.type);
    assert.equal(types.filter(t => t === 'buildingMax').length, 5);
    assert.equal(types.at(-1), 'mapComplete');
    assert.throws(() => store.commit(st => Prog.startBuild(st, rules, 'M01', 'B01', 'x')));
    assert.equal(store.commit(st => Prog.goToNextMap(st, rules)), true);
    assert.equal(Prog.upgradeCost(store.state, rules, 'M02', 'B06'), 64);
});

test('sign-in is cumulative: one claim per day, missed days not lost, seventh then restarts', () => {
    const { store } = fresh();
    finishGuide(store);
    const coins = store.state.wallet.coins;
    store.commit(s => Daily.claimSignIn(s, rules, '2026-11-09'));
    assert.throws(() => store.commit(s => Daily.claimSignIn(s, rules, '2026-11-09')), /today/);
    assert.throws(() => store.commit(s => Daily.claimSignIn(s, rules, '2026-11-08')), /today/); // clock rolled back
    store.commit(s => Daily.claimSignIn(s, rules, '2026-11-12')); // skipped days
    assert.equal(store.state.signIn.claimedCount, 2);
    assert.equal(store.state.wallet.coins, coins + 50);
    assert.equal(store.state.energy.value >= 1, true);
    for (let d = 13; d <= 17; d++) store.commit(s => Daily.claimSignIn(s, rules, `2026-11-${d}`));
    assert.equal(Daily.signInSlot(store.state, rules), 0);
});

test('daily tasks: unlocked after guide, count wins and builds, chest after all three, expire next day', () => {
    const { store } = fresh();
    finishGuide(store); // the guide build happened before unlock and is not counted
    store.commit(s => Daily.refreshDaily(s, rules, DAY));
    assert.deepEqual(store.state.daily.tasks.map(t => t.id), ['win_1', 'win_3', 'build_1']);
    assert.equal(store.state.daily.tasks[2].progress, 0);
    store.commit(s => { s.energy.value = 10; });
    for (let i = 2; i <= 4; i++) {
        store.commit(s => Main.startAttempt(s, rules, T0, i, `a${i}`));
        store.commit(s => Main.completeAttempt(s, rules, `a${i}`, DAY));
    }
    assert.throws(() => store.commit(s => Daily.claimDailyChest(s, rules, DAY)), /complete/);
    store.commit(s => Prog.startBuild(s, rules, 'M01', 'B02', 'bx'));
    store.commit(s => Prog.finishBuild(s, rules, 'bx', DAY));
    for (const id of ['win_1', 'win_3', 'build_1']) store.commit(s => Daily.claimDailyTask(s, rules, DAY, id));
    store.commit(s => Daily.claimDailyChest(s, rules, DAY));
    assert.throws(() => store.commit(s => Daily.claimDailyTask(s, rules, DAY, 'win_1')), /claimed/);
    store.commit(s => Daily.refreshDaily(s, rules, '2026-11-10'));
    assert.equal(store.state.daily.chestClaimed, false);
    assert.equal(store.state.daily.tasks.every(t => t.progress === 0), true);
});

test('daily rotation: endless tasks once endless opens, fallback when nothing else applies', () => {
    const { store } = fresh();
    finishGuide(store);
    store.commit(s => { s.mainline.cleared[5] = true; });
    store.commit(s => Daily.refreshDaily(s, rules, DAY));
    assert.match(store.state.daily.tasks[2].type, /endless|build/);
    const allDone = JSON.parse(JSON.stringify(store.state));
    allDone.mainline.cleared = { 1: true };
    allDone.maps.currentMapId = 'M03';
    allDone.maps.completed.M03 = true;
    assert.equal(Daily.pickDailyTasks(allDone, rules, DAY)[2].id, 'place_10');
});

test('clock: local day and Monday-based week ids', () => {
    assert.equal(Clock.dayId(T0, 480), '2026-11-09');
    assert.equal(Clock.dayId(Date.UTC(2026, 10, 9, 16, 30), 480), '2026-11-10');
    assert.equal(Clock.weekId(Date.UTC(2026, 10, 15, 15), 480), '2026-11-09'); // Sunday 23:00
    assert.equal(Clock.weekId(Date.UTC(2026, 10, 15, 16), 480), '2026-11-16'); // Monday 0:00
    assert.equal(Clock.msUntilNextDay(Date.UTC(2026, 10, 9, 15, 59), 480), MIN);
    assert.equal(Clock.msUntilNextWeek(Date.UTC(2026, 10, 15, 15, 59), 480), MIN);
});

test('corrupt or foreign saves start a fresh state', () => {
    const storage = memory();
    storage.data.set(SAVE_KEY, '{"schemaVersion":1}');
    assert.equal(new Store(storage, rules).state.wallet.hints, 5);
    storage.data.set(SAVE_KEY, 'not json');
    assert.equal(new Store(storage, rules).state.revision, 0);
});
