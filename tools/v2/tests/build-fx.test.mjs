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

test('tuned skeleton: tools reach the configured fraction of the building, smoke 1.5×, source untouched', () => {
    const before = JSON.stringify(data.skeleton), tuning = { toolFraction: 0.6, toolSpread: 1, smokeScale: 1.5 }; // spread 1: positions follow width/s only
    for (const width of [367, 546]) {
        const s = Math.max(0.55, Math.min(1.2, width / 420)), sk = fx.tuneBuildSkeleton(data.skeleton, width, s, tuning);
        for (const tool of ['hammer', 'saw']) {
            const a = sk.attachments[tool][tool], o = data.skeleton.attachments[tool][tool], k = a.width / o.width;
            near(Math.max(a.width, a.height) * sk.scale[0] * s, 0.6 * width, 1e-6);
            near(a.height / o.height, k); near(a.x / o.x, k); near(a.y / o.y, k); // swing radius grows with the tool
            assert.ok(k > 2, `${tool} grows: ${k}`);
        }
        const smoke = sk.slots.find(x => x.name.startsWith('smoke')).name, name = Object.keys(sk.attachments[smoke])[0];
        near(sk.attachments[smoke][name].width / data.skeleton.attachments[smoke][name].width, 1.5);
        assert.equal(fx.skeletonLength(sk), fx.skeletonLength(data.skeleton));
    }
    assert.equal(JSON.stringify(data.skeleton), before);
});

test('redrawn 3× tools are imported at their logical size', () => {
    assert.deepEqual([data.skeleton.attachments.hammer.hammer.width, data.skeleton.attachments.hammer.hammer.height], [133, 105]);
    assert.deepEqual([data.skeleton.attachments.saw.saw.width, data.skeleton.attachments.saw.saw.height], [180, 68]);
});

const overlaps = (A, B) => {
    for (const P of [A, B]) for (let i = 0; i < 4; i++) {
        const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % 4], nx = y2 - y1, ny = x1 - x2, pr = Q => Q.map(([x, y]) => x * nx + y * ny), a = pr(A), b = pr(B);
        if (Math.max(...a) < Math.min(...b) || Math.max(...b) < Math.min(...a)) return false;
    }
    return true;
};
const corners = p => { const r = p.angle * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => { const x = u * p.width / 2 * p.scaleX, y = v * p.height / 2 * p.scaleY; return [p.x + x * c - y * s, p.y + x * s + y * c]; }); };

test('configured tuning: hammer and saw never overlap on any building width, spread is horizontal only', () => {
    const { parseGameConfig } = loader()('assets/scripts/core/Config');
    const config = parseGameConfig(JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/resources/config/game-config.json'), 'utf8')));
    const tuning = config.rules.build.fx;
    const widths = new Set(config.maps.flatMap(m => m.buildings.map(b => Math.round(b.widthFraction * 853))));
    for (const width of widths) {
        const s = Math.max(0.55, Math.min(1.2, width / 420)), sk = fx.tuneBuildSkeleton(data.skeleton, width, s, tuning, 420);
        const end = fx.skeletonLength(sk) / sk.timeScale;
        for (let t = 0; t <= end; t += 0.02) {
            const P = Object.fromEntries(fx.sampleSkeleton(sk, t).map(p => [p.slot, p])), on = p => p.asset && p.color[3] > 0.01;
            if (on(P.hammer) && on(P.saw)) assert.ok(!overlaps(corners(P.hammer), corners(P.saw)), `width ${width} t=${t.toFixed(2)}`);
        }
        assert.equal(sk.bones.find(b => b.name === 'hammer').y, data.skeleton.bones.find(b => b.name === 'hammer').y);
    }
});

test('tool extent and fitting: the sweep box moves inside the frame, centred when too big', () => {
    const e = fx.toolExtent(data.skeleton);
    assert.ok(e.right > e.left && e.top > e.bottom);
    assert.deepEqual(fx.fitInside({ left: -50, right: 50, bottom: 0, top: 100 }, { left: 0, right: 200, bottom: -100, top: 80 }), { dx: 50, dy: -20 });
    assert.deepEqual(fx.fitInside({ left: 0, right: 10, bottom: 0, top: 10 }, { left: -100, right: 100, bottom: -100, top: 100 }), { dx: 0, dy: 0 });
    assert.deepEqual(fx.fitInside({ left: 0, right: 300, bottom: 0, top: 10 }, { left: -100, right: 100, bottom: -100, top: 100 }), { dx: -150, dy: 0 });
});
