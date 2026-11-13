import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loader } from '../env.mjs';

const { HandLoop, DEFAULT_DRAG, approach } = loader()('assets/scripts/features/ui/GuideMotion');
const cycle = Object.values(DEFAULT_DRAG).reduce((a, b) => a + b, 0);

test('teaching drag re-reads its start point every loop (tray re-flow after a placement)', () => {
    let piece = { x: 300, y: -600 };
    const loop = new HandLoop(() => piece, () => ({ x: 0, y: 200 }));
    assert.deepEqual(loop.step(0).at, piece, 'first loop starts on the piece');
    piece = { x: 150, y: -600 }; // the tray slid the next piece left
    let pose;
    for (let t = 0; t < cycle + 0.05; t += 0.05) pose = loop.step(0.05);
    assert.deepEqual(pose.at, { x: 150, y: -600 }, 'next loop starts where the piece is now');
});

test('the hand waits hidden while a point is unavailable (tray still settling)', () => {
    let settling = true;
    const loop = new HandLoop(() => settling ? null : { x: 1, y: 2 }, () => ({ x: 9, y: 9 }));
    assert.equal(loop.step(0.1).visible, false);
    assert.equal(loop.step(0.1).visible, false);
    settling = false;
    const pose = loop.step(0.1);
    assert.equal(pose.visible, true);
    assert.deepEqual(pose.at, { x: 1, y: 2 });
});

test('drag timeline: press at the source, travel, release at the target, fade out', () => {
    const a = { x: 0, y: 0 }, b = { x: 100, y: 0 }, loop = new HandLoop(() => a, () => b);
    loop.step(0);
    const m = DEFAULT_DRAG, at = t => { const l = new HandLoop(() => a, () => b); l.step(0); return l.step(t); };
    assert.equal(at(m.sourceHold / 2).pressed, false);
    assert.equal(at(m.sourceHold + m.pressDuration / 2).pressed, true);
    const mid = at(m.sourceHold + m.pressDuration + m.dragDuration / 2);
    assert.ok(Math.abs(mid.at.x - 50) < 1e-9 && mid.pressed);
    const end = at(m.sourceHold + m.pressDuration + m.dragDuration + m.destinationHold / 2);
    assert.deepEqual(end.at, b); assert.equal(end.pressed, false);
    assert.ok(at(m.sourceHold + m.pressDuration + m.dragDuration + m.destinationHold + m.fadeDuration / 2).opacity < 255);
    assert.equal(at(cycle - 0.01).visible, false, 'hidden during the loop delay');
});

test('restart() returns to the first frame and re-reads the target', () => {
    let p = { x: 5, y: 5 };
    const loop = new HandLoop(() => p, null);
    loop.step(0); loop.step(0.4);
    p = { x: 50, y: 50 };
    loop.restart();
    assert.deepEqual(loop.step(0.2).at, p);
});

test('dim fade approaches its target without overshoot', () => {
    assert.equal(approach(0, 150, 900, 0.1), 90);
    assert.equal(approach(100, 150, 900, 0.1), 150);
    assert.equal(approach(150, 0, 900, 0.1), 60);
});
