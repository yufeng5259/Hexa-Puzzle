import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loader, PROJECT } from '../env.mjs';

const load = loader();
const H = load('assets/scripts/features/ui/MapHit');
const { parseGameConfig } = load('assets/scripts/core/Config');
const D = { width: 853, height: 1844 };
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
const at = (o = {}) => ({ id: 'A', feetX: 0.5, feetY: 0.5, anchorX: 0.5, anchorY: 1, widthFraction: 0.5, flipX: false, zIndex: 0, ...o });

test('building rect: square picture on its feet, shrunk around the centre', () => {
    // 426.5 wide, anchored bottom-centre at the design centre.
    const full = H.buildingRect(at(), D, 1);
    near(full.x, -213.25); near(full.y, 0); near(full.width, 426.5); near(full.height, 426.5);
    const r = H.buildingRect(at(), D);
    near(r.width, 426.5 * 0.7); near(r.x + r.width / 2, 0); near(r.y + r.height / 2, 213.25);
});

test('building rect: flipX mirrors an off-centre anchor', () => {
    near(H.buildingRect(at({ anchorX: 0.3 }), D, 1).x, -0.3 * 426.5);
    near(H.buildingRect(at({ anchorX: 0.3, flipX: true }), D, 1).x, -0.7 * 426.5);
});

test('hit: inside the shrunk rect hits, the transparent margin does not', () => {
    const b = [at()];
    assert.equal(H.hitBuilding(b, 0, 213, D), 'A');
    assert.equal(H.hitBuilding(b, 200, 213, D), null, 'outside 70% (±149) but inside the picture');
    assert.equal(H.hitBuilding(b, 0, 410, D), null);
    assert.equal(H.hitBuilding([], 0, 0, D), null);
});

test('hit: overlapping buildings resolve to the largest zIndex, regardless of order', () => {
    const back = at({ id: 'back', zIndex: 1 }), front = at({ id: 'front', zIndex: 5, feetX: 0.55 });
    assert.equal(H.hitBuilding([back, front], 20, 200, D), 'front');
    assert.equal(H.hitBuilding([front, back], 20, 200, D), 'front');
    // Only the back one reaches this far left.
    assert.equal(H.hitBuilding([front, back], -130, 200, D), 'back');
});

test('tap vs drag: movement within the slop is a tap', () => {
    assert.equal(H.isTap({ x: 0, y: 0 }, { x: 10, y: 10 }), true);
    assert.equal(H.isTap({ x: 0, y: 0 }, { x: 30, y: 0 }), false);
});

test('every configured building is tappable at its own picture centre', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/resources/config/game-config.json'), 'utf8'));
    for (const map of parseGameConfig(raw).maps) {
        for (const b of map.buildings) {
            const r = H.buildingRect(b, D), cx = r.x + r.width / 2, cy = r.y + r.height / 2;
            const hit = H.hitBuilding(map.buildings, cx, cy, D);
            const winner = map.buildings.find(x => x.id === hit);
            assert.ok(hit === b.id || winner.zIndex > b.zIndex, `${map.id}/${b.id} centre goes to ${hit}`);
        }
    }
});
