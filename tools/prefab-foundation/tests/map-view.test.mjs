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
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

// Compile the actual View and lifecycle. Presentation is the narrow boundary:
// paging and item loading have their own real-implementation regressions.
function runtime() {
    const calls = [], afterUpdate = [];
    class Component { get isValid() { return this.node?.isValid !== false; } }
    class Node {
        active = true; isValid = true; events = []; components = [];
        add(Type) { const value = new Type(); value.node = this; this.components.push(value); return value; }
        emit(name, payload) { this.events.push({ name, payload }); }
        destroy() { if (!this.isValid) return; this.isValid = false; this.components.forEach(component => component.onDestroy?.()); }
    }
    class MainlineMapPresentation extends Component {
        layout = { present: async scope => { calls.push({ mode: 'fixture', scope }); } };
        pageLabel = {}; previousButton = {}; nextButton = {}; actionTarget = {};
        async present(scope, catalog, page) { calls.push({ mode: 'level', scope, catalog, page }); }
    }
    const cc = {
        Component, Node,
        _decorator: { ccclass: () => target => target, property: (...args) => args.length >= 2 ? undefined : () => {} },
        isValid: value => !!value && value.isValid !== false,
        director: { once: (_event, callback) => afterUpdate.push(callback) }, Director: { EVENT_AFTER_UPDATE: 'after-update' },
    };
    const cache = new Map();
    function load(filename) {
        filename = path.resolve(filename.endsWith('.ts') ? filename : filename + '.ts');
        if (path.basename(filename) === 'MainlineMapPresentation.ts') return { MainlineMapPresentation };
        if (cache.has(filename)) return cache.get(filename).exports;
        const module = { exports: {} }; cache.set(filename, module);
        const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
            target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
        } }).outputText;
        vm.runInThisContext('(function(require,module,exports){' + code + '\n})', { filename })(
            id => id === 'cc' ? cc : load(path.resolve(path.dirname(filename), id)), module, module.exports);
        return module.exports;
    }
    const { BaseView } = load(path.join(scripts, 'framework/ui/BaseView'));
    const { MainlineMapPageView } = load(path.join(scripts, 'features/mainline/ui/MainlineMapPageView'));
    const view = new Node().add(MainlineMapPageView);
    view.presentation = new Node().add(MainlineMapPresentation);
    return { view, BaseView, calls, afterUpdate, scope: { isReleased: false }, catalog: { getMainline() {} } };
}

test('map uses the existing BaseView lifecycle without template state arrays', () => {
    const r = runtime(), view = r.view;
    assert.ok(view instanceof r.BaseView);
    for (const field of ['stateRoots', 'stateIds', 'sourceLayouts', 'visualRoot', 'dynamicRoot', 'nodesRoot', 'levelNodePrefab'])
        assert.equal(field in view, false, `Map retains template field ${field}`);
    view.show(); assert.equal(view.isShown, true);
    view.hide(); assert.equal(view.isShown, false);
    view.show(); assert.equal(view.isShown, true);
    assert.equal(r.calls.length, 0, 'Visibility must not trigger another presentation');
    view.close(); assert.equal(view.isClosed, true);
});

test('map identifies missing Inspector presentation and paging bindings before showing', () => {
    for (const field of ['presentation', 'layout', 'pageLabel', 'previousButton', 'nextButton', 'actionTarget']) {
        const { view } = runtime();
        if (field === 'presentation') view.presentation = null;
        else view.presentation[field] = null;
        assert.throws(() => view.show(), new RegExp(field));
    }
});

test('serialized map buttons forward their configured action through the owning View', () => {
    const { view } = runtime(); view.show();
    view.onAction(undefined, 'nav:garden');
    assert.equal(view.node.events.length, 1);
    const event = view.node.events[0];
    assert.equal(event.name, 'view-action'); assert.equal(event.payload.actionId, 'nav:garden');
    assert.equal(event.payload.view, view);
});

test('live map renders once through paging, while an artwork fixture renders once through Core', async () => {
    const r = runtime(); r.view.show();
    await r.view.render(r.scope, r.catalog, 12);
    assert.equal(r.calls.length, 1);
    assert.equal(r.calls[0].mode, 'level'); assert.equal(r.calls[0].scope, r.scope);
    assert.equal(r.calls[0].catalog, r.catalog); assert.equal(r.calls[0].page, 12);
    await r.view.render(r.scope, r.catalog, 1, true);
    assert.equal(r.calls.length, 2); assert.equal(r.calls[1].mode, 'fixture');
    assert.equal(r.calls[1].scope, r.scope);
});

test('presentation failures propagate without rendering a fallback or issuing extra work', async () => {
    const r = runtime(); r.view.show();
    const failure = new Error('level assets failed'); let attempts = 0;
    r.view.presentation.present = async () => { attempts++; throw failure; };
    await assert.rejects(r.view.render(r.scope, r.catalog, 1), error => error === failure);
    assert.equal(attempts, 1); assert.equal(r.calls.length, 0);
});

test('closed and native-destructed map Views do not start late presentation work', async () => {
    for (const nativeDestruction of [false, true]) {
        const r = runtime(); r.view.show();
        if (nativeDestruction) { r.view.node.destroy(); r.view.lifetime = null; }
        else r.view.close();
        await r.view.render(r.scope, r.catalog, 1);
        await r.view.render(r.scope, r.catalog, 1, true);
        assert.equal(r.calls.length, 0);
    }
});

test('closing during presentation releases the inherited scope after destruction and does not restart rendering', async () => {
    const r = runtime(), pending = deferred(); let attempts = 0, releases = 0;
    r.scope.release = () => { releases++; r.scope.isReleased = true; };
    r.view.attachResourceScope(r.scope); r.view.show();
    r.view.presentation.present = async () => { attempts++; await pending.promise; };
    const rendering = r.view.render(r.scope, r.catalog, 1);
    r.view.close(); assert.equal(releases, 0);
    r.afterUpdate.splice(0).forEach(callback => callback()); assert.equal(releases, 1);
    pending.resolve(); await rendering;
    assert.equal(attempts, 1); assert.equal(r.calls.length, 0); assert.equal(r.view.node.events.length, 0);
});
