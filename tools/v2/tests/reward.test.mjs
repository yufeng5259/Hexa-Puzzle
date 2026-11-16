import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loader } from '../env.mjs';

// Reward display (docs/v2/09 §3.2, §4, §6): the queue is confirmed by id after a show, left-over
// page rewards get one summary, and the show timeline only presents what was saved.
const load = loader();
const { defaultRules } = load('assets/scripts/core/DefaultRules');
const { createState, clone } = load('assets/scripts/core/State');
const Display = load('assets/scripts/core/Display');
const Daily = load('assets/scripts/core/Daily');
const Endless = load('assets/scripts/core/Endless');
const Guide = load('assets/scripts/core/Guide');
const Main = load('assets/scripts/core/Mainline');
const T = load('assets/scripts/features/fx/RewardTimeline');

const rules = defaultRules(), t = rules.anim, DAY = '2026-11-09', WEEK = '2026-11-09';
const r = (coins, energy = 0, hints = 0) => ({ coins, energy, hints });
const ev = (id, type, reward = r(10)) => ({ id, type, reward, detail: type === 'levelUp' ? { level: Number(id.split(':')[1]) } : undefined });

test('claims return the event they queued, so the page confirms exactly that id', () => {
    const s = createState(rules);
    s.guide.completed = true;
    const sign = Daily.claimSignIn(s, rules, DAY);
    assert.deepEqual(sign, s.displayQueue.at(-1));
    Daily.refreshDaily(s, rules, DAY);
    for (const task of s.daily.tasks) task.progress = task.target;
    const task = Daily.claimDailyTask(s, rules, DAY, s.daily.tasks[0].id), chest = Daily.claimDailyChest(s, rules, DAY);
    assert.deepEqual([task.type, chest.type], ['dailyTask', 'dailyChest']);
    s.endless.weekId = WEEK; s.endless.weekScore = 600;
    assert.equal(Endless.claimEndlessStage(s, rules, WEEK, 0).id, `endlessStage:${WEEK}:0`);
    assert.deepEqual(s.displayQueue.map(e => e.id), [sign.id, task.id, chest.id, `endlessStage:${WEEK}:0`]);

    const w = createState(rules);
    w.mainline.cleared[1] = true; w.maps.levels.M01 = { B01: 1 };
    assert.deepEqual(Guide.claimWelcome(w, rules), w.displayQueue[0]);
    assert.equal(Main.winEventId('firstClear', 3, 'x'), 'firstClear:3');
    assert.equal(Main.winEventId('replay', 3, 'x'), 'replay:x');
});

test('a claim whose receipt was already paid returns null: nothing granted, nothing queued, nothing to show', () => {
    const s = createState(rules);
    s.guide.completed = true;
    assert.ok(Daily.claimSignIn(s, rules, DAY));
    const coins = s.wallet.coins, queued = s.displayQueue.length;
    s.signIn.claimedCount = 0; s.signIn.lastClaimDay = null; // same receipt id signIn:1 again
    assert.equal(Daily.claimSignIn(s, rules, '2026-11-10'), null);
    assert.equal(s.wallet.coins, coins);
    assert.equal(s.displayQueue.length, queued);
});

test('home queue: page rewards of this run are skipped, never removed', () => {
    const q = [ev('signIn:1', 'signIn'), ev('dailyTask:a', 'dailyTask')];
    assert.equal(Display.nextDisplay(q, () => false), null);
    const next = Display.nextDisplay([...q, ev('buildingMax:M01:B01', 'buildingMax')], () => false);
    assert.deepEqual(next.events.map(e => e.id), ['buildingMax:M01:B01']);
    assert.equal(next.kind, 'show');
});

test('home queue: page rewards left from an earlier run come back as one summary, in queue order', () => {
    const q = [ev('level:3', 'levelUp'), ev('signIn:1', 'signIn', r(50)), ev('firstClear:2', 'firstClear', r(100, 0, 1)), ev('welcome', 'welcome', r(0, 1))];
    const earlier = new Set(['signIn:1', 'firstClear:2', 'level:3']);
    const first = Display.nextDisplay(q, id => earlier.has(id));
    assert.equal(first.kind, 'show', 'the level up was first in the queue');
    const rest = Display.nextDisplay(q.slice(1), id => earlier.has(id));
    assert.equal(rest.kind, 'recover');
    assert.deepEqual(rest.events.map(e => e.id), ['signIn:1', 'firstClear:2'], 'the welcome of this run stays with its page');
    assert.deepEqual(Display.sumRewards(rest.events), r(150, 0, 1));
    assert.equal(Display.rewardText(Display.sumRewards(rest.events)), '金币+150 提示+1');
});

test('home queue: consecutive level ups merge into one dialog, other home rewards stay separate', () => {
    const q = [ev('level:2', 'levelUp'), ev('dailyTask:x', 'dailyTask'), ev('level:3', 'levelUp'), ev('mapComplete:M01', 'mapComplete'), ev('level:4', 'levelUp')];
    const next = Display.nextDisplay(q, () => false);
    assert.deepEqual(next.events.map(e => e.id), ['level:2', 'level:3']);
    assert.deepEqual(Display.nextDisplay(q.slice(3), () => false).events.map(e => e.id), ['mapComplete:M01']);
});

test('reward items: only non-zero parts, coins → energy → hints', () => {
    assert.deepEqual(T.rewardItems(r(0, 2, 1)).map(i => i.kind), ['energy', 'hints']);
    assert.deepEqual(T.rewardItems(r(100, 1, 1)).map(i => i.kind), ['coins', 'energy', 'hints']);
    assert.deepEqual(T.rewardItems(r(0)), []);
    assert.equal(T.particleCount({ kind: 'coins', amount: 10 }, 12), 3);
    assert.equal(T.particleCount({ kind: 'coins', amount: 5000 }, 12), 12);
    assert.equal(T.particleCount({ kind: 'energy', amount: 9 }, 12), 4);
    assert.equal(T.particleCount({ kind: 'hints', amount: 1 }, 12), 1);
});

test('single reward: card pops, particles fly within the budget, target pulses once and the value rolls to the real one', () => {
    const plan = T.planReward(T.rewardItems(r(100)), () => true, t);
    assert.equal(plan.cards.length, 1);
    assert.equal(plan.particles.length, 5);
    const a = plan.arrivals[0];
    assert.equal(a.kind, 'coins');
    assert.ok(a.last - plan.cards[0].start - t.cardSeconds <= 0.9 + 1e-9, 'all flying within about 0.9 s');
    assert.equal(T.rolledValue(400, 500, a, 0), 400);
    assert.equal(T.rolledValue(400, 500, a, a.last + 1), 500);
    const mid = T.rolledValue(400, 500, a, (a.first + a.last) / 2);
    assert.ok(mid > 400 && mid < 500);
    assert.equal(T.pulseScale(a, t, a.first - 0.01), 1);
    assert.ok(T.pulseScale(a, t, a.first + t.pulseSeconds / 2) > 1.09);
    assert.equal(T.pulseScale(a, t, a.first + t.pulseSeconds), 1);
    assert.equal(T.cardScale(plan.cards[0], t, -0.01), 0);
    assert.equal(T.cardScale(plan.cards[0], t, 0), 0.85);
    assert.equal(T.cardScale(plan.cards[0], t, t.cardSeconds), 1);
    assert.equal(plan.end, plan.settled + T.REWARD_FADE, 'nothing stays behind when everything flew');
});

test('mixed reward: cards staggered in order, each kind lands on its own target, a big coin reward is capped', () => {
    const plan = T.planReward(T.rewardItems(r(5000, 2, 1)), () => true, t);
    assert.deepEqual(plan.cards.map(c => c.start), [0, t.cardStaggerSeconds, 2 * t.cardStaggerSeconds]);
    assert.deepEqual(plan.arrivals.map(a => a.kind), ['coins', 'energy', 'hints']);
    assert.equal(plan.particles.filter(p => p.card === 0).length, t.coinParticlesMax);
    for (const card of [0, 1, 2]) {
        const lands = plan.particles.filter(p => p.card === card).map(p => p.land);
        assert.ok(Math.max(...lands) - (plan.cards[card].start + t.cardSeconds) <= 0.9 + 1e-9);
    }
    assert.ok(plan.end < t.rewardTimeoutSeconds, 'the timeout is only a guard');
    const chest = T.planReward(T.rewardItems(r(5000, 2, 1)), () => false, t, T.chestIntro(t));
    assert.equal(chest.cards[0].start, t.chestShakeSeconds + t.chestOpenSeconds, 'cards come out after the chest opened');
    assert.ok(chest.end < t.rewardTimeoutSeconds, 'chest with listed cards still ends before the guard');
});

test('no target: no particles, the card stays ticked a moment, other kinds still fly', () => {
    const plan = T.planReward(T.rewardItems(r(30, 0, 1)), kind => kind === 'coins', t);
    assert.deepEqual(plan.cards.map(c => c.flies), [true, false]);
    assert.ok(plan.particles.every(p => p.card === 0));
    assert.deepEqual(plan.arrivals.map(a => a.kind), ['coins']);
    assert.ok(plan.end > plan.settled + T.REWARD_FADE, 'a listed card stays readable before the fade');
    const none = T.planReward(T.rewardItems(r(0, 0, 3)), () => false, t);
    assert.deepEqual(none.particles, []);
    assert.equal(none.settled, t.cardSeconds);
});

test('zero reward ends at once without anything to show', () => {
    const ends = [];
    const run = new T.RewardRun(T.planReward([], () => true, t), t, reason => ends.push(reason));
    assert.deepEqual(ends, ['done']);
    assert.equal(run.finished, true);
    run.step(1); run.cancel();
    assert.deepEqual(ends, ['done']);
});

test('fast-forward only after skipAfter; repeated taps, timeout and cancel end the show exactly once', () => {
    const plan = T.planReward(T.rewardItems(r(100, 1)), () => true, t);
    const ends = [], run = new T.RewardRun(plan, t, reason => ends.push(reason));
    run.step(t.skipAfterSeconds / 2);
    assert.equal(run.skip(), false, 'too early: the tap is ignored');
    run.step(t.skipAfterSeconds);
    assert.equal(run.skip(), true);
    assert.equal(run.skip(), false);
    run.step(5); run.cancel();
    assert.deepEqual(ends, ['skip']);

    const done = [], natural = new T.RewardRun(plan, t, reason => done.push(reason));
    for (let i = 0; i < 400 && !natural.finished; i++) natural.step(1 / 60);
    assert.deepEqual(done, ['done']);

    const slow = { ...t, rewardTimeoutSeconds: 0.5 }, timeout = [];
    const guarded = new T.RewardRun(plan, slow, reason => timeout.push(reason));
    guarded.step(0.6);
    assert.deepEqual(timeout, ['timeout']);

    const gone = [], cancelled = new T.RewardRun(plan, t, reason => gone.push(reason));
    cancelled.cancel(); cancelled.cancel();
    assert.deepEqual(gone, ['cancel']);
});

test('display helpers never touch the reward they show', () => {
    const reward = Object.freeze(r(100, 1, 1)), copy = clone(reward);
    T.planReward(T.rewardItems(reward), () => true, t);
    Display.sumRewards([{ reward }]);
    assert.deepEqual(reward, copy);
});

test('S06 copy: first clear / challenge / replay name what was paid; a repeated win shows no empty card', () => {
    const coins = { coins: 100, energy: 0, hints: 0 }, mixed = { coins: 30, energy: 1, hints: 0 }, zero = { coins: 0, energy: 0, hints: 0 };
    assert.deepEqual(Display.winCopy('firstClear', 7, false, coins), { line: '第7关 · 首次通关', coins: 100, status: '金币已到账', card: true });
    assert.equal(Display.winCopy('firstClear', 7, true, coins).line, '第7关 · 挑战首次通关');
    assert.deepEqual(Display.winCopy('replay', 3, false, mixed), { line: '第3关 · 复玩完成', coins: 30, status: '金币+30 体力+1 已到账', card: true });
    assert.deepEqual(Display.winCopy('replay', 3, false, zero), { line: '第3关 · 复玩完成', coins: 0, status: null, card: false });
    assert.deepEqual(Display.winCopy('duplicate', 9, false, null), { line: '第9关 · 已完成', coins: 0, status: '本关奖励已发放', card: false });
});
