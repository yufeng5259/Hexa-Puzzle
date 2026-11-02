import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_PATH || 'G:/cocosCreator/Editor/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const scripts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../assets/scripts');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

// Compile the real View, lifecycle, boot and navigation code. Only engine and
// unrelated game/resource services are replaced so startup can be paused or fail.
function runtime(options = {}) {
    const events = [], errors = [], afterUpdate = [];
    class Component {
        enabled = true;
        get isValid() { return this.node?.isValid !== false; }
        scheduleOnce(callback) { this.scheduled = callback; }
        unschedule() { this.scheduled = null; }
    }
    class Node {
        static EventType = { NODE_DESTROYED: 'destroyed' };
        active = true; isValid = true; children = []; components = []; events = new Map();
        position = { x: 0, y: 0, z: 0, clone() { return { ...this }; } };
        get activeInHierarchy() { return this.active; }
        add(Type) { const component = new Type(); component.node = this; this.components.push(component); return component; }
        getComponent(Type) { return this.components.find(component => component instanceof Type) || null; }
        setPosition(...args) { this.position = typeof args[0] === 'object' ? args[0] : { x: args[0], y: args[1], z: args[2] }; }
        on(name, callback) { this.events.set(name, callback); }
        off(name) { this.events.delete(name); }
        destroy() { if (!this.isValid) return; this.isValid = false; this.components.forEach(component => component.onDestroy?.()); }
    }
    class Label extends Component { string = '0%'; }
    class ProgressBar extends Component { progress = 0; }
    class Asset { refs = 0; addRef() { this.refs++; } decRef() { this.refs--; } }
    class LevelCatalog { getMainline(number) { return { id: String(number) }; } }
    const scope = {
        isReleased: false,
        async load() {
            if (options.catalogGate) await options.catalogGate.promise;
            if (options.fail === 'catalog') throw new Error('catalog failed');
            return { json: {} };
        },
        release() { this.isReleased = true; },
    };
    class GardenAssetStore { createScope() { return scope; } }
    class PuzzleAttemptStore { clear() {} }
    const cc = {
        _decorator: { ccclass: () => target => target, property: (...args) => args.length >= 2 ? undefined : () => {} },
        Component, Node, Label, ProgressBar, CCString: String, Prefab: Asset, JsonAsset: Asset,
        Canvas: Component, UITransform: Component, Sprite: Component,
        isValid: value => !!value && value.isValid !== false,
        ResolutionPolicy: { SHOW_ALL: 0 },
        view: { setDesignResolutionSize() {}, on() {}, off() {} },
        director: { once: (_event, callback) => afterUpdate.push(callback) },
        Director: { EVENT_AFTER_UPDATE: 'after-update' },
    };
    const services = {
        GardenAssetStore: { GardenAssetStore }, LevelCatalog: { LevelCatalog }, PuzzleAttemptStore: { PuzzleAttemptStore },
        ViewHost: { ViewHost: Component }, VirtualList: { VirtualList: Component },
        PresentationGroup: { PresentationGroup: Component },
        MainlineMapPresentation: { MainlineMapPresentation: Component }, PuzzleBoardPresentation: { PuzzleBoardPresentation: Component },
        PuzzleController: { PuzzleController: Component }, PlayStatusPresentation: { PlayStatusPresentation: Component },
        LevelRoutePresentation: { levelRouteState: () => undefined },
    };
    const cache = new Map();
    function load(filename) {
        filename = path.resolve(filename.endsWith('.ts') ? filename : filename + '.ts');
        const stub = services[path.basename(filename, '.ts')];
        if (stub) return stub;
        if (cache.has(filename)) return cache.get(filename).exports;
        const module = { exports: {} }; cache.set(filename, module);
        const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
            target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
        } }).outputText;
        vm.runInNewContext('(function(require,module,exports){' + code + '\n})', { console: { error: error => errors.push(error) } }, { filename })(
            id => id === 'cc' ? cc : id === 'cc/env' ? { DEBUG: false, EDITOR: false } : load(path.resolve(path.dirname(filename), id)), module, module.exports);
        return module.exports;
    }
    const { BaseView } = load(path.join(scripts, 'framework/ui/BaseView'));
    const { LoadingPageView } = load(path.join(scripts, 'features/boot/ui/LoadingPageView'));
    const createLoading = () => {
        const loading = new Node().add(LoadingPageView);
        loading.progressBar = new Node().add(ProgressBar);
        loading.progressLabel = new Node().add(Label);
        return loading;
    };
    const loading = createLoading(), map = new Node().add(BaseView);
    const { FoundationBoot } = load(path.join(scripts, 'app/FoundationBoot'));
    const boot = new Node().add(FoundationBoot);
    boot.statusLabel = new Node().add(Label);
    boot.loadingPrefab = new Asset();
    boot.fit = () => {}; boot.fitNode = () => {};
    boot.host = {
        open() { if (options.fail === 'open') throw new Error('open failed'); loading.show(); return loading; },
        closeAll() { loading.close(); map.close(); },
    };
    boot.loadDocument = async name => {
        if (options.documentsGate) await options.documentsGate.promise;
        if (options.fail === 'documents') throw new Error('documents failed');
        return { json: name === 'prefab-registry' ? { prefabs: [] } : {} };
    };
    boot.prepare = async (id, layer, request, state, context) => {
        if (options.mapGate) await options.mapGate.promise;
        if (options.fail === 'map') throw new Error('map failed');
        return boot.entry(id, layer, map.node, map, state, context);
    };
    const update = loading.setProgress?.bind(loading), close = loading.close.bind(loading);
    loading.setProgress = value => { assert.ok(update, 'Loading must expose setProgress'); update(value); events.push({ type: 'progress', value: loading.progressBar.progress }); };
    loading.close = () => { events.push({ type: 'close', value: loading.progressBar.progress, ready: boot.ready }); close(); };
    return { boot, loading, map, scope, events, errors, createLoading, BaseView, afterUpdate };
}

test('Loading uses the existing View lifecycle and keeps bar and percent synchronized', () => {
    const r = runtime(), loading = r.createLoading();
    assert.ok(loading instanceof r.BaseView);
    loading.show();
    for (const [value, expected, text] of [[0, 0, '0%'], [.5, .5, '50%'], [1, 1, '100%'], [-2, 0, '0%'], [2, 1, '100%'], [.456, .456, '46%']]) {
        loading.setProgress(value);
        assert.equal(loading.progressBar.progress, expected); assert.equal(loading.progressLabel.string, text);
    }
    loading.hide(); loading.show();
    assert.equal(loading.progressLabel.string, '46%');
    for (const value of [NaN, Infinity, -Infinity]) assert.throws(() => loading.setProgress(value), /finite/);
});

test('Loading missing Inspector bindings fail explicitly and closed/destroyed views ignore late updates', () => {
    const r = runtime();
    for (const field of ['progressBar', 'progressLabel']) {
        const loading = r.createLoading(); loading[field] = null;
        assert.throws(() => loading.show(), new RegExp(field));
    }
    // Native Cocos destruction clears component fields after onDestroy.
    for (const end of [loading => loading.close(), loading => { loading.node.destroy(); loading.lifetime = null; }]) {
        const loading = r.createLoading(); loading.show(); loading.setProgress(.5); end(loading); loading.setProgress(1);
        assert.equal(loading.progressBar.progress, .5); assert.equal(loading.progressLabel.string, '50%');
    }
});

test('startup finishes progress before closing Loading and only becomes ready after first page succeeds', async () => {
    const mapGate = deferred(), r = runtime({ mapGate });
    const started = r.boot.start(); await settle();
    assert.equal(r.boot.ready, false); assert.equal(r.loading.isClosed, false);
    assert.ok(r.loading.progressBar.progress > 0 && r.loading.progressBar.progress < 1);
    mapGate.resolve(); await started;
    assert.equal(r.boot.ready, true); assert.equal(r.boot.currentRoute, 'mainline-map');
    const completed = r.events.findIndex(event => event.type === 'progress' && event.value === 1);
    const closed = r.events.findIndex(event => event.type === 'close');
    assert.ok(completed >= 0 && completed < closed);
    assert.equal(r.events[closed].ready, false); assert.equal(r.loading.isClosed, true);
    assert.equal(r.errors.length, 0);
});

for (const fail of ['open', 'documents', 'catalog', 'map']) test(`startup ${fail} failure stays unready and never completes the progress`, async () => {
    const r = runtime({ fail }); await r.boot.start();
    assert.equal(r.boot.ready, false); assert.equal(r.boot.currentRoute, 'loading');
    assert.equal(r.events.some(event => event.type === 'progress' && event.value === 1), false);
    assert.match(r.boot.statusLabel.string, /失败/);
    assert.equal(r.boot.scheduled, null, 'Failure notice remains visible');
    if (fail !== 'open') assert.equal(r.loading.isClosed, false);
});

for (const phase of ['documents', 'catalog', 'map']) test(`destroying startup during ${phase} ignores its late result`, async () => {
    const gate = deferred(), r = runtime({ [phase === 'documents' ? 'documentsGate' : phase === 'catalog' ? 'catalogGate' : 'mapGate']: gate });
    const started = r.boot.start(); await settle();
    r.boot.onDestroy();
    const previous = r.loading.progressBar.progress, eventCount = r.events.length;
    gate.resolve(); await started;
    assert.equal(r.boot.ready, false); assert.equal(r.loading.isClosed, true);
    assert.equal(r.loading.progressBar.progress, previous); assert.equal(r.events.length, eventCount);
    assert.equal(r.boot.currentView, null);
});
