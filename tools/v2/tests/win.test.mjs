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

// Win celebration timeline (docs/v2/10 §4.1).
test('win marks follow the configured stages: celebrate, coins, then the bar; the effect outlasts the bar slide', () => {
    const m = W.winMarks(t);
    assert.deepEqual([t.winHoldSeconds, t.winFlashSeconds, t.winCelebrateAt, t.winCoinsAt, t.winBarAt], [0.15, 0.1, 0.6, 1.2, 1.9]);
    assert.ok(t.winHoldSeconds < m.celebrate && m.celebrate < m.coins && m.coins < m.bar && m.bar < m.barDone && m.barDone <= m.end);
    assert.equal(t.winConfettiCount, 40);
});

test('punch 1 → 1.03 → 1 and the flash end within their time', () => {
    assert.equal(W.punchScale(0, t), 1);
    assert.equal(W.punchScale(t.winHoldSeconds, t), 1);
    assert.ok(Math.abs(W.punchScale(t.winHoldSeconds / 2, t) - 1.03) < 1e-9);
    assert.ok(W.flashAlpha(0, t) > 0);
    assert.equal(W.flashAlpha(t.winFlashSeconds, t), 0);
});

test('outer ring: only edge cells, each once, in order around the shape', () => {
    const disc = [{ q: 0, r: 0 }, ...[[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]].map(([q, r]) => ({ q, r }))];
    const ring = W.outerRing(disc);
    assert.equal(ring.length, 6);
    assert.ok(!ring.some(c => c.q === 0 && c.r === 0), 'centre is inside');
    assert.equal(W.outerRing(line(3)).length, 3);
    // Lit one after another during the wave, all lit before the celebration, gone once the bar is in.
    const n = ring.length, lit = at => ring.map((_, i) => W.rimAlpha(i, n, at, t));
    assert.ok(lit(t.winHoldSeconds + 0.01).filter(a => a > 0).length < n);
    assert.ok(lit(t.winHoldSeconds + t.winWaveSeconds).every(a => a === 1));
    assert.ok(lit(t.winBarAt + t.winBarSeconds).every(a => a === 0));
    assert.equal(W.shineProgress(t.winHoldSeconds - 0.01, t), -1);
    assert.equal(W.shineProgress(t.winHoldSeconds + t.winWaveSeconds, t), 1);
});

test('ribbon pops and stays; fireworks run 6 frames at 12 fps; the bar slides from 1 to 0', () => {
    assert.equal(W.ribbonScale(t.winCelebrateAt, t), 0);
    assert.equal(W.ribbonScale(t.winCelebrateAt + 5, t), 1);
    assert.equal(W.fireworkFrame(0.99, 1), -1);
    assert.equal(W.fireworkFrame(1, 1), 0);
    assert.equal(W.fireworkFrame(1 + 5.5 / 12, 1), 5);
    assert.equal(W.fireworkFrame(1 + 6 / 12, 1), -1);
    assert.equal(W.barOffset(t.winBarAt, t), 1);
    assert.equal(W.barOffset(t.winBarAt + t.winBarSeconds, t), 0);
});

test('confetti: half from each lower corner, thrown up and inwards, gone before the effect ends', () => {
    let seed = 1;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pieces = W.confettiPieces(t.winConfettiCount, rand), end = W.winMarks(t).end;
    assert.equal(pieces.length, 40);
    assert.equal(pieces.filter(c => c.side < 0).length, 20);
    for (const c of pieces) {
        assert.ok(c.vy > 0 && Math.sign(c.vx) === -c.side);
        assert.equal(W.confettoPose(c, t.winCelebrateAt + c.delay - 0.01, t), null);
        assert.ok(W.confettoPose(c, t.winCelebrateAt + c.delay + 0.2, t).y > 0);
        assert.equal(W.confettoPose(c, end, t), null);
    }
});
