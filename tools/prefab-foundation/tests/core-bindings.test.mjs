import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { prefabCatalog } from '../catalog.mjs';
import { scriptType } from '../builder.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = file => JSON.parse(fs.readFileSync(path.join(project, file), 'utf8'));
const registry = read('assets/resources/framework/config/prefab-registry.json');
const byId = new Map(registry.prefabs.map(record => [record.id, record]));
const artManifest = read('assets/resources/framework/config/source-art-manifest.json');
const artRecords = new Map([...artManifest.records, ...artManifest.derivatives].map(record => [record.id, record]));
const layoutManifest = read('tools/prefab-foundation/layout-manifest.json');
function originalFile(id) {
    let record = artRecords.get(id);
    if (record?.sourceId) record = artRecords.get(record.sourceId);
    assert.ok(record?.sourceAssetFile, `Unregistered item artwork ${id}`);
    return record.sourceAssetFile;
}
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(project, '../prototype/block-data.js'), 'utf8'), context);
const configs = context.window.BlockArt.configs;
const coreIds = ['garden', 'puzzle-preview', 'puzzle', 'puzzle-result', 'pause', 'settings', 'confirmation', 'help-index', 'help-detail'];
function asset(id) {
    const record = byId.get(id); assert.ok(record, `Missing ${id}`);
    const objects = read(record.path), root = objects[0].data.__id__;
    const view = objects[record.rootComponent];
    return { record, objects, root, view };
}
function nodeOf(a, reference) {
    const value = a.objects[reference?.__id__];
    assert.ok(value, `Invalid serialized object ${JSON.stringify(reference)} in ${a.record.id}`);
    return value.__type__ === 'cc.Node' ? reference.__id__ : value.node?.__id__;
}
function isWithin(a, node, ancestor) {
    const seen = new Set();
    while (node !== undefined && node !== null) {
        assert.ok(!seen.has(node), 'Hierarchy cycle'); seen.add(node);
        if (node === ancestor) return true;
        node = a.objects[node]._parent?.__id__;
    }
    return false;
}
function activeForState(a, node, state) {
    while (node !== state) {
        const object = a.objects[node];
        if (!object || object._active === false) return false;
        node = object._parent?.__id__;
        if (node === undefined) return false;
    }
    return true;
}
const presenters = a => a.objects.filter(object => Array.isArray(object.itemMounts) && Array.isArray(object.itemData) && Array.isArray(object.progressKeys));
const sourceLayout = (a, state) => layoutManifest.prefabs.find(record => record.id === a.record.id)?.layouts.find(layout => layout.node.__id__ === state);
const presentation = (a, state) => presenters(a).find(object => object.node.__id__ === state);
const statesOf = a => a.view.stateRoots || [{ __id__: a.root }];
const fieldStates = (a, name) => a.view[name + 'States'] || [a.view[name]];
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-6, message || `${a} != ${b}`);

test('loading is a single manually authored page with a real zero-initialized progress bar', () => {
    const a = asset('loading'), { view, record } = a;
    assert.equal(record.maintenance, 'manual');
    assert.deepEqual(record.bindings.map(({ name, type }) => [name, type]), [['progressBar', 'ProgressBar'], ['progressLabel', 'Label']]);
    const bar = a.objects[view.progressBar?.__id__], label = a.objects[view.progressLabel?.__id__];
    assert.equal(bar?.__type__, 'cc.ProgressBar');
    assert.equal(label?.__type__, 'cc.Label');
    assert.equal(bar._mode, 0); assert.equal(bar._reverse, false);
    assert.equal(bar._totalLength, 590); assert.equal(bar._progress, 0);
    assert.equal(label._string, '0%');
    const fill = a.objects[bar._barSprite?.__id__];
    assert.equal(fill?.__type__, 'cc.Sprite');
    assert.equal(a.objects[fill.node.__id__]._parent.__id__, bar.node.__id__);
    assert.equal(label.node && a.objects[label.node.__id__]._parent.__id__, bar.node.__id__);
    const fillTransform = a.objects[a.objects[fill.node.__id__]._components.find(r => a.objects[r.__id__].__type__ === 'cc.UITransform').__id__];
    assert.equal(fillTransform._anchorPoint.x, 0);
    const rootTransform = a.objects[a.objects[a.root]._components.find(r => a.objects[r.__id__].__type__ === 'cc.UITransform').__id__];
    assert.deepEqual([rootTransform._contentSize.width, rootTransform._contentSize.height], [853, 1844]);
    for (const object of a.objects) {
        for (const field of ['stateRoots', 'stateIds', 'sourceLayouts', 'visualRootStates', 'dynamicRootStates', 'statusLabelStates', 'progressLabelStates', 'layouts', 'imageIds', 'progressKeys'])
            assert.equal(Object.hasOwn(object, field), false, `Loading retains generated presentation field ${field}`);
    }
    assert.deepEqual(a.objects.filter(object => object.__type__ === 'cc.Node').map(object => object._name), ['LoadingPage', 'bj', 'title', 'bar1', 'bar2', 'Label']);
    const managed = read('tools/prefab-foundation/generated-files.json');
    assert.ok(managed.files.every(entry => entry.path !== record.path && entry.path !== record.scriptPath), 'Manual Loading must not be re-enrolled as generated output');
});

test('manual mainline map binds its root presentation without generated state scaffolding', () => {
    const { record, view, objects, root } = asset('mainline-map');
    const catalog = prefabCatalog.find(item => item.id === record.id);
    assert.equal(catalog.maintenance, 'manual');
    assert.equal(record.maintenance, 'manual');
    assert.deepEqual(catalog.bindings.map(({ name, type }) => [name, type]), record.bindings.map(({ name, type }) => [name, type]));
    assert.ok(objects[root]._components.some(reference => reference.__id__ === record.rootComponent));
    assert.deepEqual(record.stateIds, []);
    for (const field of ['stateIds', 'stateRoots', 'sourceLayouts', 'visualRoot', 'dynamicRoot', 'nodesRoot', 'levelNodePrefab', 'gardenButton', 'settingsButton'])
        assert.equal(Object.hasOwn(view, field), false, `Manual map retains template field ${field}`);
    const map = objects[view.presentation?.__id__];
    assert.equal(map?.__type__, scriptType('assets/scripts/features/mainline/presentation/MainlineMapPresentation.ts'));
    assert.equal(map.node.__id__, root);
    const layout = objects[map.layout?.__id__];
    assert.equal(layout?.__type__, scriptType('assets/scripts/features/presentation/CorePresentation.ts'));
    assert.equal(layout.node.__id__, root);
    assert.equal(layout.actionTarget.__id__, root);
    assert.equal(layout.itemMounts.length, 8);
    assert.ok(layout.itemPrefabs.every(reference => reference.__uuid__ === byId.get('level-node').uuid));
    for (const type of ['SourceLayout', 'PresentationGroup'])
        assert.ok(objects.every(object => object.__type__ !== scriptType(type === 'SourceLayout'
            ? 'assets/scripts/ui/common/SourceLayout.ts' : 'assets/scripts/features/presentation/PresentationGroup.ts')));
    const managed = read('tools/prefab-foundation/generated-files.json');
    assert.ok(managed.files.every(entry => entry.path !== record.path && entry.path !== record.scriptPath), 'Manual map must not be rebuilt as generated output');
});

for (const id of coreIds) {
    test(`${id}: every variant's typed fields point into its real active layout`, () => {
        const a = asset(id), { view, record } = a;
        const states = statesOf(a), multiple = record.stateIds.length > 1;
        if (multiple) {
            assert.deepEqual(view.stateIds, record.stateIds);
            assert.equal(view.stateRoots.length, view.stateIds.length);
        } else {
            for (const field of ['stateIds', 'stateRoots', 'sourceLayouts'])
                assert.equal(Object.hasOwn(view, field), false, `${id} retains single-state scaffolding`);
        }
        assert.equal(presenters(a).length, states.length);
        for (const binding of record.bindings) {
            const variants = fieldStates(a, binding.name);
            assert.ok(Array.isArray(variants), `${id}.${binding.name} lacks state-specific bindings`);
            assert.equal(variants.length, states.length);
            if (!multiple) assert.equal(Object.hasOwn(view, binding.name + 'States'), false, 'Single state has parallel bindings');
            assert.deepEqual(view[binding.name], variants[0], 'Initial public binding must match default variant');
            variants.forEach((reference, i) => {
                if (binding.type === 'Prefab') {
                    assert.ok(registry.prefabs.some(p => p.uuid === reference.__uuid__), 'Referenced item is unregistered'); return;
                }
                const object = a.objects[reference.__id__];
                assert.equal(object.__type__ === 'cc.Node' ? 'Node' : object.__type__.replace('cc.', ''), binding.type);
                assert.notEqual(object._enabled, false, `${binding.name} component is disabled`);
                const node = nodeOf(a, reference), state = states[i].__id__;
                assert.ok(isWithin(a, node, state), `${id}.${binding.name}[${i}] points outside selected state`);
                assert.ok(activeForState(a, node, state), `${id}.${binding.name}[${i}] points to an inactive placeholder`);
            });
        }
    });
}

test('garden total progress uses the total track/fill, distinct from every building progress bar', () => {
    const a = asset('garden');
    statesOf(a).forEach((reference, i) => {
        const p = presentation(a, reference.__id__);
        const total = a.view.gardenProgressStates[i].__id__, bar = a.objects[total];
        assert.equal(a.objects[bar.node.__id__]._name, '花园25阶总进度底轨');
        assert.equal(a.objects[nodeOf(a, bar._barSprite)]._name, '花园25阶总进度填充');
        const index = p.progressKeys.indexOf('gardenProgress');
        assert.equal(p.progressBars[index].__id__, total);
        assert.equal(p.progressKeys.filter(key => /^buildingProgress\d$/.test(key)).length, 5);
        p.progressKeys.forEach((key, j) => { if (key.startsWith('buildingProgress')) assert.notEqual(p.progressBars[j].__id__, total); });
        const expected = (configs[a.view.stateIds[i]].runtime?.total_level ?? 0) / 25;
        near(JSON.parse(p.previewData).values.gardenProgress, expected);
    });
});

function checkItems(id, templateId, pattern, count) {
    const a = asset(id), template = asset(templateId);
    assert.ok(template.objects.some(object => object.body && Array.isArray(object.accents) && Array.isArray(object.labelKeys)), `${templateId} lacks PresentationItem`);
    const states = statesOf(a);
    states.forEach((reference, stateIndex) => {
        const state = reference.__id__, p = presentation(a, state), source = sourceLayout(a, state);
        const stateId = id === 'mainline-map' ? a.record.sourcePage : a.record.stateIds[stateIndex];
        const expected = configs[stateId].layers.filter(layer => layer.visible !== false && layer.file && pattern.test(layer.name));
        const actual = p.itemPrefabs.map((reference, i) => ({ reference, i })).filter(entry => entry.reference.__uuid__ === template.record.uuid);
        if (count !== undefined) assert.equal(actual.length, count);
        assert.equal(actual.length, expected.length, `${id}/${stateIndex}: visual entries lost or duplicated`);
        assert.equal(p.itemMounts.length, p.itemPrefabs.length);
        assert.equal(p.itemMounts.length, p.itemData.length);
        actual.forEach(({ i }) => {
            const node = p.itemMounts[i].__id__, mount = a.objects[node], data = JSON.parse(p.itemData[i]);
            assert.ok(activeForState(a, node, state), 'Reusable item mount is inactive or belongs to another state');
            assert.ok(data.bodyAssetId && data.bodyBox && data.rootSize, 'Item has no registered source presentation');
            assert.ok([data.bodyBox.x, data.bodyBox.y, data.bodyBox.width, data.bodyBox.height, ...data.rootSize].every(Number.isFinite));
            assert.ok(mount._children.length === 0, 'Editor source instances must not duplicate runtime item mount');
            const rootUI = a.objects[a.objects[a.root]._components.find(r => a.objects[r.__id__].__type__ === 'cc.UITransform').__id__];
            const centerX = mount._lpos.x + data.bodyBox.x + rootUI._contentSize.width / 2;
            const centerY = rootUI._contentSize.height / 2 - mount._lpos.y - data.bodyBox.y;
            const sourceFile = originalFile(data.bodyAssetId);
            assert.ok(expected.some(layer => {
                const anchor = layer.anchor || [0, 0];
                return layer.file === sourceFile && Math.abs(centerX - layer.position[0] - layer.size[0] * (.5 - anchor[0])) < 1e-6
                    && Math.abs(centerY - layer.position[1] - layer.size[1] * (.5 - anchor[1])) < 1e-6
                    && Math.abs(data.bodyBox.width - layer.size[0]) < 1e-6 && Math.abs(data.bodyBox.height - layer.size[1]) < 1e-6;
            }), `${id}: item artwork identity/center/size does not match an original source layer`);
        });
        for (const layer of expected) {
            const matching = a.objects.map((object, index) => ({ object, index })).filter(entry => entry.object.__type__ === 'cc.Node'
                && entry.object._name === layer.name && isWithin(a, entry.index, state) && !p.itemMounts.some(r => r.__id__ === entry.index));
            if (id === 'mainline-map') {
                assert.equal(matching.length, 0, `Map retains redundant source layer ${layer.name}`);
                continue;
            }
            assert.ok(matching.length, `Missing retained source layer ${layer.name}`);
            matching.forEach(({ object, index }) => {
                assert.equal(object._active, false, `${layer.name} duplicates the instantiated template`);
                assert.ok(!source.dynamicSprites.some(r => a.objects[r.__id__].node.__id__ === index), `${layer.name} is still dynamically loaded`);
            });
        }
    });
}

test('map uses eight real level-node templates at the original artwork positions without redundant source plates', () => checkItems('mainline-map', 'level-node', /^关卡\d+底板$/, 8));
test('garden uses five real building templates in every state with hidden source bodies', () => checkItems('garden', 'building', /^(?!.*转子)(向阳花园|清风水湾|云上蜂谷)_.*_\d级/, 5));
test('waterwheel rotors are supplied to the building instance and their original source slots are hidden', () => {
    const a = asset('garden');
    statesOf(a).forEach(reference => {
        const state = reference.__id__, p = presentation(a, state), source = sourceLayout(a, state);
        const rotors = a.objects.map((object, index) => ({ object, index })).filter(entry => entry.object.__type__ === 'cc.Node'
            && /独立水轮转子/.test(entry.object._name) && isWithin(a, entry.index, state));
        const wheels = p.itemData.map(json => JSON.parse(json)).filter(data => data.rotorAssetId);
        assert.equal(wheels.length, rotors.length);
        for (const wheel of wheels) assert.ok(wheel.rotorBox && Object.values(wheel.rotorBox).every(Number.isFinite));
        for (const rotor of rotors) {
            assert.equal(rotor.object._active, false);
            assert.ok(!source.dynamicSprites.some(r => a.objects[r.__id__].node.__id__ === rotor.index));
        }
    });
});
for (const id of ['puzzle', 'puzzle-preview']) {
    test(`${id}: all original wells and piece cells use hex-cell templates without double rendering`, () => checkItems(id, 'hex-cell', /^主棋盘_凹槽_|^完整托盘_拼块\d+_格\d+$/));
    test(`${id}: original tray is replaced by one true tray-slot template per state`, () => checkItems(id, 'tray-slot', /^完整托盘_无字木托盘$/, 1));
}

test('all CorePresentation components forward item actions to the serialized page root', () => {
    for (const id of coreIds) {
        const a = asset(id);
        for (const p of presenters(a)) assert.equal(p.actionTarget?.__id__, a.root, `${id} has no page-root action target`);
    }
});

test('level-node click uses puzzle preview navigation, and help-index return uses back', () => {
    const item = asset('level-node'), levelButton = item.objects[item.view.button.__id__];
    assert.ok(levelButton.clickEvents.some(event => event.component === 'MainlineLevelSelection' && event.handler === 'onSelect' && event.customEventData === 'nav:puzzle-preview'));
    assert.ok(levelButton.clickEvents.every(event => event.handler !== 'onAction' || event.customEventData === 'nav:puzzle-preview'));
    const help = asset('help-index');
    fieldStates(help, 'backButton').forEach(reference => {
        const button = help.objects[reference.__id__];
        assert.ok(button.clickEvents.some(event => event.handler === 'onAction' && event.customEventData === 'back'));
        assert.ok(button.clickEvents.every(event => event.target.__id__ === help.root));
    });
});

test('core presentation labels and image slots never retain the same hidden replacement nodes', () => {
    for (const id of coreIds) {
        const a = asset(id);
        statesOf(a).forEach(reference => {
            const state = reference.__id__, p = presentation(a, state), source = sourceLayout(a, state);
            for (const r of [...p.labels, ...source.dynamicSprites, ...source.dynamicLabels]) {
                assert.ok(activeForState(a, nodeOf(a, r), state), `${id} still loads or updates a hidden replaced source slot`);
            }
        });
    }
});

test('puzzle hint outlines and selected-tray highlights render above the corresponding reusable cells', () => {
    const a = asset('puzzle');
    const order = node => {
        const result = [];
        while (node !== a.root) {
            const parent = a.objects[node]._parent?.__id__;
            assert.notEqual(parent, undefined);
            result.unshift(a.objects[parent]._children.findIndex(r => r.__id__ === node)); node = parent;
        }
        return result;
    };
    const isLater = (left, right) => {
        const l = order(left), r = order(right);
        for (let i = 0; i < Math.min(l.length, r.length); i++) if (l[i] !== r[i]) return l[i] > r[i];
        return l.length > r.length;
    };
    let checked = 0;
    statesOf(a).forEach((reference, stateIndex) => {
        const source = sourceLayout(a, reference.__id__);
        source.geometrySpecs.forEach((json, i) => {
            const spec = JSON.parse(json).spec;
            const below = spec.role === 'outline' ? fieldStates(a, 'boardRoot')[stateIndex]
                : spec.role === 'selection' ? fieldStates(a, 'trayRoot')[stateIndex] : null;
            if (!below) return;
            assert.ok(isLater(source.geometryMounts[i].__id__, below.__id__), `${spec.role} is occluded by its reusable cell container`);
            checked++;
        });
    });
    assert.ok(checked >= 2, 'The authored hint variant must include board and tray highlights');
});
