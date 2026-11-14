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
    assert.equal(names.length, 29);
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
        if (file === 'ReplayRow.prefab') {
            // List item: VirtualListItem root, top-left anchored, whole row clickable.
            const item = objects.find(o => o.__type__ === scriptType('assets/scripts/framework/ui/VirtualListItem.ts'));
            assert.equal(item.node.__id__, 1);
            assert.deepEqual(objects[objects[1]._components[0].__id__]._anchorPoint, { __type__: 'cc.Vec2', x: 0, y: 1 });
            assert.equal(objects.find(o => o.__type__ === 'cc.Button').clickEvents[0].handler, 'onItemClicked');
            return;
        }
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
        const pin = node._components.map(c => objects[c.__id__]).find(c => c.side !== undefined);
        assert.equal(pin?.side, 0, `${id} pinned left with its entry`);
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

test('S16: map cards come from the MapCard prefab; the replay list is a VirtualList of ReplayRow', () => {
    const objects = JSON.parse(fs.readFileSync(path.join(OUT, 'S16.prefab'), 'utf8'));
    const view = objects.find(o => o.__type__ === VIEW);
    assert.ok(view.nodeIds.includes('MapList') && view.nodeIds.includes('ReplayList'));
    assert.ok(!view.nodeIds.some(id => /^m0d_|^enter$/.test(id)), 'layout cards are not baked into the page');
    const list = objects.find(o => o.__type__ === scriptType('assets/scripts/framework/ui/VirtualList.ts'));
    const registry = JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/resources/config/ui-prefabs.json'), 'utf8')).resources;
    assert.equal(list.itemPrefab.__uuid__, registry.find(r => r.id === 'prefab.ReplayRow').uuid);
    assert.ok(registry.some(r => r.id === 'prefab.MapCard'));
});

test('every imported picture: sprite-frame meta matches the PNG size (redrawn art renews its geometry)', () => {
    const bad = [];
    (function walk(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const file = path.join(dir, e.name);
            if (e.isDirectory()) walk(file);
            else if (e.name.endsWith('.png') && fs.existsSync(file + '.meta')) {
                const png = fs.readFileSync(file), frame = JSON.parse(fs.readFileSync(file + '.meta', 'utf8')).subMetas?.f9941?.userData;
                if (frame && (frame.rawWidth !== png.readUInt32BE(16) || frame.rawHeight !== png.readUInt32BE(20))) bad.push(path.relative(PROJECT, file));
            }
        }
    })(path.join(PROJECT, 'assets/bundles'));
    assert.deepEqual(bad, []);
});

test('capsule buttons keep round ends: laid out at the picture height and scaled uniformly', () => {
    const objects = JSON.parse(fs.readFileSync(path.join(OUT, 'S06.prefab'), 'utf8'));
    for (const name of ['btn_green', 'btn_grey']) {
        const node = objects.find(o => o.__type__ === 'cc.Node' && o._name === name), ui = objects[node._components[0].__id__];
        assert.equal(ui._contentSize.height, 92, name);
        assert.equal(node._lscale.x, node._lscale.y, name);
    }
});

test('prefabs only reference their own bundle, the main package, or bundles loaded at boot (built games load bundles separately)', () => {
    const boot = /const BUNDLES = \[([^\]]*)\]/.exec(fs.readFileSync(path.join(PROJECT, 'assets/scripts/app/GameBoot.ts'), 'utf8'))[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
    const bundleOf = new Map(), roots = fs.readdirSync(path.join(PROJECT, 'assets/bundles'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
    for (const name of roots) (function walk(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const file = path.join(dir, e.name);
            if (e.isDirectory()) walk(file);
            else if (e.name.endsWith('.meta')) { const m = JSON.parse(fs.readFileSync(file, 'utf8')); bundleOf.set(m.uuid, name); for (const s of Object.values(m.subMetas ?? {})) bundleOf.set(s.uuid, name); }
        }
    })(path.join(PROJECT, 'assets/bundles', name));
    const bad = [];
    for (const name of roots) (function walk(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const file = path.join(dir, e.name);
            if (e.isDirectory()) walk(file);
            else if (e.name.endsWith('.prefab')) for (const [, uuid] of fs.readFileSync(file, 'utf8').matchAll(/"__uuid__": "([^"]+)"/g)) {
                const target = bundleOf.get(uuid);
                if (target && target !== name && !boot.includes(target)) bad.push(`${path.relative(PROJECT, file)} -> ${target}`);
            }
        }
    })(path.join(PROJECT, 'assets/bundles', name));
    assert.deepEqual(bad, []);
});

test('edge pins: HUD / bottom band groups follow their side, centre stays, children inherit', async () => {
    const { edgePins, pageLayout } = await import('../build-ui.mjs');
    const pins = edgePins(pageLayout('S02.json'));
    for (const id of ['hud_level_badge', 'player_level', 'signin_entry', 'signin_text', 'home_btn_build', 'build_text', 'build_reddot', 'home_btn_back', 'back_text']) assert.equal(pins.get(id), 0, id);
    for (const id of ['hud_btn_square_purple', 'icon_settings', 'hud_coin', 'coin_value', 'endless_entry']) assert.equal(pins.get(id), 1, id);
    for (const id of ['hud_energy', 'energy_icon', 'energy_count', 'home_play_btn', 'play_text', 'map_name']) assert.equal(pins.has(id), false, id);
    const s03 = edgePins(pageLayout('S03.json'));
    assert.equal(s03.get('home_btn_home'), 0); assert.equal(s03.get('icon_gift'), 1);
});

test('S02 bottom: no bar or home button; square build button bottom-left, Play centred, back button hidden', async () => {
    const { pageLayout, HOME_ROW } = await import('../build-ui.mjs');
    const layout = pageLayout('S02.json'), el = id => layout.elements.find(e => e.id === id), [W, H] = layout.size;
    for (const id of ['home_bottom_bar', 'home_btn_home', 'icon_home']) assert.equal(el(id), undefined, id);
    const play = el('home_play_btn').rect, build = el('home_btn_build').rect;
    assert.deepEqual(el('home_btn_back').rect, build, 'back button takes the build button place');
    assert.equal(build[2], build[3], 'square'); assert.equal(build[3], HOME_ROW.height);
    assert.ok(Math.abs(play[0] + play[2] / 2 - W / 2) <= 1, 'Play centred');
    assert.ok(build[0] + build[2] < play[0], 'build left of Play');
    assert.equal(play[1], build[1]); assert.equal(H - (play[1] + play[3]), HOME_ROW.margin);
    const objects = JSON.parse(fs.readFileSync(path.join(OUT, 'S02.prefab'), 'utf8'));
    const view = objects.find(o => o.__type__ === VIEW), node = id => objects[view.nodes[view.nodeIds.indexOf(id)].__id__];
    for (const id of ['home_btn_back', 'icon_back', 'back_text', 'build_reddot']) assert.equal(node(id)._active, false, id);
    for (const id of ['home_btn_build', 'icon_build', 'build_text']) assert.equal(node(id)._active, true, id);
    const actions = objects.filter(o => o.__type__ === 'cc.Button').flatMap(b => b.clickEvents.map(e => e.customEventData));
    for (const id of ['home_btn_build', 'home_btn_back', 'home_play_btn']) assert.ok(actions.includes(id), id);
});

test('HUD energy: count label drawn over the enlarged heart on every page with the energy capsule', async () => {
    const { pageLayout } = await import('../build-ui.mjs');
    for (const page of ['S02', 'S03', 'S04', 'S05', 'S16']) {
        const els = pageLayout(`${page}.json`).elements, ids = els.map(e => e.id), el = id => els.find(e => e.id === id);
        assert.equal(ids.indexOf('energy_count'), ids.indexOf('energy_icon') + 1, `${page}: count right above the heart`);
        const heart = el('energy_icon').rect, capsule = el('hud_energy').rect, value = el('energy_value').rect;
        assert.ok(heart[3] > capsule[3], `${page}: heart taller than the capsule`);
        assert.ok(value[0] >= heart[0] + heart[2] && value[0] + value[2] <= capsule[0] + capsule[2], `${page}: status text inside the capsule, right of the heart`);
    }
});


test('HomeController only touches element ids that exist on S02 / S03 / BuildAnchor', () => {
    const ids = new Set(['S02', 'S03', 'BuildAnchor'].flatMap(name => {
        const view = JSON.parse(fs.readFileSync(path.join(OUT, `${name}.prefab`), 'utf8')).find(o => o.__type__ === VIEW);
        return [...view.nodeIds, ...view.labelIds];
    }));
    const src = fs.readFileSync(path.join(PROJECT, 'assets/scripts/app/HomeController.ts'), 'utf8');
    const used = src.split('\n').filter(l => /setVisible|setText|element\(/.test(l)).flatMap(l => [...l.matchAll(/'([a-z][a-z0-9_]+)'/g)].map(m => m[1]));
    assert.ok(used.length > 10);
    assert.deepEqual([...new Set(used)].filter(id => !ids.has(id) && !['build', 'left', 'upgrade', 'drag1'].includes(id)), []);
});
