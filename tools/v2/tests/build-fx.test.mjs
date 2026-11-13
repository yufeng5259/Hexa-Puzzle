import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loader, PROJECT } from '../env.mjs';

const fx = loader()('assets/scripts/features/fx/FxTimeline');
const data = JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/bundles/ui/config/build-fx.json'), 'utf8'));
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);

test('clip tracks: held before/after, linear between keys', () => {
    const keys = [[0.2, 0], [0.4, 100], [1, 50]];
    assert.deepEqual(fx.sampleTrack(keys, 0), [0]);
    near(fx.sampleTrack(keys, 0.3)[0], 50);
    near(fx.sampleTrack(keys, 0.7)[0], 75);
    assert.deepEqual(fx.sampleTrack(keys, 5), [50]);
});

test('spine curves: linear, stepped and bezier ease', () => {
    near(fx.bezier(undefined, 0.3), 0.3);
    assert.equal(fx.bezier('stepped', 0.9), 0);
    const ease = [0.25, 0, 1, 0.99];
    near(fx.bezier(ease, 0), 0, 1e-4); near(fx.bezier(ease, 1), 0.99 + 0.01, 0.02);
    assert.ok(fx.bezier(ease, 0.5) < 0.5, 'ease-in curve starts slow');
});

test('migrated data: all textures registered, every slot/attachment resolvable', () => {
    const registry = new Set(JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/resources/config/resource-registry.json'), 'utf8')).resources.map(r => r.id));
    assert.ok(registry.has('fx.build'));
    for (const s of Object.values(data.sprites)) assert.ok(registry.has(s.asset), s.asset);
    assert.ok(registry.has(data.particle.asset));
    for (const slot of data.skeleton.slots) for (const a of Object.values(data.skeleton.attachments[slot.name] ?? {})) assert.ok(registry.has(a.asset), a.asset);
    assert.equal(data.skeleton.slots.length, 16);
    assert.equal(data.duration, 2);
});

test('skeleton: setup pose at 0, hammer swings, hidden smoke appears later, finishes by the effect end', () => {
    const sk = data.skeleton, length = fx.skeletonLength(sk);
    near(length, 2.5);
    assert.ok(length / sk.timeScale < data.duration, 'tools finish before the effect is removed');
    const at = t => Object.fromEntries(fx.sampleSkeleton(sk, t).map(p => [p.slot, p]));
    const start = at(0), mid = at(0.15);
    assert.equal(start.hammer.attachment, 'hammer');
    assert.notEqual(Math.round(start.hammer.angle), Math.round(mid.hammer.angle), 'hammer rotates');
    assert.equal(start['smoke particle'].attachment, null, 'smoke slot starts empty (attachment key at 0)');
    assert.equal(at(1.3)['smoke particle'].attachment, 'smoke particle');
    for (const p of fx.sampleSkeleton(sk, 0.7)) for (const v of [p.x, p.y, p.angle, p.scaleX, p.scaleY, ...p.color]) assert.ok(Number.isFinite(v));
});

test('matrix decompose keeps the original node scale (0.5) on an unrotated bone chain', () => {
    const sk = { offset: [10, 20], scale: [0.5, 0.5], timeScale: 1, bones: [{ name: 'root', parent: null, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, { name: 'b', parent: 'root', x: 100, y: 0, rotation: 90, scaleX: 1, scaleY: 1 }],
        slots: [{ name: 's', bone: 'b', attachment: 'r', color: 'ffffff80' }], attachments: { s: { r: { asset: 'x', x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1, width: 4, height: 2 } } }, animation: {} };
    const [p] = fx.sampleSkeleton(sk, 0);
    near(p.x, 10 + 0.5 * 100); near(p.y, 20 + 0.5 * 10); near(p.angle, 90); near(p.scaleX, 0.5); near(p.scaleY, 0.5);
    near(p.color[3], 0x80 / 255);
});
