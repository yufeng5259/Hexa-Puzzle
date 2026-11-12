import '../env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { PROJECT } from '../env.mjs';
const PROJECT_CATALOG = 'assets/bundles/puzzle/config/level-catalog.json';

const require = createRequire(import.meta.url);
let ts;
try { ts = require('typescript'); } catch {
    const location = [process.env.TYPESCRIPT_PATH,
        'G:/cocosCreator/Editor/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js',
        'D:/Program Files/Trae/resources/app/extensions/node_modules/typescript/lib/typescript.js'].find(value => value && fs.existsSync(value));
    if (!location) throw new Error('Set TYPESCRIPT_PATH');
    ts = require(location);
}
const modules = new Map();
function load(filename) {
    const file = path.resolve(filename.endsWith('.ts') ? filename : filename + '.ts');
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;
    vm.runInThisContext('(function(module,exports,require){' + output + '\n})', { filename: file })(module, module.exports,
        name => { assert.ok(name.startsWith('.'), 'rules must have only pure local dependencies'); return load(path.resolve(path.dirname(file), name)); });
    return module.exports;
}
const { PuzzleSession } = load(path.join(PROJECT, 'assets/scripts/features/puzzle/session/PuzzleSession'));
const { LevelCatalog } = load(path.join(PROJECT, 'assets/scripts/features/puzzle/data/LevelCatalog'));
const catalog = new LevelCatalog(JSON.parse(fs.readFileSync(path.join(PROJECT, PROJECT_CATALOG), 'utf8')));
const at = (q, r = 0) => ({ q, r });
const fixture = (mode = 'classic', limit = null) => ({
    id: 'fixture', mode, index: 1, mainlineNumber: 1, moveLimit: limit,
    targetCells: [at(0), at(1), at(2), at(3)], obstacleCells: [at(0, 1)],
    pieces: ['a', 'b', 'c', 'd'].map((id, i) => ({ id, textureName: '1_png', cells: [at(0)], targetCells: [at(i)] }))
});
const session = (mode, limit) => new PuzzleSession(fixture(mode, limit), 'attempt-1');

test('all 110 formal source solutions finish legally with original IDs, including reserved seven-piece challenges', () => {
    for (const level of catalog.levels) {
        const run = new PuzzleSession(level, 'source-' + level.id);
        for (const piece of level.pieces) {
            const anchor = { q: piece.targetCells[0].q - piece.cells[0].q, r: piece.targetCells[0].r - piece.cells[0].r };
            assert.equal(run.canPlace(piece.id, anchor), true, level.id + ':' + piece.id);
            assert.equal(run.place(piece.id, anchor), true);
        }
        assert.equal(run.snapshot.status, 'completed', level.id);
        assert.equal(run.snapshot.moves, level.pieces.length, level.id);
        assert.equal(Object.keys(run.snapshot.placements).length, level.pieces.length);
        assert.equal(run.snapshot.levelId, level.id);
        assert.equal(run.snapshot.attemptId, 'source-' + level.id);
    }
});

test('completion accepts an alternate legal arrangement rather than comparing source answers', () => {
    const run = session();
    for (const [id, q] of [['d', 0], ['c', 1], ['b', 2], ['a', 3]]) assert.equal(run.place(id, at(q)), true);
    assert.equal(run.snapshot.status, 'completed');
    assert.deepEqual(run.snapshot.placements.a, at(3));
});

test('placement translation is added to every local axial cell, including negative offsets', () => {
    const level = fixture();
    level.targetCells = [at(-2, 1), at(-1, 0), at(0, 0)];
    level.pieces = [{ id: 'shape', textureName: '1_png', cells: [at(0), at(1, -1)], targetCells: [at(-2, 1), at(-1)] },
        { id: 'single', textureName: '1_png', cells: [at(0)], targetCells: [at(0)] }];
    const run = new PuzzleSession(level, 'negative');
    assert.equal(run.place('shape', at(-2, 1)), true);
    assert.deepEqual(run.snapshot.placements.shape, at(-2, 1));
    assert.equal(run.place('single', at(0)), true);
    assert.equal(run.snapshot.status, 'completed');
});

test('bounds, overlap, obstacles, unknown identities and malformed coordinates do not change the attempt', () => {
    const run = session();
    run.place('a', at(0));
    const before = run.snapshot;
    for (const position of [at(-1), at(4), at(0, 1), at(NaN), at(Infinity), at(.5), at(Number.MAX_SAFE_INTEGER),
        null, undefined, {}, { q: '1', r: 0 }]) {
        assert.equal(run.canPlace('b', position), false);
        assert.equal(run.place('b', position), false);
    }
    assert.equal(run.place('b', at(0)), false);
    for (const id of ['unknown', '__proto__', '', null, undefined]) {
        assert.equal(run.place(id, at(1)), false);
        assert.equal(run.returnPiece(id === undefined ? 'unknown' : id), false);
        run.select(id === undefined ? 'unknown' : id);
    }
    assert.deepEqual(run.snapshot, before);
});

test('an already placed piece excludes its own occupancy and counts only actual position changes', () => {
    const run = session();
    run.place('a', at(0));
    assert.equal(run.canPlace('a', at(0)), true);
    const before = run.snapshot;
    assert.equal(run.place('a', at(0)), false);
    assert.deepEqual(run.snapshot, before);
    assert.equal(run.place('a', at(1)), true);
    assert.equal(run.snapshot.moves, 2);
    assert.equal(run.place('b', at(0)), true, 'former occupancy is released only on commit');
    assert.equal(run.place('a', at(0)), false, 'other piece occupancy is retained');
});

test('multi-cell relocation may overlap its own former cells without losing occupied-cell checks', () => {
    const level = fixture();
    level.targetCells = Array.from({ length: 6 }, (_, q) => at(q));
    level.pieces[0].cells = [at(0), at(1)];
    const run = new PuzzleSession(level, 'self-overlap');
    run.place('a', at(0));
    assert.equal(run.place('a', at(1)), true);
    run.place('b', at(3));
    assert.equal(run.place('a', at(2)), false);
    assert.deepEqual(run.snapshot.placements.a, at(1));
});

test('canPlace is a non-mutating preview, so cancelled/invalid drag and duplicate end do not count', () => {
    const run = session('challenge', 10);
    run.place('a', at(0));
    const before = run.snapshot;
    for (let i = 0; i < 20; i++) {
        assert.equal(run.canPlace('a', at(1)), true);
        assert.equal(run.canPlace('a', at(7)), false);
    }
    assert.deepEqual(run.snapshot, before);
    run.place('a', at(1));
    const committed = run.snapshot;
    assert.equal(run.place('a', at(1)), false);
    assert.deepEqual(run.snapshot, committed);
});

test('return prefers selected placed piece, otherwise latest actual placement and resets selection', () => {
    const run = session();
    assert.equal(run.returnPiece(), false);
    run.place('a', at(0)); run.place('b', at(1));
    run.select('a');
    assert.equal(run.returnPiece(), true);
    assert.deepEqual(Object.keys(run.snapshot.placements), ['b']);
    assert.equal(run.snapshot.selectedPieceId, null);
    run.place('a', at(2)); run.place('b', at(0));
    run.select('c'); // Unplaced selection falls back to the latest actual placement.
    assert.equal(run.returnPiece(), true);
    assert.deepEqual(Object.keys(run.snapshot.placements), ['a']);
    assert.equal(run.snapshot.selectedPieceId, null);
    assert.equal(run.snapshot.moves, 6);
    assert.equal(run.returnPiece(), true);
    const empty = run.snapshot;
    assert.equal(run.returnPiece(), false);
    assert.deepEqual(run.snapshot, empty);
});

test('explicit return rejects unknown/unplaced ID instead of returning an unrelated piece', () => {
    const run = session();
    run.place('a', at(0));
    const before = run.snapshot;
    assert.equal(run.returnPiece('b'), false);
    assert.deepEqual(run.snapshot, before);
    assert.equal(run.returnPiece('a'), true);
    assert.equal(run.snapshot.moves, 2);
});

test('select changes only selection/revision, is idempotent, and successful action clears selection atomically', () => {
    const run = session();
    run.select('a');
    assert.equal(run.snapshot.moves, 0); assert.equal(run.snapshot.revision, 1);
    assert.equal(run.snapshot.selectedPieceId, 'a');
    const selected = run.snapshot;
    run.select('a'); run.select('bad');
    assert.deepEqual(run.snapshot, selected);
    run.select(null);
    assert.equal(run.snapshot.revision, 2);
    run.select('a'); run.place('a', at(0));
    assert.equal(run.snapshot.selectedPieceId, null);
    assert.equal(run.snapshot.moves, 1);
    assert.equal(run.snapshot.revision, 4);
});

test('classic attempts allow unlimited legal adjustment and do not apply a challenge budget', () => {
    const run = session();
    for (let i = 0; i < 100; i++) assert.equal(run.place('a', at(i % 2)), true);
    assert.equal(run.snapshot.moves, 100);
    assert.equal(run.snapshot.status, 'active');
});

test('filling the board on exactly the final allowed move wins before budget exhaustion', () => {
    const run = session('challenge', 4);
    for (const [i, id] of ['a', 'b', 'c', 'd'].entries()) run.place(id, at(i));
    assert.equal(run.snapshot.moves, 4);
    assert.equal(run.snapshot.status, 'completed');
});

test('a legal non-completing placement or return exhausts the challenge, and all terminal operations are inert', () => {
    for (const action of ['place', 'return']) {
        const run = session('challenge', 2);
        run.place('a', at(0));
        if (action === 'place') run.place('b', at(1)); else run.returnPiece('a');
        assert.equal(run.snapshot.status, 'failed');
        const terminal = run.snapshot;
        assert.equal(run.canPlace('c', at(2)), false);
        assert.equal(run.place('c', at(2)), false);
        assert.equal(run.returnPiece(), false);
        assert.equal(run.returnPiece('a'), false);
        run.select('a'); run.select(null);
        assert.deepEqual(run.snapshot, terminal);
    }
});

test('subscribers receive only changes, one terminal transition, and unsubscribe is idempotent', () => {
    const run = session('challenge', 2), changes = [];
    const stop = run.subscribe(snapshot => changes.push(snapshot));
    assert.equal(changes.length, 0);
    run.select('a'); run.select('a'); run.select('bad');
    run.place('a', at(0)); run.place('a', at(0)); run.place('b', at(8));
    run.place('b', at(1)); run.place('c', at(2)); run.returnPiece();
    assert.equal(changes.length, 3);
    assert.deepEqual(changes.map(snapshot => snapshot.revision), [1, 2, 3]);
    assert.equal(changes.filter(snapshot => snapshot.status !== 'active').length, 1);
    stop(); stop();
    const other = session(); let count = 0;
    const remove = other.subscribe(() => count++);
    other.place('a', at(0)); remove(); other.place('b', at(1));
    assert.equal(count, 1);
});

test('snapshots and level are deeply immutable copies and cannot mutate current or future attempts', () => {
    const input = fixture(), run = new PuzzleSession(input, 'old');
    input.pieces[0].cells[0].q = 100; input.targetCells[0].q = 100;
    const translation = at(0);
    assert.equal(run.place('a', translation), true);
    const snapshot = run.snapshot;
    translation.q = 3;
    assert.deepEqual(run.snapshot.placements.a, at(0));
    assert.throws(() => { snapshot.moves = 50; }, TypeError);
    assert.throws(() => { snapshot.placements.a.q = 50; }, TypeError);
    assert.throws(() => { snapshot.placements.b = at(2); }, TypeError);
    assert.throws(() => { run.level.pieces[0].cells[0].q = 50; }, TypeError);
    assert.throws(() => { run.level.targetCells[0].q = 50; }, TypeError);
    run.place('a', at(1));
    assert.deepEqual(snapshot.placements.a, at(0), 'past snapshots retain their board');
    assert.notEqual(run.snapshot, run.snapshot);
    const restarted = new PuzzleSession(run.level, 'new');
    assert.equal(restarted.snapshot.attemptId, 'new');
    assert.equal(restarted.snapshot.moves, 0);
    assert.deepEqual(restarted.snapshot.placements, {});
    assert.equal(run.snapshot.attemptId, 'old');
    for (const id of ['', ' ', null, undefined]) assert.throws(() => new PuzzleSession(run.level, id), /attemptId/);
});

test('completed attempts remain terminal and cannot emit repeated completion events', () => {
    const run = session(); let completed = 0;
    run.subscribe(snapshot => { if (snapshot.status === 'completed') completed++; });
    for (const [q, id] of ['a', 'b', 'c', 'd'].entries()) run.place(id, at(q));
    const before = run.snapshot;
    assert.equal(run.place('d', at(3)), false);
    assert.equal(run.returnPiece('a'), false);
    run.select('a');
    assert.deepEqual(run.snapshot, before);
    assert.equal(completed, 1);
});
