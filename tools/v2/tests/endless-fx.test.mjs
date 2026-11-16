import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loader } from '../env.mjs';

// Endless placement and end-of-game timing (docs/v2/09 §7.1, §8): lines clear along their axis,
// a crossing cell clears once, refill and input wait for the clear, the result rolls up to the
// saved score and only a record pops the badge.
const load = loader();
const { defaultRules } = load('assets/scripts/core/DefaultRules');
const T = load('assets/scripts/features/fx/EndlessTimeline');
const t = defaultRules().anim;
const row = (r, n) => Array.from({ length: n }, (_, q) => `${q},${r}`);

test('no line: the piece settles, "+score" rises, a refill slides in after the settle', () => {
    const plan = T.planPlace({ lines: [], score: 3, refillSlots: [0, 1, 2] }, t);
    assert.equal(plan.highlight, null);
    assert.equal(plan.cells.length, 0);
    assert.equal(plan.clearEnd, t.endlessSettleSeconds);
    assert.equal(plan.score.start, t.endlessSettleSeconds);
    assert.deepEqual(plan.refill.map(r => r.slot), [0, 1, 2]);
    assert.ok(plan.refill.every((r, i) => i === 0 || r.start > plan.refill[i - 1].start), 'staggered');
    assert.equal(plan.inputEnd, plan.refill[2].start + plan.refillSeconds);
    assert.ok(plan.end >= plan.inputEnd);
    // No refill: input is back right after the settle.
    assert.equal(T.planPlace({ lines: [], score: 1, refillSlots: [] }, t).inputEnd, t.endlessSettleSeconds);
    assert.equal(T.planPlace({ lines: [], score: 0, refillSlots: [] }, t).score, null);
});

test('one line: highlight, then the light flows along the line; one clear per cell', () => {
    const line = row(0, 9), plan = T.planPlace({ lines: [line], score: 200, refillSlots: [] }, t);
    assert.equal(plan.highlight.start, t.endlessSettleSeconds);
    assert.equal(plan.highlight.end, t.endlessSettleSeconds + t.endlessHighlightSeconds);
    assert.deepEqual(plan.cells.map(c => c.key), line);
    for (let i = 1; i < plan.cells.length; i++) assert.ok(plan.cells[i].start > plan.cells[i - 1].start);
    assert.equal(plan.cells[0].start, plan.highlight.end);
    assert.ok(plan.cells.at(-1).start + plan.cellSeconds <= plan.clearEnd + 1e-9);
    assert.ok(plan.end <= 0.8 + 1e-9, `single line within 0.8 s, got ${plan.end}`);
    assert.ok(plan.end >= 0.45, 'a clear is noticeable');
});

test('crossing lines: the shared cell clears once, at its earliest turn; multi-line stays within 0.8 s', () => {
    const a = row(0, 9), b = Array.from({ length: 9 }, (_, i) => `4,${i - 4}`); // crosses a at "4,0" (index 4 of 9 in both)
    const plan = T.planPlace({ lines: [a, b, row(2, 4)], score: 500, refillSlots: [0, 1, 2] }, t);
    const keys = plan.cells.map(c => c.key);
    assert.equal(keys.length, new Set(keys).size);
    assert.equal(keys.length, 9 + 9 - 1 + 4);
    assert.equal(plan.cells.find(c => c.key === '4,0').start, plan.highlight.end + 4 / 8 * T.SWEEP);
    // A cell early on one line and late on another starts at its earliest turn.
    const c = T.planPlace({ lines: [row(0, 5), ['0,4', '0,3', '0,2', '0,1', '0,0']], score: 1, refillSlots: [] }, t);
    assert.equal(c.cells.find(x => x.key === '0,0').start, c.highlight.end);
    assert.ok(plan.end <= 0.8 + 1e-9, `multi-line within 0.8 s, got ${plan.end}`);
    assert.ok(plan.refill.every(r => r.start >= plan.clearEnd), 'refill waits for the clear');
    assert.ok(plan.score.start > plan.highlight.end && plan.score.start < plan.clearEnd);
});

test('glow is capped, ghosts shrink to 0.75 and vanish, burst frames run 0..5 then hide', () => {
    const plan = T.planPlace({ lines: [row(0, 5), row(1, 5)], score: 100, refillSlots: [] }, t);
    for (let at = 0; at <= plan.end; at += 0.01) for (const c of plan.cells) {
        const g = T.lineGlow(c, plan, at);
        assert.ok(g >= 0 && g <= 1);
    }
    assert.equal(T.lineGlow(plan.cells[0], plan, 0), 0);
    assert.equal(T.lineGlow(plan.cells[0], plan, plan.highlight.end), 1);
    assert.equal(T.lineGlow(plan.cells[0], plan, plan.clearEnd), 0);
    assert.equal(T.ghostScale(0), 1); assert.equal(T.ghostScale(1), 0.75);
    assert.equal(T.ghostAlpha(0), 1); assert.equal(T.ghostAlpha(1), 0);
    assert.equal(T.burstFrame(0), -1); assert.equal(T.burstFrame(1), -1);
    assert.equal(T.burstFrame(0.01), 0); assert.equal(T.burstFrame(0.99), T.BURST_FRAMES - 1);
    assert.equal(T.settleScale(plan, 0), 1.08); assert.equal(T.settleScale(plan, plan.settleEnd), 1);
});

test('"+score" floats then arrives; the score bar pulses once; slides end in place', () => {
    const plan = T.planPlace({ lines: [row(0, 5)], score: 70, refillSlots: [1] }, t);
    assert.equal(T.floatPose(plan, plan.score.start - 0.01), null);
    assert.equal(T.floatPose(plan, plan.score.end), null);
    const mid = T.floatPose(plan, (plan.score.start + plan.score.end) / 2);
    assert.ok(mid.dy > 0 && mid.dy < T.RISE && mid.alpha === 1);
    assert.equal(T.scoreArrived(plan, plan.score.end - 1e-3), false);
    assert.equal(T.scoreArrived(plan, plan.score.end), true);
    assert.ok(T.scorePulse(plan, plan.score.end + T.PULSE / 2) > 1);
    assert.equal(T.scorePulse(plan, plan.score.end + T.PULSE), 1);
    const r = plan.refill[0];
    assert.equal(T.slideIn(r.start, plan, r.start - 0.01).alpha, 0);
    assert.deepEqual(T.slideIn(r.start, plan, r.start + plan.refillSeconds), { dy: 0, alpha: 1 });
    assert.equal(T.floatText(70, 1), '+70');
    assert.equal(T.floatText(500, 3), '3线消除 +500');
});

test('result: ended game dims, rolls to the saved score, record pops the badge after the roll', () => {
    const plan = T.planResult({ score: 1540, record: true, abandoned: false, claimable: true }, t);
    assert.equal(plan.board, t.endlessDimSeconds);
    assert.equal(plan.roll.start, t.resultEnterSeconds);
    assert.equal(plan.roll.end, t.resultEnterSeconds + t.scoreRollSeconds);
    assert.equal(plan.badge.start, plan.roll.end);
    assert.equal(plan.badge.end, plan.roll.end + t.recordSeconds);
    assert.equal(plan.notice.start, plan.badge.end);
    assert.equal(plan.end, plan.notice.end);
    let last = 0;
    for (let at = 0; at <= plan.end + 0.1; at += 0.02) {
        const v = T.rolledScore(plan, 1540, at);
        assert.ok(v >= last && v <= 1540); last = v;
    }
    assert.equal(T.rolledScore(plan, 1540, plan.roll.end), 1540);
    assert.equal(T.badgeScale(plan, plan.badge.start - 0.01), 0);
    assert.ok(T.badgeScale(plan, (plan.badge.start + plan.badge.end) / 2) > 1);
    assert.equal(T.badgeScale(plan, plan.badge.end), 1);
    assert.equal(T.boardDim(plan, 0), 0); assert.equal(T.boardDim(plan, plan.board), 1);
});

test('result: no record, abandoned and zero games do not celebrate or roll', () => {
    const plain = T.planResult({ score: 800, record: false, abandoned: false, claimable: false }, t);
    assert.equal(plain.badge, null); assert.equal(plain.notice, null);
    assert.equal(plain.end, plain.roll.end);
    assert.equal(T.badgeScale(plain, 99), 0);
    const quit = T.planResult({ score: 800, record: true, abandoned: true, claimable: false }, t);
    assert.equal(quit.roll, null); assert.equal(quit.badge, null);
    assert.equal(quit.board, t.boardFadeSeconds);
    assert.equal(T.rolledScore(quit, 800, 0), 800, 'shown at once');
    const zero = T.planResult({ score: 0, record: false, abandoned: false, claimable: false }, t);
    assert.equal(zero.roll, null);
    assert.equal(zero.end, t.resultEnterSeconds);
});

test('confetti is deterministic, bounded and gone at the end', () => {
    const a = T.confetti(10), b = T.confetti(10);
    assert.deepEqual(a, b);
    assert.equal(a.length, 10);
    for (const c of a) {
        assert.ok(Math.hypot(c.dx, c.dy) <= 200);
        assert.deepEqual(T.confettoPose(c, 0), { x: 0, y: 0, angle: 0, alpha: 1 });
        assert.equal(T.confettoPose(c, 1).alpha, 0);
    }
});
