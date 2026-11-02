import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
let ts;
try { ts = require('typescript'); } catch {
    ts = require([process.env.TYPESCRIPT_PATH,
        'G:/cocosCreator/Editor/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js']
        .find(path => path && existsSync(path)));
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sourceRoot = resolve(root, 'assets/scripts/features/mainline/presentation');
const noop = () => {};
class Component { enabled = true; node = { activeInHierarchy: true, emit: noop }; }
const cc = { Component, _decorator: { ccclass: () => target => target, property: () => noop } };
class CorePresentation {}
const cache = new Map();
function load(name) {
    if (cache.has(name)) return cache.get(name);
    const path = resolve(sourceRoot, `${name}.ts`);
    const output = ts.transpileModule(readFileSync(path, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true },
    }).outputText;
    const module = { exports: {} };
    const customRequire = id => id === 'cc' ? cc : id.endsWith('/Binding')
        ? { requireBinding(owner, field, value) { if (!value) throw new Error(`${owner}: missing ${field}`); return value; } }
        : id.endsWith('/CorePresentation') ? { CorePresentation } : load(id.split('/').at(-1));
    vm.runInThisContext(`(function(module,exports,require){${output}\n})`, { filename: path })(module, module.exports, customRequire);
    cache.set(name, module.exports); return module.exports;
}
const { MainlineLevelSelection } = load('MainlineLevelSelection');
const { MainlineMapPresentation } = load('MainlineMapPresentation');
const { levelRouteState } = load('LevelRoutePresentation');
const catalog = JSON.parse(readFileSync(resolve(root, 'assets/bundles/puzzle/config/level-catalog.json')));
const sourceCatalog = { getMainline: n => {
    const level = catalog.levels.find(level => level.mainlineNumber === n);
    if (!level) throw new Error('Invalid question');
    return level;
} };
function mapFixture() {
    const map = new MainlineMapPresentation(), calls = [];
    const selections = Array.from({ length: 8 }, () => new MainlineLevelSelection());
    map.layout = {
        itemMounts: Array.from({ length: 8 }, () => ({})),
        mountedItems: selections.map(selection => ({ node: { getComponent: type => type === MainlineLevelSelection ? selection : null } })),
        async present(scope, data) { calls.push(data); },
    };
    map.pageLabel = { string: '', node: { active: false } };
    map.previousButton = { node: { active: false } }; map.nextButton = { node: { active: false } }; map.actionTarget = {};
    return { map, calls, selections, scope: { isReleased: false } };
}

test('all twelve map pages bind the exact 96 identities without claiming stars or unlocks', async () => {
    const f = mapFixture();
    for (let page = 1; page <= 12; page++) {
        await f.map.present(f.scope, sourceCatalog, page);
        assert.deepEqual(f.selections.map(item => item.mainlineNumber), Array.from({ length: 8 }, (_, i) => (page - 1) * 8 + i + 1));
        assert.deepEqual(f.calls.at(-1).items.map(item => item.values.number), f.selections.map(item => item.mainlineNumber));
        assert.ok(f.calls.at(-1).items.every(item => item.accentAssetIds.every(asset => asset === null)));
        assert.equal(f.map.pageLabel.string, `${page} / 12`);
        assert.equal(f.map.pageLabel.node.active, true);
        assert.equal(f.map.previousButton.node.active, true);
        assert.equal(f.map.nextButton.node.active, true);
        assert.equal(f.map.previousButton.interactable, page > 1);
        assert.equal(f.map.nextButton.interactable, page < 12);
    }
});

test('item selection uses a typed number payload, while an unconfigured fixture keeps its original route', () => {
    const selection = new MainlineLevelSelection(), payloads = [];
    selection.node.emit = (name, payload) => payloads.push({ name, payload });
    selection.node.name = 'unrelated-title-53';
    selection.onSelect();
    assert.deepEqual(payloads.pop(), { name: 'view-action', payload: { actionId: 'nav:puzzle-preview' } });
    selection.configure(96); selection.onSelect();
    assert.deepEqual(payloads.pop(), { name: 'view-action', payload: { actionId: 'select:mainline', mainlineNumber: 96 } });
    selection.enabled = false; selection.onSelect(); assert.equal(payloads.length, 0);
    selection.enabled = true; selection.node.activeInHierarchy = false; selection.onSelect(); assert.equal(payloads.length, 0);
    for (const value of [0, 97, 1.5, 'classic-001']) assert.throws(() => selection.configure(value), /invalid/);
});

test('map rejects invalid pages and incomplete Inspector slot bindings', async () => {
    const f = mapFixture();
    for (const page of [0, 13, 1.5, '1']) await assert.rejects(f.map.present(f.scope, sourceCatalog, page), /invalid page/);
    f.map.layout.itemMounts.pop();
    await assert.rejects(f.map.present(f.scope, sourceCatalog, 1), /eight level slots/);
    f.map.layout.itemMounts.push({}); f.map.pageLabel = null;
    await assert.rejects(f.map.present(f.scope, sourceCatalog, 1), /missing pageLabel/);
});

test('late map preparation cannot configure hidden or reused item identity', async () => {
    const f = mapFixture(); let finish;
    f.map.layout.present = () => new Promise(resolve => { finish = resolve; });
    const pending = f.map.present(f.scope, sourceCatalog, 12);
    f.map.onDisable(); finish(); await pending;
    assert.equal(f.map.page, 0);
    assert.ok(f.selections.every(item => item.mainlineNumber === 0));
    const disposed = mapFixture();
    disposed.map.layout.present = async () => { disposed.scope.isReleased = true; };
    await disposed.map.present(disposed.scope, sourceCatalog, 2);
    assert.equal(disposed.map.page, 0);
});

test('every real question selects a compatible registered art layout and leaves its identity intact', () => {
    const registry = JSON.parse(readFileSync(resolve(root, 'assets/resources/framework/config/prefab-registry.json')));
    for (const level of catalog.levels.filter(level => level.mainlineNumber !== null)) {
        const id = level.id;
        for (const route of ['puzzle', 'puzzle-preview']) {
            const state = levelRouteState(route, level);
            assert.ok(registry.prefabs.find(item => item.id === route).stateIds.includes(state), `${id} ${state}`);
            assert.equal(level.id, id);
            if (level.mode === 'challenge') assert.ok(state.startsWith(route === 'puzzle' ? 'T05' : 'T04'));
            else assert.ok(state.startsWith(route === 'puzzle' ? 'T02' : 'T01'));
        }
    }
    assert.equal(levelRouteState('garden', sourceCatalog.getMainline(1)), undefined);
});
