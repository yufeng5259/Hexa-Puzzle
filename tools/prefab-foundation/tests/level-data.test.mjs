import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { exportLevels, readSourceLevels, readSourceMainline, buildLevelCatalog, LEVEL_CATALOG_PATH } from '../export-levels.mjs';
import { PROJECT, PROTOTYPE, sha256 } from '../io.mjs';

const require = createRequire(import.meta.url);
let ts;
try { ts = require('typescript'); } catch {
    const location = [process.env.TYPESCRIPT_PATH,
        'G:/cocosCreator/Editor/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js',
        'D:/Program Files/Trae/resources/app/extensions/node_modules/typescript/lib/typescript.js']
        .find(value => value && fs.existsSync(value));
    if (!location) throw new Error('Set TYPESCRIPT_PATH');
    ts = require(location);
}
const modules = new Map();
function load(file) {
    if (modules.has(file)) return modules.get(file);
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const module = { exports: {} }; modules.set(file, module.exports);
    vm.runInThisContext('(function(module,exports,require){' + output + '\n})', { filename: file })(module, module.exports,
        name => { assert.ok(name.startsWith('.'), 'pure data module dependency'); return load(path.resolve(path.dirname(file), name + '.ts')); });
    return module.exports;
}
const { LevelCatalog, mainlineNumberFor, offsetToAxial } = load(path.join(PROJECT, 'assets/scripts/features/puzzle/data/LevelCatalog.ts'));
const data = exportLevels(), catalog = new LevelCatalog(data);
const clone = () => JSON.parse(JSON.stringify(data));
const levelSource = fs.readFileSync(path.join(PROTOTYPE, 'level-data.js'), 'utf8');
const mainlineSource = fs.readFileSync(path.join(PROTOTYPE, 'mainline.js'), 'utf8');
const source = readSourceLevels(levelSource);
const cellKey = c => c.q + ',' + c.r;

test('formal export is byte stable, source hashed, and contains all 110 source questions', () => {
    assert.equal(catalog.levels.length, 110);
    assert.equal(catalog.mainline.length, 96);
    assert.deepEqual(exportLevels(), data);
    assert.equal(fs.readFileSync(path.join(PROJECT, LEVEL_CATALOG_PATH), 'utf8'), JSON.stringify(data, null, 2) + '\n');
    assert.deepEqual(data.sources, [{ path: 'prototype/level-data.js', sha256: sha256(levelSource) }, { path: 'prototype/mainline.js', sha256: sha256(mainlineSource) }]);
});

test('all source question and piece identities, coordinates, limits, targets and obstacles survive export', () => {
    for (const mode of ['classic', 'challenge']) for (const original of source[mode]) {
        const actual = catalog.getById(original.meta.levelId);
        assert.equal(actual.mode, mode); assert.equal(actual.index, original.index);
        assert.equal(actual.moveLimit, original.meta.moveLimit);
        const pieces = original.raw.filter(p => p.type === 'edit_game_elements' && p.texureName !== '4_png');
        assert.equal(actual.pieces.length, original.meta.pieceCount);
        for (let i = 0; i < pieces.length; i++) {
            const raw = pieces[i], piece = actual.pieces[i], witness = original.meta.solutionWitness[i];
            assert.equal(piece.id, witness.pieceId); assert.equal(piece.textureName, raw.texureName);
            assert.deepEqual(piece.targetCells, raw.data.map(c => ({ q: c.tx, r: c.ty - Math.floor(c.tx / 2) })));
            const anchor = offsetToAxial(witness.anchor.tx, witness.anchor.ty);
            assert.deepEqual(piece.cells, piece.targetCells.map(c => ({ q: c.q - anchor.q, r: c.r - anchor.r })));
        }
        assert.deepEqual(actual.targetCells, actual.pieces.flatMap(p => p.targetCells));
        assert.deepEqual(actual.obstacleCells, original.raw.filter(p => p.type === 'edit_game_elements' && p.texureName === '4_png').flatMap(p => p.data.map(c => offsetToAxial(c.tx, c.ty))));
        const occupied = new Set(actual.targetCells.map(cellKey));
        assert.equal(occupied.size, actual.targetCells.length);
        assert.ok(actual.obstacleCells.every(c => !occupied.has(cellKey(c))));
    }
});

test('96 mainline mapping matches the unique prototype source exactly', () => {
    const rows = readSourceMainline(mainlineSource);
    for (const row of rows) {
        const question = catalog.getMainline(row.number);
        assert.equal(question.mode, row.mode); assert.equal(question.index, row.index);
        assert.equal(mainlineNumberFor(row.mode, row.index), row.number);
    }
    assert.equal(catalog.getMainline(1).id, 'classic-001');
    assert.equal(catalog.getMainline(6).id, 'challenge-001');
    assert.equal(catalog.getMainline(12).id, 'challenge-002');
    assert.equal(catalog.getMainline(96).id, 'challenge-016');
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

const corruptions = {
    schema: v => { v.schema = 'unsupported'; },
    sourceHash: v => { v.sources[0].sha256 = 'bad'; },
    sourcePath: v => { v.sources[0].path = '../other'; },
    extraField: v => { v.levels[0].reward = 500; },
    missingQuestion: v => { v.levels.pop(); },
    duplicateQuestion: v => { v.levels[1] = v.levels[0]; },
    remappedIdentity: v => { v.levels[0].id = 'classic-999'; },
    remappedMainline: v => { v.levels[0].mainlineNumber = 97; },
    reservedNavigation: v => { v.levels[96].mainlineNumber = 97; },
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

test('source extraction rejects executable level snapshots and changed map semantics', () => {
    assert.throws(() => readSourceLevels(levelSource + '\nprocess.exit();'));
    assert.throws(() => readSourceLevels('window.BeeLevels = (() => ({}))();'));
    assert.throws(() => readSourceMainline('while(true){}'), /timed out/);
    assert.throws(() => buildLevelCatalog(levelSource, mainlineSource.replace('length:96', 'length:97')));
});
