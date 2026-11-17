import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loader, PROJECT } from '../env.mjs';

const load = loader();
const fx = load('assets/scripts/features/fx/BuildTimeline');
const { parseGameConfig } = load('assets/scripts/core/Config');
const config = parseGameConfig(JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/resources/config/game-config.json'), 'utf8')));
const T = config.rules.build.constructionSeconds, timing = config.rules.build.fx;
const widths = [...new Set(config.maps.flatMap(m => m.buildings.map(b => Math.round(b.widthFraction * 853))))];
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
const at = (u, W = 420) => fx.buildPose(u * T, T, timing, W);

test('configured construction: 2 s, phases in the docs/v2/13 §2 order', () => {
    assert.equal(T, 2);
    assert.deepEqual({ ...timing }, { scaffoldEnd: 0.1, carryStart: 0.05, carryEnd: 0.35, hammerStart: 0.25, cloudStart: 0.8, revealAt: 0.92, sparkleSeconds: 0.4, beeFraction: 0.3, resumeFrom: 0.75 });
    near(fx.revealSeconds(T, timing), 1.84);
    near(fx.endSeconds(T, timing), 2.4);
    assert.equal(fx.startSeconds(T, timing, false), 0);
    near(fx.startSeconds(T, timing, true), 1.5);
});

test('config rejects phases out of order', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/resources/config/game-config.json'), 'utf8'));
    raw.tables.Constants.buildFxRevealAt[2] = 0.7; // before the cloud starts
    assert.throws(() => parseGameConfig(raw), /buildFx phases/);
});

test('scaffold grows over the first 10% and is gone after the reveal; dust only at the start', () => {
    assert.equal(at(0).scaffold.frame, 0);
    assert.equal(at(0.05).scaffold.frame, 1);
    assert.equal(at(0.5).scaffold.frame, 2);
    assert.equal(at(0.5).scaffold.opacity, 1);
    assert.equal(at(0.93).scaffold.visible, false);
    assert.ok(at(0.02).dust.visible);
    assert.equal(at(0.4).dust.visible, false);
});

test('carriers fly in from both sides, drop the plank and brick onto the boards, then leave', () => {
    assert.ok(at(0).carriers.every(c => !c.visible));
    const early = at(0.1);
    assert.ok(early.carriers[0].visible && early.carriers[0].x < 0 && !early.carriers[0].flip, 'plank bee from the left, facing right');
    const late = at(0.15);
    assert.ok(late.carriers[1].visible && late.carriers[1].x > 0 && late.carriers[1].flip, 'brick bee from the right, facing left');
    assert.ok(at(0.36).carriers.every(c => !c.visible), 'both gone when carrying ends');
    // Materials ride with the bee until let go, then rest until the cloud covers them.
    const held = at(0.12, 420);
    assert.ok(Math.abs(held.materials[0].x - held.carriers[0].x) < 0.3 * 420);
    const rest = at(0.5), land = at(0.7);
    for (const i of [0, 1]) { assert.ok(rest.materials[i].visible); near(rest.materials[i].x, land.materials[i].x); near(rest.materials[i].y, land.materials[i].y); }
    assert.ok(rest.materials[1].y > rest.materials[0].y, 'brick on the top board, plank on the middle one');
    assert.equal(at(0.95).materials[0].visible, false);
});

test('builders hammer between 25% and 80%: 3-frame swing, strikes give sparks, chips and a jolt', () => {
    assert.ok(at(0.2).builders.every(b => !b.visible));
    const pose = at(0.5);
    assert.ok(pose.builders.every(b => b.visible && b.opacity === 1));
    assert.deepEqual(pose.builders.map(b => b.flip), [false, true], 'they face each other');
    for (const i of [0, 1]) {
        const s = fx.strikes(i, T, timing);
        assert.ok(s.length >= 2, `builder ${i} strikes ${s.length}`);
        assert.ok(s.every(x => x >= timing.hammerStart * T && x < timing.cloudStart * T));
        const hit = fx.buildPose(s[0] + 0.05, T, timing, 420);
        assert.equal(hit.builders[i].frame, 2, 'hammer down at a strike');
        assert.ok(hit.sparks[i].visible);
        const chips = hit.chips.slice(i * fx.CHIPS_PER_BUILDER, (i + 1) * fx.CHIPS_PER_BUILDER).filter(c => c.visible);
        assert.ok(chips.length >= 2 && chips.length <= 3);
        assert.ok(Math.abs(hit.shake) > 0 && Math.abs(hit.shake) < 0.01 * 420);
    }
    const strikes = new Set([0, 1].flatMap(i => fx.strikes(i, T, timing).map(x => x.toFixed(3))));
    assert.equal(strikes.size, fx.strikes(0, T, timing).length + fx.strikes(1, T, timing).length, 'the two builders strike in turn');
    assert.ok(at(0.9).builders.every(b => !b.visible), 'flown off under the cloud');
    near(at(0.9).shake, 0);
});

test('dust cloud covers the building before the reveal, then spreads and fades; glow then sparkle', () => {
    assert.ok(at(0.79).puffs.every(p => !p.visible));
    const covered = at(0.92);
    assert.ok(covered.puffs.every(p => p.visible && p.opacity === 1));
    assert.ok(at(0.97).puffs.every(p => p.opacity < 1));
    assert.ok(fx.buildPose(T + 0.25, T, timing, 420).puffs.every(p => !p.visible));
    assert.ok(at(0.96).glow.visible);
    assert.equal(at(0.5).glow.visible, false);
    assert.equal(at(0.99).sparkle.visible, false, 'sparkle after the construction time');
    const s = fx.buildPose(T + 0.1, T, timing, 420);
    assert.ok(s.sparkle.visible);
    assert.equal(fx.buildPose(T + timing.sparkleSeconds + 0.01, T, timing, 420).sparkle.visible, false);
});

test('sizes follow the building width; bees ≈ 0.3W; everything finite at every width and time', () => {
    for (const W of widths) {
        for (let t = 0; t <= fx.endSeconds(T, timing); t += 0.02) {
            const p = fx.buildPose(t, T, timing, W);
            for (const s of [p.dust, p.scaffold, p.sparkle, p.glow, ...p.carriers, ...p.materials, ...p.builders, ...p.sparks, ...p.chips, ...p.puffs]) {
                for (const v of [s.x, s.y, s.size, s.angle, s.opacity]) assert.ok(Number.isFinite(v), `W ${W} t ${t}`);
                if (s.visible) assert.ok(s.opacity >= 0 && s.opacity <= 1);
            }
            if (p.builders[0].visible) near(p.builders[0].size, 0.3 * W);
            if (p.scaffold.visible) assert.equal(p.scaffold.size, W);
        }
        // Builders stand inside the scaffold.
        const b = fx.buildPose(0.5 * T, T, timing, W).builders;
        for (const x of b) assert.ok(Math.abs(x.x) < W / 2 && x.y > 0 && x.y < W * 0.6);
    }
});

test('a resumed build starts at the end of the hammering with everything in place', () => {
    const p = fx.buildPose(fx.startSeconds(T, timing, true), T, timing, 420);
    assert.ok(p.scaffold.visible && p.scaffold.frame === 2);
    assert.ok(p.materials.every(m => m.visible));
    assert.ok(p.builders.every(b => b.visible));
    assert.ok(p.carriers.every(c => !c.visible));
});

test('old skeleton data is no longer used by the runtime', () => {
    const src = ['assets/scripts/app/HomeController.ts', 'assets/scripts/features/fx/BuildFx.ts'].map(f => fs.readFileSync(path.join(PROJECT, f), 'utf8')).join('\n');
    assert.ok(!/fx\.build'|build-fx|FxTimeline|hammer\.png|saw\.png/.test(src));
});
