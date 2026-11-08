import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { PROJECT, WORKSPACE, sha256 } from '../prefab-foundation/io.mjs';

// Read-only exporter: never imports or invokes a Prefab generator.
const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_PATH || 'G:/cocosCreator/Editor/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const read = file => JSON.parse(fs.readFileSync(path.join(PROJECT, file), 'utf8'));
const cache = new Map();
const decorator = () => target => target;
const cc = { _decorator: { ccclass: decorator, executionOrder: decorator, property: () => () => {} }, Component: class {}, Graphics: class {}, Mask: class {}, Sprite: class {}, UITransform: class {}, Color: class {} };
function load(file) {
    const full = path.join(PROJECT, file);
    if (cache.has(full)) return cache.get(full).exports;
    const module = { exports: {} }; cache.set(full, module);
    const source = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true } }).outputText;
    vm.runInThisContext('(function(module,exports,require){' + source + '\n})', { filename: full })(module, module.exports, id => {
        if (id === 'cc') return cc;
        return load(path.relative(PROJECT, path.resolve(path.dirname(full), id + '.ts')));
    });
    return module.exports;
}
const { fitCells, fitTrayWindow, centeredCells } = load('assets/scripts/features/puzzle/presentation/PuzzleLayout.ts');
const { buildSourceGeometry } = load('assets/scripts/features/presentation/SourceGeometry.ts');
const prefabFile = 'assets/resources/first-release/prefabs/PuzzlePage.prefab';
const prefabBytes = fs.readFileSync(path.join(PROJECT, prefabFile));
const objects = JSON.parse(prefabBytes);
const board = objects.find(value => value.wellAssetId && value.textureAssetIds);
const ui = id => objects[objects[id]._components.find(ref => objects[ref.__id__].__type__ === 'cc.UITransform').__id__];
const node = id => objects[id];
function origin(id) {
    let x = 0, y = 0, current = node(id);
    while (current && current.__type__ === 'cc.Node') {
        x += current._lpos.x; y += current._lpos.y;
        current = current._parent ? node(current._parent.__id__) : null;
    }
    return { x, y };
}
const config = read('assets/resources/config/game-config.json');
const lines = config.tables.Mainline;
const first = Object.entries(lines).filter(([id]) => id !== 'keys').map(([, row]) => Object.fromEntries(lines.keys.map((key, i) => [key, row[i]]))).find(row => row.levelNo === 1);
const level = read('assets/bundles/puzzle/config/level-catalog.json').levels.find(row => row.id === first.puzzleId);
const base = read('assets/resources/framework/config/source-art-manifest.json');
const addition = read('assets/resources/first-release/art-additions.json');
const records = new Map([...base.records, ...base.derivatives, ...addition.records].map(record => [record.id, record]));
const frameRecords = new Map([...records.values()].map(record => [record.spriteFrameUuid, record]));
function material(id) {
    const record = records.get(addition.aliases?.[id] || id);
    if (!record) throw Error('Missing material ' + id);
    return { asset_id: id, actual_asset_id: record.id, assetPath: record.assetPath, source_file: record.sourceFile || record.assetPath, spriteFrameUuid: record.spriteFrameUuid, source_size: record.size };
}
const width = 853, height = 1844;
const pagePoint = (point, root) => [width / 2 + root.x + point.x, height / 2 - root.y - point.y];
const boardNode = board.boardMount.__id__, boardRoot = origin(boardNode), boardSize = ui(boardNode)._contentSize;
const cells = [...level.targetCells, ...level.obstacleCells];
// A missing serialized property uses the component class's default, not fitCells' default.
const boardPadding = board.boardPadding ?? 32;
const boardFit = fitCells(cells, boardSize.width, boardSize.height, boardPadding);
const layers = [];
const geometry = [];
for (const role of ['shadow', 'floor', 'rim']) {
    const binding = board['board' + role[0].toUpperCase() + role.slice(1)];
    const component = objects[binding.__id__];
    // present() replaces each authored geometry size with the live board bounds.
    const id = component.node.__id__, root = origin(id), size = boardSize;
    const spec = { renderer: 'block.hex.v1', role, cells: cells.map(cell => [cell.q, cell.r]), bbox: [0, 0, size.width, size.height], padding: boardPadding, flip_y: true };
    const shape = buildSourceGeometry(spec, size.width, size.height);
    if (Math.abs(shape.radius - boardFit.radius) > 1e-7) throw Error('Geometry and cell fit disagree: ' + role);
    const polygon = points => points.map(([x, y]) => pagePoint({ x, y }, root));
    const texture = component.texture ? objects[component.texture.__id__] : null;
    const record = texture?._spriteFrame ? frameRecords.get(texture._spriteFrame.__uuid__) : null;
    geometry.push({ layer_name: 'Puzzle/Board/' + role, role, spec, page_box: [width / 2 + root.x - size.width / 2, height / 2 - root.y - size.height / 2, size.width, size.height], radius: shape.radius,
        cell_polygons: shape.cellPolygons.map(polygon), boundary_polygons: shape.boundaries.map(polygon), texture: record ? material(record.id) : null,
        render: role === 'floor' ? { mode: 'tile-texture-mask', source_tile_size: record?.size } : role === 'shadow' ? { fill_rgba: [53, 29, 12, 90], stroke_rgba: [53, 29, 12, 90], stroke_width: 36 * Math.min(1, Math.max(.25, shape.radius / 60)), page_shift_y: 5 } : { strokes: [[36, [104, 55, 20, 255]], [27, [185, 113, 42, 255]], [12, [237, 177, 85, 255]]].map(([stroke, rgba]) => ({ width: stroke * Math.min(1, Math.max(.25, shape.radius / 60)), rgba })) } });
}
function imageLayer(name, center, radius, assetId, extra = {}) {
    return { layer_name: name, kind: 'image', center, position: [center[0] - radius, center[1] - Math.sqrt(3) * radius / 2], size: [radius * 2, Math.sqrt(3) * radius], ...material(assetId), ...extra };
}
cells.forEach((cell, i) => layers.push(imageLayer('Puzzle/Board/Cell-' + i, pagePoint(boardFit.centers[i], boardRoot), boardFit.radius, i < level.targetCells.length ? board.wellAssetId : board.obstacleAssetId, { axial: cell, grayscale: i >= level.targetCells.length })));
const viewportSize = ui(board.trayViewport.__id__)._contentSize;
const traySize = ui(board.piecesMount.__id__)._contentSize;
const trayRoot = origin(board.piecesMount.__id__);
const fit = fitTrayWindow(level.pieces, viewportSize.width, traySize.height, board.trayGap, board.trayPadding);
const palette = JSON.parse(board.textureAssetIds);
const pieces = level.pieces.map((piece, i) => {
    const layout = centeredCells(piece.cells, fit.radius);
    const root = { x: trayRoot.x + fit.pieces[i].position.x, y: trayRoot.y + fit.pieces[i].position.y };
    const piecesLayers = layout.centers.map((point, j) => imageLayer('Puzzle/Tray/' + piece.id + '/Cell-' + j, pagePoint(point, root), fit.radius, palette[piece.textureName], { piece_id: piece.id, axial: piece.cells[j] }));
    layers.push(...piecesLayers);
    return { id: piece.id, textureName: piece.textureName, cells: piece.cells, targetCells: piece.targetCells, radius: fit.radius, layer_names: piecesLayers.map(layer => layer.layer_name) };
});
const output = path.join(WORKSPACE, 'tmp/prototype/first-release/art-puzzle');
fs.mkdirSync(output, { recursive: true });
const result = { canvas: [width, height], coordinate_system: 'page pixels; origin top-left; y down; all material image layers include full PNG alpha, resize to size', puzzle_id: level.id,
    source_prefab: prefabFile, source_prefab_sha256: sha256(prefabBytes), boardFit, pieces, geometry, layers,
    exclude_static_subtrees: ['Boardshadow', 'Boardfloor', 'Boardrim', 'Board', 'Content', 'HintOutline', 'PlacementPreview', 'DraggedPiece'],
    text_overrides: { MoveCaption: level.mode === 'challenge' ? '剩余步数' : '已用步数', Moves: String(level.moveLimit || 0), HintCount: '5' },
    notes: ['All images are existing unique source PNGs, not screenshot slices.', 'Clip the tiled floor to cell_polygons. Draw shadow before floor/rim, then board wells, then tray piece cells. Static Prefab UI is exported separately.', 'This is an initial unplayed first-level snapshot, not an exact reconstruction of the v2 illustrative level.'] };
fs.writeFileSync(path.join(output, 'geometry.json'), JSON.stringify(result, null, 2) + '\n');
if (sha256(fs.readFileSync(path.join(PROJECT, prefabFile))) !== result.source_prefab_sha256) throw Error('Prefab changed concurrently during read-only export');
console.log(JSON.stringify({ output: path.join(output, 'geometry.json'), puzzleId: level.id, boardCells: cells.length, pieces: pieces.length, imageLayers: layers.length, geometryLayers: geometry.length }));
