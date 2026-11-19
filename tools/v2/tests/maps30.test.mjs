// docs/v2/14: 30 maps, income multiplier, mainline loop with board symmetries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loader, PROJECT } from '../env.mjs';

const load = loader();
const { defaultRules } = load('assets/scripts/core/DefaultRules');
const { mainlineLevel, payout } = load('assets/scripts/core/Rules');
const { createState } = load('assets/scripts/core/State');
const Main = load('assets/scripts/core/Mainline');
const Prog = load('assets/scripts/core/Progress');
const { LevelCatalog, transformLevel, transformCell } = load('assets/scripts/features/puzzle/data/LevelCatalog');
const { PuzzleSession } = load('assets/scripts/features/puzzle/session/PuzzleSession');
const { fitCells } = load('assets/scripts/features/puzzle/presentation/PuzzleLayout');
const rules = defaultRules();
const catalog = new LevelCatalog(JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/bundles/puzzle/config/level-catalog.json'), 'utf8')));

test('30 maps with the 14 §4.2 costs: 5 buildings each, growing multiplier, one chain', () => {
    assert.equal(rules.maps.length, 30);
    const total = m => m.buildings.reduce((sum, b) => sum + b.costs.reduce((a, c) => a + c, 0), 0);
    assert.equal(total(rules.maps[0]), 2000);
    assert.equal(total(rules.maps[29]), 5 * 10400);
    rules.maps.forEach((m, i) => {
        assert.equal(m.buildings.length, 5);
        assert.equal(m.nextMapId, rules.maps[i + 1]?.id ?? null);
        if (i) assert.ok(m.incomeMult >= rules.maps[i - 1].incomeMult && total(m) > total(rules.maps[i - 1]), m.id);
    });
    assert.equal(rules.maps[29].buildings[4].id, 'B150');
    assert.equal(rules.levels.length, 160);
});

test('coins scale with the map being built; energy, hints and unscaled rewards do not', () => {
    const s = createState(rules);
    assert.deepEqual(payout(s, rules, 'clear_normal'), { coins: 100, energy: 0, hints: 0 });
    s.maps.currentMapId = 'M05';
    assert.equal(payout(s, rules, 'clear_normal').coins, 300);
    assert.equal(payout(s, rules, 'clear_challenge').coins, 450);
    s.maps.currentMapId = 'M30';
    assert.equal(payout(s, rules, 'clear_normal').coins, 775);
    assert.deepEqual(payout(s, rules, 'sign_7'), { coins: 1550, energy: 0, hints: 1 });
    assert.deepEqual(payout(s, rules, 'level_up_5'), rules.rewards.level_up_5);
    assert.deepEqual(payout(s, rules, 'welcome'), rules.rewards.welcome);
});

test('mainline never ends: level 111+ repeats the 110 questions with a symmetry per round', () => {
    assert.equal(mainlineLevel(rules, 110).transform, 0);
    const l111 = mainlineLevel(rules, 111), l221 = mainlineLevel(rules, 221);
    assert.deepEqual([l111.levelNo, l111.transform], [111, rules.loopTransforms[0]]);
    assert.equal(l221.transform, rules.loopTransforms[1]);
    // Loop rounds use every question once, challenges spread out (never two in a row).
    const round = Array.from({ length: 110 }, (_, i) => mainlineLevel(rules, 111 + i));
    assert.equal(new Set(round.map(l => l.puzzleId)).size, 110);
    assert.equal(round.filter(l => l.kind === 'challenge').length, 30);
    assert.ok(round.every((l, i) => !(l.kind === 'challenge' && round[i + 1]?.kind === 'challenge')));
    assert.equal(round[0].puzzleId, rules.mainline[0].puzzleId);
    const s = createState(rules);
    s.mainline.nextLevelNo = 111;
    assert.equal(Main.mainlineFinished(s, rules), false);
    s.energy.value = 5;
    Main.startAttempt(s, rules, 0, 111, 'a');
    assert.equal(Main.completeAttempt(s, rules, 'a', '2026-11-19'), 'firstClear');
    assert.equal(s.mainline.nextLevelNo, 112);
    assert.equal(s.wallet.coins, 100);
});

test('every question solves under all 12 symmetries and still fits the board', () => {
    const k = (c) => `${c.q},${c.r}`;
    for (let t = 0; t < 12; t++) assert.equal(new Set([...Array(37)].map((_, i) => k(transformCell({ q: i % 7 - 3, r: Math.floor(i / 7) - 3 }, t)))).size, 37);
    for (const base of catalog.levels) for (let t = 0; t < 12; t++) {
        const level = transformLevel(base, t), run = new PuzzleSession(level, `t${t}`);
        for (const piece of level.pieces) {
            assert.deepEqual(piece.cells[0], { q: 0, r: 0 });
            assert.equal(run.place(piece.id, piece.targetCells[0]), true, `${base.id}/${t}/${piece.id}`);
        }
        assert.equal(run.snapshot.status, 'completed', `${base.id}/${t}`);
        // Board area of S04 (classic) / S05 (challenge): cells never shrink below 80% of the 62 cap.
        const height = base.mode === 'challenge' ? 674 : 800;
        assert.ok(fitCells([...level.targetCells, ...level.obstacleCells], 793, height, 8).radius > 49, `${base.id}/${t}`);
    }
});

test('building a map pays its rewards scaled by that map, then moves on to the next', () => {
    const s = createState(rules);
    s.maps.currentMapId = 'M04';
    s.wallet.coins = 1e6;
    let n = 0;
    for (const b of rules.maps[3].buildings) for (let lv = 0; lv < 5; lv++) {
        Prog.startBuild(s, rules, 'M04', b.id, `b${n}`);
        Prog.finishBuild(s, rules, `b${n++}`, '2026-11-19');
    }
    const ev = id => s.displayQueue.find(e => e.id === id);
    assert.equal(ev('mapComplete:M04').reward.coins, 500);
    assert.equal(ev('buildingMax:M04:B16').reward.coins, 75);
    assert.equal(Prog.goToNextMap(s, rules), true);
    assert.equal(s.maps.currentMapId, 'M05');
});
