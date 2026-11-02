import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const ts = require(process.env.TYPESCRIPT_PATH || 'G:/cocosCreator/Editor/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const file = path.join(root, 'Project/assets/scripts/features/presentation/SourceGeometry.ts');
const module = { exports: {} };
const cc = { _decorator: { ccclass: () => c => c, executionOrder: () => c => c, property: () => () => {} }, Component: class {}, CCString: String };
const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true } }).outputText;
vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(() => cc, module, module.exports);
const { fitSourceHex, sourceBoundary, buildSourceGeometry } = module.exports;
const reference = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'prototype/assets/block/运行组件/block_hex_runtime.js'), 'utf8'), reference);
const art = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'prototype/block-data.js'), 'utf8'), art);
const procedural = Object.values(art.window.BlockArt.configs).flatMap(c => c.layers || []).filter(l => l.type === 'procedural');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('axial fit matches the actual prototype renderer for every authored board spec', () => {
    for (const layer of procedural.filter(l => l.procedural.cells.length)) {
        const s = layer.procedural;
        const actual = fitSourceHex(s.cells, s.bbox, s.padding, s.flip_y !== false);
        const expected = reference.BlockHex.layout(s.cells, s.bbox, s.padding, s.flip_y !== false);
        near(actual.radius, expected.radius);
        actual.offset.forEach((n, i) => near(n, expected.offset[i]));
        actual.centers.forEach((p, i) => p.center.forEach((n, axis) => near(n, expected.centers[i].center[axis])));
    }
});

test('exterior edges match the source and do not retain a shared internal edge', () => {
    const cells = [[0, 0], [1, 0]];
    assert.equal(sourceBoundary(cells).length, 10);
    assert.equal(JSON.stringify(sourceBoundary(cells)), JSON.stringify(reference.BlockHex.boundaryEdges(cells)));
    const shape = buildSourceGeometry({ renderer: 'block.hex.v1', role: 'rim', cells, bbox: [15, 25, 400, 300] }, 400, 300);
    assert.equal(shape.boundaries.length, 1);
    assert.equal(shape.boundaries[0].length, 10);
});

test('hole and disconnected shapes preserve separate boundary loops', () => {
    const cells = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    const shape = buildSourceGeometry({ renderer: 'block.hex.v1', role: 'rim', cells, bbox: [0, 0, 500, 500] }, 500, 500);
    assert.equal(sourceBoundary(cells).length, 24);
    assert.equal(shape.boundaries.length, 2);
    const separate = buildSourceGeometry({ renderer: 'block.hex.v1', role: 'rim', cells: [[0, 0], [4, 0]], bbox: [0, 0, 500, 500] }, 500, 500);
    assert.equal(separate.boundaries.length, 2);
});

test('flip mirrors axial center placement once and Cocos projection inverts screen y once', () => {
    const cells = [[0, 0], [1, 0], [1, 1]], bbox = [75, 485, 703, 705];
    const a = fitSourceHex(cells, bbox, 24, true), b = fitSourceHex(cells, bbox, 24, false);
    a.centers.forEach((p, i) => {
        near(p.center[0], b.centers[i].center[0]);
        near(p.center[1] + b.centers[i].center[1], 2 * bbox[1] + bbox[3]);
    });
    const shape = buildSourceGeometry({ renderer: 'block.hex.v1', role: 'floor', cells, bbox }, 703, 705);
    assert.ok(shape.project([0, 0])[1] > shape.project([0, 100])[1]);
});

test('crop uses source-canvas pixels after subtracting bbox origin and respects nonuniform node scaling', () => {
    const layer = procedural.find(l => l.procedural.role === 'floor'), spec = layer.procedural, crop = layer.procedural_crop;
    const width = (crop[2] - crop[0]) * 2, height = (crop[3] - crop[1]) * 3;
    const shape = buildSourceGeometry({ spec, crop }, width, height);
    near(shape.project([crop[0], crop[1]])[0], -width / 2);
    near(shape.project([crop[0], crop[1]])[1], height / 2);
    near(shape.project([crop[2], crop[3]])[0], width / 2);
    near(shape.project([crop[2], crop[3]])[1], -height / 2);
    const center = reference.BlockHex.layout(spec.cells, spec.bbox, spec.padding, spec.flip_y).centers[0].center;
    const local = shape.project([center[0] - spec.bbox[0], center[1] - spec.bbox[1]]);
    near(local[0], (center[0] - spec.bbox[0] - crop[0]) * 2 - width / 2);
    near(local[1], height / 2 - (center[1] - spec.bbox[1] - crop[1]) * 3);
});

test('all authored procedural specs build finite clipped fill geometry, including obstacle/selection', () => {
    assert.equal(procedural.length, 100);
    for (const layer of procedural) {
        const [width, height] = layer.size;
        const shape = buildSourceGeometry({ spec: layer.procedural, crop: layer.procedural_crop }, width, height);
        for (const polygon of shape.cellPolygons) for (const [x, y] of polygon) {
            assert.ok(Number.isFinite(x) && Number.isFinite(y));
            assert.ok(Math.abs(x) <= width / 2 + 1e-8 && Math.abs(y) <= height / 2 + 1e-8);
        }
    }
});

test('outline uses the registered fitted centers and only selected cells', () => {
    const layer = procedural.find(l => l.procedural.role === 'outline');
    const s = layer.procedural, shape = buildSourceGeometry({ spec: s, crop: layer.procedural_crop }, ...layer.size);
    assert.equal(shape.outlinePolygons.length, s.outline_cells.length);
    const first = s.layout.centers.find(c => c.cell.join(',') === s.outline_cells[0].join(','));
    const expected = shape.project([first.center[0] - s.bbox[0] + s.layout.radius * .95, first.center[1] - s.bbox[1]]);
    near(shape.outlinePolygons[0][0][0], expected[0]); near(shape.outlinePolygons[0][0][1], expected[1]);
});

test('invalid renderers, duplicate cells and degenerate crop/bounds fail explicitly', () => {
    assert.throws(() => fitSourceHex([[0, 0], [0, 0]], [0, 0, 100, 100]), /unique/);
    assert.throws(() => fitSourceHex([], [0, 0, 100, 100]), /unique/);
    assert.throws(() => fitSourceHex([[0, 0]], [0, 0, 40, 40]), /padding/);
    assert.throws(() => buildSourceGeometry({ renderer: 'unknown', role: 'floor' }, 10, 10), /renderer/);
    assert.throws(() => buildSourceGeometry({ spec: { renderer: 'block.hex.v1', role: 'obstacle', size: [100, 100] }, crop: [0, 0, 0, 0] }, 10, 10), /crop/);
});
