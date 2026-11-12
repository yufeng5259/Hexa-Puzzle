import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT, loader } from '../env.mjs';

const load = loader();
const { LevelCatalog, mainlineNumberFor, offsetToAxial } = load('assets/scripts/features/puzzle/data/LevelCatalog.ts');
const data = JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/bundles/puzzle/config/level-catalog.json'), 'utf8')), catalog = new LevelCatalog(data);
const clone = () => JSON.parse(JSON.stringify(data));
const cellKey = c => c.q + ',' + c.r;

test('committed catalog keeps all 110 question identities and the 96-step legacy mainline', () => {
    assert.equal(catalog.levels.length, 110);
    assert.equal(catalog.levels.filter(l => l.mode === 'classic').length, 80);
    assert.equal(catalog.levels.filter(l => l.mode === 'challenge').length, 30);
    assert.equal(catalog.mainline.length, 96);
    assert.equal(catalog.getMainline(1).id, 'classic-001');
    assert.equal(catalog.getMainline(6).id, 'challenge-001');
    assert.equal(catalog.getMainline(96).id, 'challenge-016');
    for (const level of catalog.levels) {
        assert.deepEqual(level.targetCells, level.pieces.flatMap(p => p.targetCells));
        assert.equal(new Set(level.targetCells.map(cellKey)).size, level.targetCells.length);
        assert.equal(level.mode === 'challenge', Number.isInteger(level.moveLimit));
    }
});

test('reserved challenge 17..30 remain addressable only by source identity', () => {
    for (let index = 17; index <= 30; index++) {
        const question = catalog.getById('challenge-' + String(index).padStart(3, '0'));
        assert.equal(question.mainlineNumber, null);
        assert.equal(mainlineNumberFor('challenge', index), null);
        assert.ok(!catalog.mainline.includes(question));
    }
    for (const invalid of [0, -1, 97, 110, 1.5, NaN, Infinity, '6', null]) assert.throws(() => catalog.getMainline(invalid));
    assert.throws(() => catalog.getById('classic-081'));
});

test('catalog snapshots do not alias input and are deeply immutable', () => {
    const input = clone(), frozen = new LevelCatalog(input), old = frozen.getMainline(1).pieces[0].cells[0].q;
    input.levels[0].pieces[0].cells[0].q = 999;
    assert.equal(frozen.getMainline(1).pieces[0].cells[0].q, old);
    assert.throws(() => frozen.mainline.push(frozen.levels[0]), TypeError);
    assert.throws(() => { frozen.levels[0].pieces[0].cells[0].q = 99; }, TypeError);
    assert.throws(() => { frozen.sources[0].sha256 = 'x'; }, TypeError);
});

test('axial transform handles odd/even and negative columns with floor semantics', () => {
    assert.deepEqual(offsetToAxial(3, 2), { q: 3, r: 1 });
    assert.deepEqual(offsetToAxial(4, 2), { q: 4, r: 0 });
    assert.deepEqual(offsetToAxial(-1, 0), { q: -1, r: 1 });
    for (const pair of [[NaN, 1], [0, Infinity], [0.5, 1]]) assert.throws(() => offsetToAxial(...pair));
    assert.equal(mainlineNumberFor('classic', 81), null);
    assert.equal(mainlineNumberFor('classic', 0), null);
});

test('runtime catalog accepts removing an unmapped question without changing remaining source geometry', () => {
    const input = clone(), removed = input.levels.pop(), reduced = new LevelCatalog(input);
    assert.equal(removed.mainlineNumber, null);
    assert.equal(reduced.levels.length, 109);
    assert.equal(reduced.mainline.length, 96);
    assert.deepEqual(reduced.getById('classic-001'), catalog.getById('classic-001'));
    assert.throws(() => reduced.getById(removed.id), /Unknown level id/);
});

test('runtime catalog accepts an additional valid source identity instead of enforcing the old total', () => {
    const input = clone(), added = JSON.parse(JSON.stringify(input.levels[79]));
    added.id = 'classic-081'; added.index = 81; added.mainlineNumber = null; input.levels.push(added);
    const expanded = new LevelCatalog(input);
    assert.equal(expanded.levels.length, 111);
    assert.deepEqual(expanded.getById('classic-081').pieces, added.pieces);
    assert.throws(() => expanded.getById('classic-082'), /Unknown level id/);
});

test('runtime catalog allows a formerly reserved question to extend the contiguous legacy mapping', () => {
    const input = clone(), promoted = input.levels.find(row => row.id === 'challenge-017');
    promoted.mainlineNumber = 97;
    const expanded = new LevelCatalog(input);
    assert.equal(expanded.levels.length, 110);
    assert.equal(expanded.mainline.length, 97);
    assert.equal(expanded.getMainline(97).id, promoted.id);
    assert.deepEqual(expanded.getMainline(97).pieces, catalog.getById(promoted.id).pieces);
    assert.throws(() => expanded.getMainline(98), /range/);
});

const corruptions = {
    schema: v => { v.schema = 'unsupported'; },
    sourceHash: v => { v.sources[0].sha256 = 'bad'; },
    sourcePath: v => { v.sources[0].path = '../other'; },
    extraField: v => { v.levels[0].reward = 500; },
    duplicateQuestion: v => { v.levels[1] = v.levels[0]; },
    duplicateMainline: v => { v.levels[1].mainlineNumber = 1; },
    remappedIdentity: v => { v.levels[0].id = 'classic-999'; },
    remappedMainline: v => { v.levels[0].mainlineNumber = 97; },
    unexpectedTexture: v => { v.levels[0].pieces[0].textureName = '4_png'; },
    pieceIdentity: v => { v.levels[0].pieces[0].id = 'replacement'; },
    nonIntegralCoordinate: v => { v.levels[0].pieces[0].cells[0].q = 0.5; },
    inconsistentShape: v => { v.levels[0].pieces[0].cells[1].q++; },
    duplicateCell: v => { v.levels[0].pieces[0].cells[1] = v.levels[0].pieces[0].cells[0]; },
    missingTarget: v => { v.levels[0].targetCells.pop(); },
    overlappingObstacle: v => { v.levels[0].obstacleCells.push(v.levels[0].targetCells[0]); },
    inventedClassicLimit: v => { v.levels[0].moveLimit = 5; },
    missingChallengeLimit: v => { v.levels[80].moveLimit = null; },
};
for (const [name, corrupt] of Object.entries(corruptions)) test('strict catalog rejects ' + name, () => {
    const input = clone(); corrupt(input); assert.throws(() => new LevelCatalog(input), /Invalid level catalog/);
});

