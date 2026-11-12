import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loader } from '../env.mjs';

const load = loader();
const { defaultRules } = load('assets/scripts/core/DefaultRules');
const { createState } = load('assets/scripts/core/State');
const E = load('assets/scripts/core/Endless');

const rules = defaultRules();
const DAY = '2026-11-09', WEEK = '2026-11-09';

test('radius-4 board has 61 cells and 27 full lines of 5–9 cells', () => {
    assert.equal(E.boardCells(4).length, 61);
    const lines = E.boardLines(4);
    assert.equal(lines.length, 27);
    assert.deepEqual([...new Set(lines.map(l => l.length))].sort((a, b) => a - b), [5, 6, 7, 8, 9]);
});

test('shapes are connected 1–5 cell pieces and fit the empty board', () => {
    const near = (a, b) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]].some(([dq, dr]) => a[0] + dq === b[0] && a[1] + dr === b[1]);
    for (const s of rules.endless.shapes) {
        assert.ok(s.cells.length >= 1 && s.cells.length <= 5, s.id);
        const seen = [s.cells[0]];
        for (let grew = true; grew;) { grew = false; for (const c of s.cells) if (!seen.includes(c) && seen.some(x => near(x, c))) { seen.push(c); grew = true; } }
        assert.equal(seen.length, s.cells.length, `${s.id} is not connected`);
        assert.ok(E.hasAnyPlacement({ board: {}, tray: [] }, rules, s.id), s.id);
    }
});

test('the same seed deals the same batch', () => {
    const a = E.newEndlessGame(createState(rules), rules, 'g', 42), b = E.newEndlessGame(createState(rules), rules, 'g', 42);
    assert.deepEqual(a.tray, b.tray);
    assert.equal(a.tray.length, 3);
});

test('a full line clears; crossing cells are cleared once and multi-line bonus applies', () => {
    const state = createState(rules);
    const game = E.newEndlessGame(state, rules, 'g', 1);
    // Fill q=0 line and r=0 line except the centre, then drop a single cell into the centre.
    for (const [q, r] of E.boardCells(4)) if ((q === 0 || r === 0) && !(q === 0 && r === 0)) game.board[E.key(q, r)] = 1;
    game.tray = ['s1', 'i2a', 'i2b'];
    const result = E.placeShape(state, rules, DAY, WEEK, 0, 0, 0);
    assert.equal(result.lines, 2);
    assert.equal(result.cleared.length, 17); // 9 + 9 - 1 shared centre
    assert.equal(result.score, 1 + 10 * 17 + 20 * 2 + 20 * 2 * 1);
    assert.equal(Object.keys(game.board).length, 0);
    assert.equal(state.endless.weekScore, result.score);
    assert.equal(state.endless.best, result.score);
});

test('illegal placements change nothing; empty tray refills; blocked board ends the game', () => {
    const state = createState(rules);
    const game = E.newEndlessGame(state, rules, 'g', 7);
    game.tray = ['i2a', null, null];
    assert.throws(() => E.placeShape(state, rules, DAY, WEEK, 0, 4, 0), /Illegal/);
    assert.deepEqual(game.tray, ['i2a', null, null]);
    const placed = E.placeShape(state, rules, DAY, WEEK, 0, -4, 0);
    assert.equal(placed.refilled, true);
    assert.equal(game.tray.every(id => id !== null), true);
    // Every cell full except one: only single cells could fit.
    for (const [q, r] of E.boardCells(4)) game.board[E.key(q, r)] = 1;
    delete game.board[E.key(2, 2)];
    game.tray = ['i3a', 'o4', null];
    assert.equal(E.isGameOver(game, rules), true);
    game.tray = ['i3a', 's1', null];
    assert.equal(E.isGameOver(game, rules), false);
});

test('refill guarantees one placeable shape when any shape fits', () => {
    const state = createState(rules);
    const game = E.newEndlessGame(state, rules, 'g', 3);
    for (const [q, r] of E.boardCells(4)) game.board[E.key(q, r)] = 1;
    delete game.board[E.key(0, 0)];
    for (let seed = 0; seed < 20; seed++) {
        game.seed = seed;
        E.refill(game, rules);
        assert.ok(game.tray.some(id => E.hasAnyPlacement(game, rules, id)), `seed ${seed}`);
    }
});

test('weekly stages: each claimed once per week, new week resets progress but keeps the running game', () => {
    const state = createState(rules);
    E.refreshWeek(state, WEEK);
    state.endless.weekScore = 1600;
    E.claimEndlessStage(state, rules, WEEK, 0);
    E.claimEndlessStage(state, rules, WEEK, 1);
    assert.throws(() => E.claimEndlessStage(state, rules, WEEK, 1), /claimed/);
    assert.throws(() => E.claimEndlessStage(state, rules, WEEK, 2), /reached/);
    assert.equal(state.wallet.coins, 150);
    const game = E.newEndlessGame(state, rules, 'g', 5);
    game.score = 900;
    E.refreshWeek(state, '2026-11-16');
    assert.equal(state.endless.weekScore, 0);
    assert.deepEqual(state.endless.claimedStages, []);
    assert.equal(state.endless.game.score, 900);
});
