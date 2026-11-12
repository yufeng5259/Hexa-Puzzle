import '../env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Compile the implementation itself. No generated JS copies or implementation-shaped assertions.
const require = createRequire(import.meta.url);
const candidates = [process.env.TYPESCRIPT_PATH,
    'G:/cocosCreator/Editor/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js',
    'D:/Program Files/Trae/resources/app/extensions/node_modules/typescript/lib/typescript.js'];
let ts;
try { ts = require('typescript'); } catch {
    const location = candidates.find(path => path && existsSync(path));
    if (!location) throw new Error('Set TYPESCRIPT_PATH to an existing TypeScript installation; no package installation is required.');
    ts = require(location);
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../assets/scripts/framework');
const afterUpdate = [];
let instanceCount = 0;
class Node {
    static EventType = { SIZE_CHANGED: 'size', NODE_DESTROYED: 'destroyed' };
    constructor() { this.active = true; this.isValid = true; this.parent = null; this.components = new Map(); this.events = new Map(); }
    add(type, component = new type()) { component.node = this; this.components.set(type, component); return component; }
    getComponent(type) { for (const value of this.components.values()) if (value instanceof type) return value; return null; }
    on(event, callback, owner) { const entries = this.events.get(event) || []; entries.push({ callback, owner }); this.events.set(event, entries); }
    once(event, callback, owner) { const wrapped = (...args) => { this.off(event, wrapped, owner); callback.apply(owner, args); }; this.on(event, wrapped, owner); }
    off(event, callback, owner) { this.events.set(event, (this.events.get(event) || []).filter(entry => entry.callback !== callback || entry.owner !== owner)); }
    emit(event, ...args) { for (const entry of [...this.events.get(event) || []]) entry.callback.apply(entry.owner, args); }
    setPosition(x, y, z) { this.position = { x, y, z }; }
    destroy() { if (!this.isValid) return; this.isValid = false; for (const component of this.components.values()) component.onDestroy?.(); this.emit(Node.EventType.NODE_DESTROYED); }
}
class Component { constructor() { this.enabled = true; } get isValid() { return this.node?.isValid ?? true; } }
class UITransform extends Component {
    width = 300; height = 250; anchorX = 0; anchorY = 1;
    setContentSize(width, height) { this.width = width; this.height = height; }
}
class ScrollView extends Component {
    static EventType = { SCROLLING: 'scrolling' };
    offset = { x: 0, y: 0 };
    stopAutoScroll() {}
    scrollToOffset(value) { this.offset = { x: -value.x, y: value.y }; this.node.emit(ScrollView.EventType.SCROLLING); }
    getScrollOffset() { return this.offset; }
}
class Mask extends Component {}
class Layout extends Component {}
class Prefab { constructor(create) { this.create = create; this.data = create(); } }
class Label extends Component { string = ''; }
class Asset { refs = 0; addRef() { this.refs++; } decRef() { this.refs--; } }
class Vec2 { constructor(x, y) { this.x = x; this.y = y; } }
class EventHandler { static emitEvents(events, payload) { events.forEach(event => event(payload)); } }
const cc = {
    _decorator: { ccclass: () => target => target, property: (...args) => args.length >= 2 ? undefined : () => {} },
    Component, Node, UITransform, ScrollView, Mask, Layout, Prefab, Label, Vec2, Asset, EventHandler,
    isValid: value => value && value.isValid !== false,
    instantiate: prefab => { instanceCount++; return prefab.create(); },
    director: { once: (_event, callback) => afterUpdate.push(callback) }, Director: { EVENT_AFTER_UPDATE: 'after-update' },
    assetManager: { getBundle: () => null, loadBundle: () => { throw new Error('No mock bundle registered'); } },
    resources: { load: () => { throw new Error('No mock resource registered'); } },
};
const cache = new Map();
function load(relative) {
    const filename = resolve(root, relative.endsWith('.ts') ? relative : relative + '.ts');
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const source = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
    } }).outputText;
    const localRequire = id => id === 'cc' ? cc : load(resolve(dirname(filename), id));
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(localRequire, module, module.exports);
    return module.exports;
}
const { ResourcePool, OwnedResourceScope, ScopeReleasedError } = load('core/ResourcePool');
const { ViewLifetime } = load('core/ViewLifetime');
const { listWindow } = load('core/VirtualWindow');
const { VirtualListItem } = load('ui/VirtualListItem');
const { VirtualList } = load('ui/VirtualList');
const { BaseView } = load('ui/BaseView');
const { ViewHost } = load('ui/ViewHost');
const { requireBinding } = load('components/Binding');
const { UIAction } = load('components/UIAction');
const { ResourceLoader } = load('resources/ResourceLoader');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test('shared loads retain one ref per scope, and repeated same-scope requests share a promise', async () => {
    const pending = deferred(); let loads = 0;
    const pool = new ResourcePool(() => { loads++; return pending.promise; });
    const first = new OwnedResourceScope(pool), second = new OwnedResourceScope(pool), asset = new Asset();
    const a = first.load('x'); assert.equal(first.load('x'), a);
    const b = second.load('x'); await settle(); assert.equal(loads, 1);
    pending.resolve(asset); assert.equal(await a, asset); assert.equal(await b, asset);
    assert.equal(asset.refs, 2);
    first.release(); first.release(); assert.equal(asset.refs, 1);
    second.release(); assert.equal(asset.refs, 0); assert.equal(pool.activeEntryCount, 0);
});
test('release rejects pending consumers immediately and safely disposes a late asset', async () => {
    const pending = deferred(), pool = new ResourcePool(() => pending.promise), scope = new OwnedResourceScope(pool), asset = new Asset();
    const waiting = scope.load('late'), rejected = assert.rejects(waiting, ScopeReleasedError);
    scope.release(); await rejected;
    await assert.rejects(scope.load('late'), ScopeReleasedError);
    pending.resolve(asset); await settle();
    assert.equal(asset.refs, 0); assert.equal(pool.activeEntryCount, 0);
});
test('canceling one pending scope preserves another consumer', async () => {
    const pending = deferred(), pool = new ResourcePool(() => pending.promise), a = new OwnedResourceScope(pool), b = new OwnedResourceScope(pool), asset = new Asset();
    const pa = a.load('x'), rejection = assert.rejects(pa, ScopeReleasedError), pb = b.load('x');
    a.release(); await rejection; pending.resolve(asset); assert.equal(await pb, asset);
    assert.equal(asset.refs, 1); b.release(); assert.equal(asset.refs, 0);
});
test('releasing a scope before cached delivery rejects instead of returning an unowned asset', async () => {
    const asset = new Asset(), pool = new ResourcePool(async () => asset), a = new OwnedResourceScope(pool), b = new OwnedResourceScope(pool);
    await a.load('x'); const delivery = b.load('x'); b.release();
    await assert.rejects(delivery, ScopeReleasedError); assert.equal(asset.refs, 1); a.release();
});
test('native failure removes subscriptions and permits retry', async () => {
    let attempts = 0; const asset = new Asset();
    const scope = new OwnedResourceScope(new ResourcePool(async () => { if (++attempts === 1) throw new Error('offline'); return asset; }));
    await assert.rejects(scope.load('x'), /offline/); assert.equal(await scope.load('x'), asset);
    assert.equal(attempts, 2); scope.release(); assert.equal(asset.refs, 0);
});
test('a new scope joins an abandoned native request without duplicate loads', async () => {
    const pending = deferred(); let loads = 0; const pool = new ResourcePool(() => { loads++; return pending.promise; });
    const a = new OwnedResourceScope(pool); const pa = a.load('x'), rejection = assert.rejects(pa);
    a.release(); await rejection;
    const b = new OwnedResourceScope(pool), pb = b.load('x'), asset = new Asset();
    pending.resolve(asset); await pb; assert.equal(loads, 1); assert.equal(asset.refs, 1); b.release();
});
test('resource adapter loads shared bundles first, enforces registered identity, and retries failure', async () => {
    const order = [], asset = new Asset(); asset._uuid = 'registered-uuid'; let fail = true;
    const bundles = new Map();
    cc.assetManager.getBundle = name => bundles.get(name) || null;
    cc.assetManager.loadBundle = (name, done) => {
        order.push(name);
        if (name === 'garden' && fail) { fail = false; done(new Error('network')); return; }
        const bundle = { load: (_path, _type, done) => done(null, asset) };
        bundles.set(name, bundle); done(null, bundle);
    };
    const loader = new ResourceLoader([{ id: 'building', bundle: 'garden', path: 'textures/body', type: Asset, uuid: asset._uuid }],
        { bundleDependencies: { garden: ['common'] } });
    const scope = loader.createScope();
    await assert.rejects(scope.load('unknown', Asset), /not registered/);
    await assert.rejects(scope.load('building', Prefab), /type mismatch/);
    await assert.rejects(scope.load('building', Asset), /network/);
    assert.equal(await scope.load('building', Asset), asset);
    assert.deepEqual(order, ['common', 'garden', 'garden']);
    assert.equal(asset.refs, 1); scope.release(); assert.equal(asset.refs, 0);
    assert.throws(() => new ResourceLoader([], { bundleDependencies: { a: ['b'], b: ['a'] } }), /cycle/);
});
test('resource adapter rejects unexpected UUIDs and disposes their native result', async () => {
    const asset = new Asset(); asset._uuid = 'wrong';
    cc.resources.load = (_path, _type, done) => done(null, asset);
    const scope = new ResourceLoader([{ id: 'frame', bundle: 'resources', path: 'frame', type: Asset, uuid: 'expected' }]).createScope();
    await assert.rejects(scope.load('frame', Asset), /identity mismatch/);
    assert.equal(asset.refs, 0); scope.release();
});

test('configured aliases share a canonical asset across views without duplicate ownership or loads', async () => {
    const asset = new Asset(); asset._uuid = 'shared-stage'; let loads = 0;
    cc.resources.load = (_path, _type, done) => { loads++; done(null, asset); };
    const loader = new ResourceLoader([{ id: 'tree', bundle: 'resources', path: 'tree', type: Asset, uuid: asset._uuid }],
        { aliases: { 'building.treehouse.stage0': 'tree', 'building.treehouse.stage1': 'tree' } });
    const first = loader.createScope(), second = loader.createScope();
    assert.equal(await first.load('tree', Asset), asset);
    assert.equal(await first.load('building.treehouse.stage0', Asset), asset);
    assert.equal(await second.load('building.treehouse.stage1', Asset), asset);
    assert.equal(loads, 1); assert.equal(asset.refs, 2);
    first.release(); assert.equal(asset.refs, 1);
    second.release(); assert.equal(asset.refs, 0); assert.equal(loader.activeEntryCount, 0);
    assert.throws(() => new ResourceLoader([], { aliases: { broken: 'missing' } }), /alias/);
});
test('lifetime repeated show/hide cleans once and invalidates asynchronous identities', () => {
    const lifetime = new ViewLifetime(); let removed = 0;
    assert.equal(lifetime.show(), true); assert.equal(lifetime.show(), false);
    lifetime.addCleanup(() => removed++); const current = lifetime.requestIdentity(); assert.equal(current(), true);
    lifetime.hide(); lifetime.hide(); assert.equal(removed, 1); assert.equal(current(), false);
    lifetime.show(); assert.equal(current(), false); lifetime.close(); lifetime.close();
    assert.throws(() => lifetime.show(), /closed/);
});
test('cleanup failure does not prevent other subscriptions from being removed or closure', () => {
    const lifetime = new ViewLifetime(), calls = []; lifetime.show();
    lifetime.addCleanup(() => calls.push('first')); lifetime.addCleanup(() => { throw new Error('cleanup'); });
    assert.throws(() => lifetime.close(), /cleanup/); assert.deepEqual(calls, ['first']); assert.equal(lifetime.isClosed, true);
});
test('virtual window covers empty, one item, multiple screens, bounds, gaps, and resize', () => {
    assert.deepEqual(listWindow(0, 100, 10, 250, 999, 2), { first: 0, end: 0, offset: 0, extent: 0 });
    assert.deepEqual(listWindow(1, 100, 10, 250, 999, 2), { first: 0, end: 1, offset: 0, extent: 100 });
    const middle = listWindow(1000, 100, 10, 250, 5500, 2);
    assert.deepEqual([middle.first, middle.end], [48, 55]);
    assert.equal(listWindow(1000, 100, 10, 250, -99, 2).offset, 0);
    const last = listWindow(1000, 100, 10, 250, 1e9, 2);
    assert.equal(last.end, 1000); assert.equal(last.offset, last.extent - 250);
    assert.ok(listWindow(1000, 100, 10, 1250, 5500, 2).end > middle.end);
    assert.throws(() => listWindow(2, 0, 0, 100, 0, 2), /Invalid/);
});
function createList(horizontal = false) {
    const host = new Node(), list = host.add(VirtualList), viewport = new Node(), content = new Node();
    viewport.add(UITransform); viewport.add(Mask); content.add(UITransform); content.parent = viewport;
    const scroll = host.add(ScrollView); scroll.content = content;
    const prefab = new Prefab(() => { const node = new Node(); node.add(UITransform); const item = node.add(VirtualListItem); item.titleLabel = node.add(Label); item.selectedMarker = new Node(); return node; });
    Object.assign(list, { scrollView: scroll, viewport, content, itemPrefab: prefab, horizontal, itemExtent: 100, buffer: 2 });
    list.onLoad(); list.onEnable(); return list;
}
test('actual list component bounds instances, resets item state and handles repeated/empty data', () => {
    const list = createList(); const initialInstances = instanceCount;
    const values = Array.from({ length: 1000 }, (_, i) => ({ title: String(i), selected: true }));
    let selected = -1; list.setData(values, index => { selected = index; });
    assert.ok(list.activeItemCount <= 7); list.jumpTo(999); assert.ok(list.activeItemCount <= 7);
    assert.ok(instanceCount - initialInstances < 15);
    const visible = [...list.visible.values()]; visible[0].onItemClicked(); assert.ok(selected >= 990);
    const oldIdentity = visible[0].requestIdentity();
    list.setData([{ title: 'only' }]); assert.equal(oldIdentity(), false);
    const only = [...list.visible.values()][0]; assert.equal(only.titleLabel.string, 'only'); assert.equal(only.selectedMarker.active, false);
    only.onItemClicked(); assert.ok(selected >= 990, 'old callback must not survive reuse');
    list.setData([]); assert.equal(list.activeItemCount, 0); assert.ok(list.retainedItemCount <= 1);
    list.onDestroy(); assert.equal(list.retainedItemCount, 0);
});
test('horizontal rapid jumps, resized viewport, and listener repetition work on the component', () => {
    const list = createList(true); list.setData(Array.from({ length: 1000 }, (_, i) => ({ title: String(i) })));
    for (const index of [500, 1, 999, 22]) list.jumpTo(index);
    assert.ok([...list.visible.keys()].includes(22));
    list.viewport.getComponent(UITransform).width = 1000;
    list.viewport.emit(Node.EventType.SIZE_CHANGED); assert.ok(list.activeItemCount >= 10);
    list.onDisable(); list.onEnable(); list.onEnable();
    assert.equal(list.scrollView.node.events.get(ScrollView.EventType.SCROLLING).length, 1);
    list.onDisable(); assert.equal(list.scrollView.node.events.get(ScrollView.EventType.SCROLLING).length, 0);
    assert.throws(() => list.jumpTo(NaN), /finite/); list.onDestroy();
});
test('list missing bindings, enabled Layout, and wrong anchors fail explicitly', () => {
    assert.throws(() => new VirtualList().validateBindings(), /scrollView/);
    const list = createList(); list.content.add(Layout);
    assert.throws(() => list.validateBindings(), /enabled Layout/);
    list.content.getComponent(Layout).enabled = false; list.viewport.getComponent(UITransform).anchorX = .5;
    assert.throws(() => list.validateBindings(), /top-left/); list.onDestroy();
});
test('list destruction tolerates children already destroyed by the native parent lifetime', () => {
    const list = createList(); list.setData(Array.from({ length: 100 }, (_, index) => ({ title: String(index) })));
    const owned = [...list.visible.values(), ...list.pool];
    for (const item of owned) { item.node.destroy(); item.node = null; }
    assert.doesNotThrow(() => list.onDestroy()); assert.equal(list.retainedItemCount, 0);
});
test('BaseView hooks, subscriptions, closing, and post-destruction resource release are distinct', () => {
    const node = new Node(); class View extends BaseView {
        shown = 0; hidden = 0; removed = 0; closed = 0;
        onShown() { this.shown++; this.addShownCleanup(() => this.removed++); }
        onHidden() { this.hidden++; }
        onClosed() { this.closed++; }
    }
    const view = node.add(View); let released = 0;
    view.attachResourceScope({ isReleased: false, release: () => released++ });
    view.show(); view.show(); const identity = view.requestIdentity(); view.hide(); view.hide();
    assert.equal(view.shown, 1); assert.equal(view.hidden, 1); assert.equal(view.removed, 1); assert.equal(identity(), false);
    view.show(); view.close(); view.onDestroy(); assert.equal(view.closed, 1); assert.equal(released, 0);
    while (afterUpdate.length) afterUpdate.shift()(); assert.equal(released, 1); assert.equal(view.removed, 2);
});
test('parent disable preserves local active state and allows the same view to reappear', () => {
    const node = new Node(), view = node.add(BaseView); view.onLoad(); view.onEnable();
    view.onDisable(); assert.equal(node.active, true); assert.equal(view.isShown, false);
    view.onEnable(); assert.equal(node.active, true); assert.equal(view.isShown, true);
    view.hide(); assert.equal(node.active, false); view.onDestroy();
});
test('ViewHost releases transferred scope on missing bindings and failed instantiation', () => {
    const node = new Node(), host = node.add(ViewHost); let released = 0;
    const scope = { release: () => released++ };
    assert.throws(() => host.open(null, 'page', scope), /prefab/); assert.equal(released, 1);
    const prefab = new Prefab(() => new Node());
    assert.throws(() => host.open(prefab, 'page', scope), /pageLayer/); assert.equal(released, 2);
    host.pageLayer = new Node();
    const broken = { create() { throw new Error('cannot instantiate'); } };
    assert.throws(() => host.open(broken, 'page', scope), /cannot instantiate/); assert.equal(released, 3);
    assert.throws(() => host.open(prefab, 'page', scope), /BaseView/); assert.equal(released, 3);
    while (afterUpdate.length) afterUpdate.shift()(); assert.equal(released, 4);
});
test('ViewHost closing tolerates engine-destructed sibling state', () => {
    const host = new ViewHost(); host.views = null;
    assert.doesNotThrow(() => host.closeAll()); assert.doesNotThrow(() => host.onDestroy());
});
test('binding errors identify owner/field; serialized UIAction forwards the configured action', () => {
    assert.throws(() => requireBinding('Page', 'title', null), /Page.*title/);
    const node = new Node(), action = node.add(UIAction); let payload;
    action.actionId = 'back'; action.handlers = [value => { payload = value; }]; action.onClick(undefined, 'preview');
    assert.equal(payload.actionId, 'back'); assert.equal(payload.customEventData, 'preview');
});
