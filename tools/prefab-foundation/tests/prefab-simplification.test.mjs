import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PROJECT } from '../io.mjs';
import { scriptType } from '../builder.mjs';
import { sourceConfigs } from '../catalog.mjs';
import { authoredVisuals } from './authored-visuals.mjs';

const read = file => JSON.parse(fs.readFileSync(path.join(PROJECT, file), 'utf8'));
const registry = read('assets/resources/framework/config/prefab-registry.json');
const manifest = read('tools/prefab-foundation/layout-manifest.json');
const before = read('tools/prefab-foundation/tests/fixtures/authored-visuals-before.json');
const sources = new Map(manifest.prefabs.map(record => [record.id, record.layouts]));
const assets = new Map(registry.prefabs.map(record => [record.id, read(record.assetPath)]));
const listType = scriptType('assets/scripts/framework/ui/VirtualList.ts');
const listItemType = scriptType('assets/scripts/framework/ui/VirtualListItem.ts');

test('all existing artwork identities, default text, positions and styles survive regrouping', () => {
    assert.equal(before.prefabs.length, 80);
    for (const snapshot of before.prefabs) {
        const record = registry.prefabs.find(record => record.id === snapshot.id);
        assert.equal(record.uuid, snapshot.uuid, `${snapshot.id} Prefab identity changed`);
        assert.deepEqual(record.layoutSize, snapshot.size, `${snapshot.id} design extent changed`);
        const layouts = sources.get(snapshot.id);
        assert.equal(layouts?.length, snapshot.layouts.length, `${snapshot.id} lost authored variants`);
        layouts.forEach((layout, i) => {
            const expected = snapshot.layouts[i];
            assert.equal(layout.sourcePage, expected.sourcePage);
            // No fallback map: all images and default text must now actually be
            // serialized, rather than reconstructed by a SourceLayout component.
            const visuals = authoredVisuals(assets.get(snapshot.id), layout, new Map(), layouts.map(entry => entry.node.__id__));
            // These three source-less utility views previously contained only
            // inactive fallback controls. The migration authors their real
            // controls explicitly; no original artwork is exempted here.
            const authoredUtilities = {
                toast: [['Message', '提示信息']],
                'gm-panel': [['Title', '开发工具'], ['Close', '×']],
                'gm-command': [['CommandLabel', '开发命令']],
            }[snapshot.id];
            if (authoredUtilities) {
                assert.equal(layout.sourcePage, '');
                assert.equal(expected.count, 0);
                assert.deepEqual(visuals.map(visual => [visual.name, visual.text]), authoredUtilities);
                assert.ok(visuals.every(visual => visual.kind === 'label' && visual.box[2] > 0 && visual.box[3] > 0));
                return;
            }
            assert.equal(visuals.length, expected.count, `${snapshot.id}/${i} visible artwork count changed`);
            assert.equal(createHash('sha256').update(JSON.stringify(visuals)).digest('hex'), expected.hash,
                `${snapshot.id}/${i} artwork identity, text, placement, order or style changed`);
        });
    }
});

test('ordinary views expose real controls without universal roots or single-state arrays', () => {
    const removedType = scriptType('assets/scripts/ui/common/SourceLayout.ts');
    for (const record of registry.prefabs) {
        const objects = assets.get(record.id), root = objects[objects[0].data.__id__];
        for (const object of objects) {
            assert.notEqual(object.__type__, removedType, `${record.id} retains runtime SourceLayout`);
            assert.ok(!['VisualRoot', 'DynamicRoot'].includes(object._name), `${record.id} retains a universal wrapper`);
            assert.equal(Object.hasOwn(object, 'sourceLayouts'), false, `${record.id} retains source-layout Inspector arrays`);
            assert.equal(Object.hasOwn(object, 'visualRoot'), false, `${record.id} retains removed visualRoot binding`);
            assert.equal(Object.hasOwn(object, 'dynamicRoot'), false, `${record.id} retains removed dynamicRoot binding`);
        }
        if (record.id === 'virtual-list') continue;
        const view = objects[record.rootComponent];
        assert.ok(root._components.some(reference => reference.__id__ === record.rootComponent), `${record.id} View is detached`);
        if (record.stateIds.length <= 1) {
            assert.equal(Object.hasOwn(view, 'stateRoots'), false, `${record.id} retains single-state roots`);
            assert.equal(Object.hasOwn(view, 'stateIds'), false, `${record.id} retains single-state identifiers`);
            assert.ok(Object.keys(view).every(field => !field.endsWith('States')), `${record.id} retains parallel single-state bindings`);
        } else {
            assert.deepEqual(view.stateIds, record.stateIds);
            assert.equal(view.stateRoots.length, record.stateIds.length);
            assert.equal(new Set(view.stateRoots.map(reference => reference.__id__)).size, record.stateIds.length);
        }
        for (const binding of record.bindings) {
            const reference = view[binding.name];
            if (binding.type === 'Prefab') { assert.ok(reference?.__uuid__, `${record.id}.${binding.name} missing Prefab`); continue; }
            const component = objects[reference?.__id__];
            assert.ok(component, `${record.id}.${binding.name} is broken`);
            const node = component.__type__ === 'cc.Node' ? component : objects[component.node.__id__];
            assert.ok(!(node._active === false && node._name === binding.name), `${record.id}.${binding.name} is an inactive generated placeholder`);
        }
    }
});

test('virtual-list behavior and its click callback belong only to actual registered list templates', () => {
    const templates = new Set();
    for (const objects of assets.values()) for (const list of objects.filter(object => object.__type__ === listType)) {
        templates.add(list.itemPrefab.__uuid__);
    }
    assert.ok(templates.size >= 5, 'Real product lists and demonstration list disappeared');
    for (const record of registry.prefabs) {
        const objects = assets.get(record.id), cells = objects.filter(object => object.__type__ === listItemType);
        assert.equal(cells.length, templates.has(record.uuid) ? 1 : 0, `${record.id} has incorrect list-item ownership`);
        let listCallbacks = 0;
        for (const button of objects.filter(object => object.__type__ === 'cc.Button')) {
            const events = button.clickEvents.map(reference => reference.__id__ === undefined ? reference : objects[reference.__id__]);
            assert.ok(events.length > 0, `${record.id} contains an unbound button`);
            const listClicks = events.filter(event => (event.component === 'VirtualListItem' || event._componentId === listItemType) && event.handler === 'onItemClicked');
            listCallbacks += listClicks.length;
            if (listClicks.length) {
                assert.equal(events.length, 1, `${record.id} fires both generic and list actions`);
                assert.equal(listClicks.length, 1);
            }
            assert.equal(new Set(events.map(event => JSON.stringify([event.target, event.component, event.handler, event.customEventData]))).size,
                events.length, `${record.id} has duplicated button events`);
        }
        assert.equal(listCallbacks, cells.length, `${record.id} must bind exactly one click callback per actual list item`);
    }
    const companion = assets.get('scene-companion'), record = registry.prefabs.find(record => record.id === 'scene-companion');
    assert.deepEqual(record.bindings.map(binding => binding.name), ['icon']);
    assert.equal(companion.filter(object => object.__type__ === 'cc.Button').length, 0);
    assert.ok(companion.some(object => object.__type__ === 'cc.Sprite' && object._spriteFrame?.__uuid__), 'Companion artwork cannot be empty');
});

test('build-only source metadata keeps exact original procedural specifications and valid serialized slots', () => {
    for (const [id, layouts] of sources) {
        const objects = assets.get(id);
        assert.ok(objects, `Orphan source manifest record ${id}`);
        for (const layout of layouts) {
            assert.equal(objects[layout.node.__id__]?.__type__, 'cc.Node');
            assert.equal(layout.geometryMounts.length, layout.geometrySpecs.length);
            assert.equal(layout.dynamicSprites.length, layout.imageIds.length);
            assert.equal(layout.dynamicLabels.length, layout.previewTexts.length);
            assert.equal(layout.dynamicLabels.length, layout.textKeys.length);
            for (const reference of layout.dynamicSprites) {
                const sprite = objects[reference.__id__];
                assert.equal(sprite?.__type__, 'cc.Sprite');
                assert.ok(sprite._spriteFrame?.__uuid__, `${id} artwork still requires runtime source injection`);
            }
            layout.dynamicLabels.forEach((reference, i) => {
                assert.equal(objects[reference.__id__]?.__type__, 'cc.Label');
                assert.equal(objects[reference.__id__]._string, String(layout.previewTexts[i]).replace(/\r\n?/g, '\n'));
            });
            const original = sourceConfigs[layout.sourcePage];
            layout.geometrySpecs.forEach((json, i) => {
                assert.equal(objects[layout.geometryMounts[i].__id__]?.__type__, 'cc.Node');
                const value = JSON.parse(json);
                assert.ok(original.layers.some(layer => JSON.stringify(layer.procedural) === JSON.stringify(value.spec)
                    && JSON.stringify(layer.procedural_crop) === JSON.stringify(value.crop)), `${id} changed original procedural geometry`);
            });
        }
    }
});
