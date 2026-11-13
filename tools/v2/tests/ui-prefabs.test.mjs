import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT } from '../env.mjs';
import { buildUi } from '../build-ui.mjs';
import { scriptType } from '../prefab-builder.mjs';

const OUT = path.join(PROJECT, 'assets/bundles/ui/prefabs');
const VIEW = scriptType('assets/scripts/features/ui/LayoutView.ts');
const known = new Set();
(function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, e.name);
        if (e.isDirectory()) walk(file);
        else if (e.name.endsWith('.meta')) {
            const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
            known.add(meta.uuid);
            for (const sub of Object.values(meta.subMetas ?? {})) known.add(sub.uuid);
        }
    }
})(path.join(PROJECT, 'assets'));

test('every layout page builds a prefab and regeneration is byte-stable', () => {
    const before = fs.readdirSync(OUT).filter(f => f.endsWith('.prefab')).map(f => fs.readFileSync(path.join(OUT, f), 'utf8'));
    const names = buildUi();
    assert.equal(names.length, 26);
    const after = fs.readdirSync(OUT).filter(f => f.endsWith('.prefab')).map(f => fs.readFileSync(path.join(OUT, f), 'utf8'));
    assert.deepEqual(after, before);
});

for (const file of fs.readdirSync(OUT).filter(f => f.endsWith('.prefab'))) {
    test(`${file}: references resolve and LayoutView bindings are complete`, () => {
        const objects = JSON.parse(fs.readFileSync(path.join(OUT, file), 'utf8'));
        const refs = [], external = [];
        (function scan(v) {
            if (Array.isArray(v)) return v.forEach(scan);
            if (!v || typeof v !== 'object') return;
            if ('__id__' in v) refs.push(v.__id__);
            if ('__uuid__' in v) external.push(v.__uuid__);
            Object.values(v).forEach(scan);
        })(objects);
        assert.ok(refs.every(id => objects[id]), 'internal reference out of range');
        for (const uuid of external) assert.ok(known.has(uuid), `unknown asset ${uuid}`);
        const view = objects.find(o => o.__type__ === VIEW);
        assert.ok(view, 'LayoutView on root');
        assert.equal(view.node.__id__, 1);
        assert.equal(view.nodes.length, view.nodeIds.length);
        assert.equal(view.labels.length, view.labelIds.length);
        assert.equal(new Set(view.nodeIds).size, view.nodeIds.length, 'duplicate element id');
        for (const button of objects.filter(o => o.__type__ === 'cc.Button'))
            for (const event of button.clickEvents) assert.deepEqual([event.component, event.handler, event.target.__id__], ['LayoutView', 'onAction', 1]);
    });
}

const BOARD = scriptType('assets/scripts/features/puzzle/presentation/PuzzleBoardPresentation.ts');
const CONTROLLER = scriptType('assets/scripts/features/puzzle/controller/PuzzleController.ts');
for (const page of ['S04', 'S05']) {
    test(`${page}: board, scrolling tray and drag controller are wired for the puzzle feature`, () => {
        const objects = JSON.parse(fs.readFileSync(path.join(OUT, page + '.prefab'), 'utf8'));
        const node = ref => objects[ref.__id__], name = ref => node(ref)._name;
        const board = objects.find(o => o.__type__ === BOARD), controller = objects.find(o => o.__type__ === CONTROLLER);
        assert.equal(board.node.__id__, 1); assert.equal(controller.node.__id__, 1);
        assert.deepEqual([name(board.boardMount), name(board.piecesMount), name(board.trayViewport)], ['BoardMount', 'TrayContent', 'TrayView']);
        const scroll = node(board.trayScroll);
        assert.equal(scroll.__type__, 'cc.ScrollView');
        assert.equal(scroll._content.__id__, board.piecesMount.__id__, 'ScrollView content is the pieces mount');
        assert.equal(node(node(board.piecesMount)._parent).__type__ === 'cc.Node' && name(node(board.piecesMount)._parent), 'TrayView');
        assert.ok(node(board.trayViewport)._components.some(c => node(c).__type__ === 'cc.Mask'), 'tray clips extra pages');
        const textures = JSON.parse(board.textureAssetIds);
        const catalog = JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/bundles/puzzle/config/level-catalog.json'), 'utf8'));
        const registry = new Set(JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/resources/config/resource-registry.json'), 'utf8')).resources.map(r => r.id));
        for (const level of catalog.levels) for (const piece of level.pieces) assert.ok(registry.has(textures[piece.textureName]), piece.textureName);
        assert.ok(registry.has(board.wellAssetId) && registry.has(board.obstacleAssetId) && registry.has('puzzle.catalog'));
        assert.equal(node(controller.board).__type__, BOARD);
        assert.equal(controller.previewRoot.__id__, node(controller.previewGraphics).node.__id__);
        assert.equal(node(controller.previewRoot)._parent.__id__, board.boardMount.__id__, 'preview draws between cells and placed pieces');
        const children = objects[1]._children.map(name);
        assert.equal(children.indexOf('HintLayer'), children.indexOf('BoardMount') + 1, 'hint outlines sit right above the board');
        assert.equal(children.at(-1), 'DragRoot', 'dragged pieces render above everything');
    });
}

test('S02: side-entry red dots exist, hidden until feature code shows them', () => {
    const objects = JSON.parse(fs.readFileSync(path.join(OUT, 'S02.prefab'), 'utf8'));
    const view = objects.find(o => o.__type__ === VIEW);
    for (const id of ['signin_reddot', 'task_reddot']) {
        const node = objects[view.nodes[view.nodeIds.indexOf(id)].__id__];
        assert.equal(node._name, id); assert.equal(node._active, false);
    }
});

test('S19: every stage row can show claimed, claimable and locked states', () => {
    const objects = JSON.parse(fs.readFileSync(path.join(OUT, 'S19.prefab'), 'utf8'));
    const view = objects.find(o => o.__type__ === VIEW), ids = new Set(view.nodeIds);
    for (let i = 0; i < 4; i++) for (const id of [`stage_${i}_claim`, `stage_${i}_claim_label`, `stage_${i}_status`, `stage_${i}_status_text`]) assert.ok(ids.has(id), id);
    for (const id of ['mark_check', 'stage_1_mark', 'mark_lock', 'mark_lock_2']) assert.ok(ids.has(id), id);
    const claims = objects.filter(o => o.__type__ === 'cc.Button').flatMap(b => b.clickEvents.map(e => e.customEventData)).filter(d => /^stage_\d_claim$/.test(d));
    assert.deepEqual(claims.sort(), ['stage_0_claim', 'stage_1_claim', 'stage_2_claim', 'stage_3_claim']);
});
