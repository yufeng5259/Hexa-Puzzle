import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loader } from '../env.mjs';

// Puzzle board finishes (docs/v2/09 §5.1, §5.2): the win wave spreads from the last piece by hex
// distance and ends at a stable pose; the failure sway stays within its bound and ends at rest.
const load = loader();
const { defaultRules } = load('assets/scripts/core/DefaultRules');
const W = load('assets/scripts/features/fx/WinTimeline');
const t = defaultRules().anim;
const line = n => Array.from({ length: n }, (_, q) => ({ q, r: 0 }));

test('hex distance is the axial cube distance', () => {
    assert.equal(W.hexDistance({ q: 0, r: 0 }, { q: 2, r: -1 }), 2);
    assert.equal(W.hexDistance({ q: 1, r: 1 }, { q: -1, r: 2 }), 2);
    assert.equal(W.hexDistance({ q: 3, r: -3 }, { q: 3, r: -3 }), 0);
});

test('the wave starts at the last piece and reaches the farthest cell last, within the configured time', () => {
    const plan = W.planWave(line(6), [{ q: 0, r: 0 }], t);
    const starts = plan.cells.map(c => c.start);
    assert.equal(starts[0], t.winHoldSeconds);
    for (let i = 1; i < starts.length; i++) assert.ok(starts[i] > starts[i - 1]);
    assert.ok(starts.at(-1) + plan.cellSeconds <= plan.end + 1e-9);
    assert.equal(plan.end, t.winHoldSeconds + t.winWaveSeconds);
    // Cells of the last piece share distance 0; no origin starts every cell together.
    assert.ok(W.planWave(line(4), [{ q: 0, r: 0 }, { q: 1, r: 0 }], t).cells.slice(0, 2).every(c => c.start === t.winHoldSeconds));
    assert.ok(W.planWave(line(4), [], t).cells.every(c => c.start === t.winHoldSeconds));
});

test('bounce and glow are visual only and return to rest', () => {
    const plan = W.planWave(line(3), [{ q: 0, r: 0 }], t);
    for (const c of plan.cells) {
        assert.equal(W.bounceScale(W.cellProgress(c, plan, 0)), 1);
        assert.equal(W.bounceScale(W.cellProgress(c, plan, plan.end)), 1);
        assert.equal(W.glowAlpha(W.cellProgress(c, plan, plan.end)), 0);
    }
    let peak = 0;
    for (let k = 0; k <= 1; k += 0.01) peak = Math.max(peak, W.bounceScale(k));
    assert.ok(peak > 1 && peak <= 1 + W.BOUNCE + 1e-9);
});

test('failure dims to full and sways once within bounds, ending at rest', () => {
    assert.equal(W.failDim(0, t), 0);
    assert.equal(W.failDim(t.failSeconds, t), 1);
    assert.equal(W.failShake(0, t), 0);
    assert.equal(W.failShake(t.failSeconds, t), 0);
    for (let a = 0; a <= t.failSeconds; a += t.failSeconds / 50) assert.ok(Math.abs(W.failShake(a, t)) <= W.SHAKE + 1e-9);
});

test('board finish timings come from config', () => {
    for (const k of ['winHoldSeconds', 'winWaveSeconds', 'resultEnterSeconds', 'failSeconds', 'boardFadeSeconds', 'firstWinLimitSeconds']) assert.ok(t[k] > 0, k);
    assert.equal(t.firstWinLimitSeconds, 2.2);
});
