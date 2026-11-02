import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const candidates = [process.env.TYPESCRIPT_PATH,
    'G:/cocosCreator/Editor/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js',
    'D:/Program Files/Trae/resources/app/extensions/node_modules/typescript/lib/typescript.js'];
let ts;
try { ts = require('typescript'); } catch {
    const candidate = candidates.find(value => value && fs.existsSync(value));
    if (!candidate) throw new Error('Set TYPESCRIPT_PATH to an existing TypeScript installation.');
    ts = require(candidate);
}

function runtime() {
    let instantiated = 0;
    class Component { enabled = true; get isValid() { return this.node?.isValid ?? true; } }
    class Node {
        active = true; isValid = true; _parent = null; children = []; components = new Map(); events = new Map(); position = { x: 0, y: 0, z: 0 }; scale = { x: 1, y: 1 };
        get parent() { return this._parent; }
        set parent(value) { if (this._parent) this._parent.children = this._parent.children.filter(child => child !== this); this._parent = value; if (value) value.children.push(this); }
        get activeInHierarchy() { return this.active && (!this.parent || this.parent.activeInHierarchy); }
        add(type) { const component = new type(); component.node = this; this.components.set(type, component); return component; }
        getComponent(type) { return this.components.get(type) || null; }
        setPosition(x, y, z) { this.position = { x, y, z }; }
        on(event, callback, owner) { const entries = this.events.get(event) || []; entries.push({ callback, owner }); this.events.set(event, entries); }
        off(event, callback, owner) { this.events.set(event, (this.events.get(event) || []).filter(entry => entry.callback !== callback || entry.owner !== owner)); }
        emit(event, payload) { for (const entry of [...this.events.get(event) || []]) entry.callback.call(entry.owner, payload); }
        destroy() { this.isValid = false; for (const component of this.components.values()) component.onDestroy?.(); }
    }
    class SpriteFrame { constructor(id) { this.id = id; } }
    class Sprite extends Component { spriteFrame = null; }
    class Label extends Component { string = ''; fontSize = 20; lineHeight = 24; }
    class ProgressBar extends Component { progress = 0; }
    class UITransform extends Component { width = 100; height = 100; setContentSize(width, height) { this.width = width; this.height = height; } }
    class Prefab { constructor(create) { this.create = create; this.data = create(); } }
    const cc = { Component, Node, SpriteFrame, Sprite, Label, ProgressBar, UITransform, Prefab, CCString: String,
        _decorator: { ccclass: () => target => target, property: (...args) => args.length >= 2 ? undefined : () => {} },
        isValid: object => object && object.isValid !== false,
        instantiate: prefab => { instantiated++; return prefab.create(); },
    };
    const cache = new Map();
    function load(filename) {
        filename = path.resolve(filename.endsWith('.ts') ? filename : filename + '.ts');
        if (cache.has(filename)) return cache.get(filename).exports;
        const module = { exports: {} }; cache.set(filename, module);
        const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
            target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
        } }).outputText;
        vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(
            id => id === 'cc' ? cc : load(path.resolve(path.dirname(filename), id)), module, module.exports);
        return module.exports;
    }
    const root = path.join(project, 'assets/scripts/features/presentation');
    const { PresentationItem } = load(path.join(root, 'PresentationItem'));
    const { CorePresentation } = load(path.join(root, 'CorePresentation'));
    const { PresentationGroup } = load(path.join(root, 'PresentationGroup'));
    const createItem = () => {
        const node = new Node(), item = node.add(PresentationItem);
        node.add(UITransform);
        const bodyNode = new Node(); bodyNode.parent = node; bodyNode.position = { x: 50, y: -60, z: 0 };
        const transform = bodyNode.add(UITransform); transform.width = 200; transform.height = 120;
        item.body = bodyNode.add(Sprite); item.body.spriteFrame = new SpriteFrame('original');
        const labelNode = new Node(); labelNode.parent = node; labelNode.position = { x: 30, y: -40, z: 0 };
        labelNode.add(UITransform).setContentSize(60, 30);
        item.labels = [labelNode.add(Label)]; item.labelKeys = ['title'];
        item.previewData = JSON.stringify({ values: { title: 'default' } });
        return node;
    };
    const page = () => {
        const node = new Node(), core = node.add(CorePresentation), mount = new Node(); mount.parent = node;
        core.actionTarget = node;
        mount.position = { x: 213, y: -146 }; mount.scale = { x: .7, y: .7 };
        core.itemMounts = [mount]; core.itemPrefabs = [new Prefab(createItem)]; core.itemData = [JSON.stringify({ values: { title: 'preview' } })];
        return { node, core, mount };
    };
    const scope = { isReleased: false, releases: 0, load: async id => new SpriteFrame(id), release() { this.releases++; this.isReleased = true; } };
    return { ...cc, PresentationItem, CorePresentation, PresentationGroup, page, createItem, scope,
        get instantiated() { return instantiated; } };
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

test('repeated page presentation reuses one item and preserves fixed mount geometry', async () => {
    const r = runtime(), { core, mount } = r.page();
    const label = new r.Node().add(r.Label), progress = new r.Node().add(r.ProgressBar);
    core.labels = [label]; core.labelKeys = ['honey']; core.progressBars = [progress]; core.progressKeys = ['completion'];
    core.previewData = JSON.stringify({ values: { honey: 20, completion: .4 } });
    await core.present(r.scope);
    const created = mount.children[0], item = created.getComponent(r.PresentationItem);
    await core.present(r.scope, { values: { honey: 35, completion: .8 }, items: [{ values: { title: 'updated' } }] });
    assert.equal(r.instantiated, 1); assert.equal(mount.children[0], created);
    assert.equal(item.labels[0].string, 'updated');
    assert.equal(label.string, '35'); assert.equal(progress.progress, .8);
    assert.deepEqual(mount.position, { x: 213, y: -146 }); assert.deepEqual(mount.scale, { x: .7, y: .7 });
    core.onDestroy(); assert.equal(created.isValid, false); assert.equal(r.scope.releases, 0);
});

test('item value overrides and default-frame restoration do not retain prior data', async () => {
    const r = runtime(), node = r.createItem(), item = node.getComponent(r.PresentationItem);
    await item.present(r.scope, { values: { title: 42 }, bodyAssetId: 'building-stage-2' });
    assert.equal(item.labels[0].string, '42'); assert.equal(item.body.spriteFrame.id, 'building-stage-2');
    await item.present(r.scope);
    assert.equal(item.labels[0].string, 'default'); assert.equal(item.body.spriteFrame.id, 'original');
    await item.present(r.scope, { bodyAssetId: null }); assert.equal(item.body.spriteFrame, null);
});

test('new binding wins over late previous image requests', async () => {
    const r = runtime(), item = r.createItem().getComponent(r.PresentationItem), first = deferred(), second = deferred();
    r.scope.load = id => id === 'first' ? first.promise : second.promise;
    const old = item.present(r.scope, { values: { title: 'old' }, bodyAssetId: 'first' });
    const current = item.present(r.scope, { values: { title: 'current' }, bodyAssetId: 'second' });
    second.resolve(new r.SpriteFrame('second')); await current;
    first.resolve(new r.SpriteFrame('first')); await old;
    assert.equal(item.body.spriteFrame.id, 'second'); assert.equal(item.labels[0].string, 'current');
});

test('hiding a layout cancels item writes, and showing it reuses its item', async () => {
    const r = runtime(), { core, node, mount } = r.page(), late = deferred(); r.scope.load = () => late.promise;
    const pending = core.present(r.scope, { items: [{ bodyAssetId: 'late' }] });
    core.onDisable(); node.active = false;
    late.resolve(new r.SpriteFrame('late')); await pending;
    assert.equal(mount.children[0].getComponent(r.PresentationItem).body.spriteFrame.id, 'original');
    node.active = true; await core.present(r.scope);
    assert.equal(r.instantiated, 1);
    core.onDestroy(); assert.equal(r.scope.releases, 0);
});

test('destroyed item ignores a late rejected load without releasing its borrowed scope', async () => {
    const r = runtime(), node = r.createItem(), item = node.getComponent(r.PresentationItem), late = deferred();
    r.scope.load = () => late.promise;
    const pending = item.present(r.scope, { bodyAssetId: 'pending' });
    node.destroy(); late.reject(new Error('late failure')); await pending;
    assert.equal(item.body.spriteFrame.id, 'original'); assert.equal(r.scope.releases, 0);
});

test('missing fields, invalid progress, missing item scripts and live failures are explicit', async () => {
    const r = runtime(), item = r.createItem().getComponent(r.PresentationItem);
    item.labelKeys = ['absent']; await assert.rejects(item.present(r.scope), /missing value 'absent'/);
    item.labelKeys = ['title']; item.bars = [new r.Node().add(r.ProgressBar)]; item.barKeys = ['progress'];
    await assert.rejects(item.present(r.scope, { values: { progress: 2 } }), /0..1/);
    item.bars = []; item.barKeys = []; item.body = null;
    await assert.rejects(item.present(r.scope, { bodyAssetId: 'art' }), /missing.*body/);
    const { core } = r.page(); core.itemPrefabs = [new r.Prefab(() => new r.Node())];
    await assert.rejects(core.present(r.scope), /PresentationItem/); assert.equal(r.instantiated, 0);
    const live = r.createItem().getComponent(r.PresentationItem); r.scope.load = () => Promise.reject(new Error('registered asset missing'));
    await assert.rejects(live.present(r.scope, { bodyAssetId: 'missing' }), /registered asset missing/);
});

test('page group presents only its active typed variant and rejects invalid bindings', async () => {
    const r = runtime(), group = new r.Node().add(r.PresentationGroup), first = r.page(), second = r.page();
    first.node.active = false; group.layouts = [first.core, second.core];
    await group.present(r.scope); assert.equal(r.instantiated, 1);
    first.node.active = true; second.node.active = false;
    await group.present(r.scope); assert.equal(r.instantiated, 2);
    await group.present(r.scope); assert.equal(r.instantiated, 2);
    group.layouts = [null]; await assert.rejects(group.present(r.scope), /missing.*layouts/);
});

test('building body/rotor geometry uses existing transforms and resets when reused', async () => {
    const r = runtime(), node = r.createItem(), item = node.getComponent(r.PresentationItem);
    const rotorNode = new r.Node(); rotorNode.parent = node; rotorNode.position = { x: 10, y: -20, z: 4 };
    rotorNode.add(r.UITransform).setContentSize(45, 50);
    item.rotor = rotorNode.add(r.Sprite); item.rotorRoot = rotorNode;
    await item.present(r.scope, {
        bodyAssetId: 'watermill-body', rotorAssetId: 'watermill-rotor', rootSize: [367, 351],
        bodyBox: { x: 183.5, y: -175.5, width: 367, height: 351 },
        rotorBox: { x: 240, y: -230, width: 65, height: 70 },
    });
    assert.equal(node.getComponent(r.UITransform).width, 367); assert.equal(node.getComponent(r.UITransform).height, 351);
    assert.deepEqual(item.body.node.position, { x: 183.5, y: -175.5, z: 0 });
    assert.equal(item.body.node.getComponent(r.UITransform).width, 367);
    assert.deepEqual(rotorNode.position, { x: 240, y: -230, z: 4 });
    assert.equal(rotorNode.getComponent(r.UITransform).height, 70);
    await item.present(r.scope, { rotorAssetId: null });
    assert.equal(node.getComponent(r.UITransform).width, 100);
    assert.deepEqual(item.body.node.position, { x: 50, y: -60, z: 0 });
    assert.equal(item.body.node.getComponent(r.UITransform).width, 200);
    assert.deepEqual(rotorNode.position, { x: 10, y: -20, z: 4 });
    assert.equal(rotorNode.getComponent(r.UITransform).width, 45); assert.equal(item.rotor.spriteFrame, null);
    assert.equal(r.instantiated, 0); assert.equal(r.scope.releases, 0);
});

test('invalid geometry and missing UITransform fail without creating replacement nodes', async () => {
    const r = runtime(), node = r.createItem(), item = node.getComponent(r.PresentationItem);
    await assert.rejects(item.present(r.scope, { bodyBox: { x: 0, y: Infinity, width: 10, height: 10 } }), /finite/);
    await assert.rejects(item.present(r.scope, { rootSize: [10, 0] }), /rootSize/);
    await assert.rejects(item.present(r.scope, { bodyBox: { x: 0, y: 0, width: -1, height: 10 } }), /positive/);
    item.body.node.components.delete(r.UITransform);
    await assert.rejects(item.present(r.scope, { bodyBox: { x: 0, y: 0, width: 10, height: 10 } }), /body.UITransform/);
    node.components.delete(r.UITransform);
    await assert.rejects(item.present(r.scope, { rootSize: [10, 20] }), /root.UITransform/);
    assert.equal(r.instantiated, 0);
});

test('late geometry cannot overwrite a newer body layout', async () => {
    const r = runtime(), node = r.createItem(), item = node.getComponent(r.PresentationItem), late = deferred();
    r.scope.load = () => late.promise;
    const old = item.present(r.scope, { bodyAssetId: 'old', rootSize: [900, 900], bodyBox: { x: 450, y: -450, width: 900, height: 900 } });
    await item.present(r.scope, { rootSize: [300, 200], bodyBox: { x: 150, y: -100, width: 300, height: 200 } });
    late.resolve(new r.SpriteFrame('old')); await old;
    assert.equal(node.getComponent(r.UITransform).width, 300);
    assert.deepEqual(item.body.node.position, { x: 150, y: -100, z: 0 });
});

function attachAccents(r, item) {
    item.accents = [0, 1, 2].map(index => {
        const node = new r.Node(); node.parent = item.node; node.position = { x: index * 10, y: -80, z: 0 };
        node.add(r.UITransform).setContentSize(25, 27);
        const sprite = node.add(r.Sprite); sprite.spriteFrame = new r.SpriteFrame('default-star-' + index); return sprite;
    });
}

test('one level Prefab displays different stars, label boxes and font sizes then resets every field', async () => {
    const r = runtime(), item = r.createItem().getComponent(r.PresentationItem); attachAccents(r, item);
    await item.present(r.scope, { values: { title: '8' }, accentAssetIds: ['gold', 'grey', null],
        accentBoxes: [0, 1, 2].map(index => ({ x: index * 40, y: -95, width: 32, height: 35 })),
        labelBoxes: [{ x: 50, y: -38, width: 80, height: 45 }], labelFontSizes: [45] });
    assert.deepEqual(item.accents.map(sprite => sprite.spriteFrame?.id ?? null), ['gold', 'grey', null]);
    assert.deepEqual(item.accents[2].node.position, { x: 80, y: -95, z: 0 });
    assert.equal(item.accents[0].node.getComponent(r.UITransform).width, 32);
    assert.equal(item.labels[0].string, '8'); assert.equal(item.labels[0].fontSize, 45); assert.equal(item.labels[0].lineHeight, 54);
    assert.deepEqual(item.labels[0].node.position, { x: 50, y: -38, z: 0 });
    assert.equal(item.labels[0].node.getComponent(r.UITransform).width, 80);
    await item.present(r.scope);
    assert.deepEqual(item.accents.map(sprite => sprite.spriteFrame.id), ['default-star-0', 'default-star-1', 'default-star-2']);
    assert.deepEqual(item.accents[2].node.position, { x: 20, y: -80, z: 0 });
    assert.equal(item.accents[0].node.getComponent(r.UITransform).width, 25);
    assert.equal(item.labels[0].fontSize, 20); assert.equal(item.labels[0].lineHeight, 24);
    assert.deepEqual(item.labels[0].node.position, { x: 30, y: -40, z: 0 });
    assert.equal(item.labels[0].node.getComponent(r.UITransform).width, 60);
    assert.equal(r.instantiated, 0);
});

test('accent loading commits together and cannot repaint a newer level binding', async () => {
    const r = runtime(), item = r.createItem().getComponent(r.PresentationItem), late = deferred(); attachAccents(r, item);
    r.scope.load = id => id === 'slow-star' ? late.promise : Promise.resolve(new r.SpriteFrame(id));
    const old = item.present(r.scope, { bodyAssetId: 'fast-body', accentAssetIds: ['slow-star', null, null],
        labelFontSizes: [45], values: { title: 'old' } });
    await Promise.resolve(); await Promise.resolve();
    assert.equal(item.body.spriteFrame.id, 'original'); assert.equal(item.labels[0].string, '');
    assert.equal(item.accents[0].spriteFrame.id, 'default-star-0');
    await item.present(r.scope, { values: { title: 'new' }, accentAssetIds: [null, 'current', null], labelFontSizes: [38] });
    late.resolve(new r.SpriteFrame('slow-star')); await old;
    assert.equal(item.body.spriteFrame.id, 'original'); assert.equal(item.labels[0].string, 'new');
    assert.equal(item.accents[0].spriteFrame, null); assert.equal(item.accents[1].spriteFrame.id, 'current');
    assert.equal(item.labels[0].fontSize, 38);
});

test('accent/label data lengths, font values and missing transforms are explicit errors', async () => {
    const r = runtime(), item = r.createItem().getComponent(r.PresentationItem); attachAccents(r, item);
    await assert.rejects(item.present(r.scope, { accentAssetIds: ['gold'] }), /array lengths/);
    await assert.rejects(item.present(r.scope, { accentBoxes: [] }), /array lengths/);
    await assert.rejects(item.present(r.scope, { labelBoxes: [] }), /array lengths/);
    await assert.rejects(item.present(r.scope, { labelFontSizes: [38, 40] }), /array lengths/);
    await assert.rejects(item.present(r.scope, { labelFontSizes: [0] }), /positive finite/);
    await assert.rejects(item.present(r.scope, { labelFontSizes: [Infinity] }), /positive finite/);
    item.accents[0].node.components.delete(r.UITransform);
    await assert.rejects(item.present(r.scope, { accentBoxes: [0, 1, 2].map(() => ({ x: 0, y: 0, width: 10, height: 10 })) }), /accents\[0\].UITransform/);
    item.labels[0].node.components.delete(r.UITransform);
    await assert.rejects(item.present(r.scope, { labelBoxes: [{ x: 0, y: 0, width: 10, height: 10 }] }), /labels\[0\].UITransform/);
    assert.equal(r.instantiated, 0);
});

test('item view-actions reach the page exactly once across reuse and hide/show, and detach on destruction', async () => {
    const r = runtime(), { core, node, mount } = r.page(), delivered = [];
    node.on('view-action', payload => delivered.push(payload));
    await core.present(r.scope); await core.present(r.scope);
    const itemNode = mount.children[0], payload = { actionId: 'nav:puzzle-preview', view: { marker: 'level-node' } };
    assert.equal(itemNode.events.get('view-action').length, 1);
    itemNode.emit('view-action', payload);
    assert.equal(delivered.length, 1); assert.equal(delivered[0], payload);
    core.onDisable(); assert.equal(itemNode.events.get('view-action').length, 0);
    itemNode.emit('view-action', payload); assert.equal(delivered.length, 1);
    core.onEnable(); core.onEnable(); await core.present(r.scope);
    assert.equal(itemNode.events.get('view-action').length, 1);
    itemNode.emit('view-action', payload); assert.equal(delivered.length, 2);
    assert.equal(r.instantiated, 1);
    core.onDestroy(); assert.equal(itemNode.events.get('view-action').length, 0);
    itemNode.emit('view-action', payload); assert.equal(delivered.length, 2);
    assert.equal(r.scope.releases, 0);
});

test('a dynamic item mount requires an explicit action target', async () => {
    const r = runtime(), { core } = r.page(); core.actionTarget = null;
    await assert.rejects(core.present(r.scope), /missing.*actionTarget/); assert.equal(r.instantiated, 0);
});

test('excluded fixture mounts do not instantiate or load, and restoring them keeps their own data index', async () => {
    const r = runtime(), { core, mount } = r.page();
    const other = new r.Node(); other.parent = core.node;
    core.itemMounts.push(other); core.itemPrefabs.push(core.itemPrefabs[0]);
    core.itemData.push(JSON.stringify({ values: { title: 'second' }, bodyAssetId: 'second-body' }));
    await core.present(r.scope, {}, [mount]);
    assert.equal(r.instantiated, 1); assert.equal(mount.children.length, 0);
    assert.equal(core.mountedItems.length, 1); assert.equal(core.mountedItems[0].labels[0].string, 'second');
    await core.present(r.scope);
    assert.equal(r.instantiated, 2); assert.equal(core.mountedItems.length, 2);
    assert.equal(core.mountedItems[1].labels[0].string, 'second');
    const removed = core.mountedItems[0].node;
    await core.present(r.scope, {}, [mount]);
    assert.equal(removed.isValid, false); assert.equal(core.mountedItems.length, 1);
    assert.equal(removed.events.get('view-action').length, 0);
    assert.equal(r.scope.releases, 0);
});
