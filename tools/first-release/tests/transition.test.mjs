import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
let ts;
try { ts = require('typescript'); } catch {
    const candidate = [process.env.TYPESCRIPT_PATH,
        'G:/cocosCreator/Editor/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js',
        'D:/Program Files/Trae/resources/app/extensions/node_modules/typescript/lib/typescript.js'].find(p => p && existsSync(p));
    if (!candidate) throw Error('Set TYPESCRIPT_PATH to the installed TypeScript runtime');
    ts = require(candidate);
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../assets/scripts');
class Node {
    static EventType = { NODE_DESTROYED: "destroyed" };
    active = false; isValid = true; parent = { children: [this] }; position = { x: 7, y: 100, z: 0 };
    components = new Map();
    getComponent(type) { return this.components.get(type) || null; }
    setPosition(x, y, z) { this.position = { x, y, z }; }
    setSiblingIndex(index) { this.siblingIndex = index; }
    destroy() { this.isValid = false; }
}
class Component { node; }
class UITransform { width = 853; height = 1844; }
class UIOpacity { node = new Node(); opacity = 255; isValid = true; }
class Graphics {
    calls = [];
    fillColor = { a: 255, clone() { return { ...this }; } };
    fillAlphas = [];
    clear() { this.calls.push('clear'); }
    rect(...box) { this.calls.push(box); }
    fill() { this.calls.push('fill'); this.fillAlphas.push(this.fillColor.a); }
}
const cc = {
    _decorator: { ccclass: () => klass => klass, property: (...args) => args.length >= 2 ? undefined : () => {} },
    Component, Node, Graphics, UIOpacity, UITransform,
    isValid: item => item && item.isValid !== false && item.node?.isValid !== false,
    director: { once() {} }, Director: { EVENT_AFTER_UPDATE: 'after-update' },
};
const cache = new Map();
function load(file) {
    const name = resolve(root, file.endsWith('.ts') ? file : file + '.ts');
    if (cache.has(name)) return cache.get(name).exports;
    const module = { exports: {} }; cache.set(name, module);
    const source = ts.transpileModule(readFileSync(name, 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
    } }).outputText;
    const localRequire = id => id === 'cc' ? cc : load(resolve(dirname(name), id));
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename: name })(localRequire, module, module.exports);
    return module.exports;
}
const { PageTransitionView } = load('features/common/ui/PageTransitionView');
function fixture() {
    const view = new PageTransitionView(); view.node = new Node();
    view.node.components.set(UITransform, new UITransform());
    view.curtain = new Graphics(); view.opacity = new UIOpacity();
    view.begin(); return view;
}
const pending = promise => { const state = { settled: false, result: null }; promise.then(result => { state.settled = true; state.result = result; }); return state; };
const flush = () => Promise.resolve();

test('cover keeps old-page barrier pending until curtain reaches fully opaque', async () => {
    const view = fixture(), state = pending(view.cover(.15));
    assert.equal(view.isShown, true); assert.equal(view.busy, true);
    assert.deepEqual(view.curtain.calls.slice(-3), ['clear', [-426.5, -922, 853, 1844], 'fill']);
    view.update(.075); await flush();
    assert.equal(state.settled, false); assert.ok(view.opacity.opacity > 0 && view.opacity.opacity < 255);
    assert.equal(view.curtain.fillAlphas.at(-1), view.opacity.opacity, 'Graphics must bake the intermediate alpha into its actual fill');
    view.update(.075); await flush();
    assert.deepEqual(state, { settled: true, result: true });
    assert.equal(view.opacity.opacity, 255); assert.equal(view.phase, 'covered');
    assert.equal(view.curtain.fillAlphas.at(-1), 255);
    assert.equal(view.node.active, true);
});

test('reveal keeps input barrier until longer entrance finishes and restores exact target pose', async () => {
    const view = fixture(), target = new UIOpacity(); await view.cover(0);
    const state = pending(view.reveal(.1, target, .2));
    assert.equal(target.node.position.y, 86); assert.equal(target.opacity, 220);
    view.update(.1); await flush();
    assert.equal(view.opacity.opacity, 0); assert.equal(state.settled, false);
    assert.equal(view.curtain.fillAlphas.at(-1), 0);
    assert.equal(view.busy, true); assert.equal(view.node.active, true);
    assert.ok(target.node.position.y > 86 && target.node.position.y < 100);
    view.update(.1); await flush();
    assert.deepEqual(state, { settled: true, result: true });
    assert.deepEqual(target.node.position, { x: 7, y: 100, z: 0 }); assert.equal(target.opacity, 255);
    assert.equal(view.busy, false); assert.equal(view.node.active, false);
});

test('short entrance does not finish a longer curtain reveal early', async () => {
    const view = fixture(), target = new UIOpacity(); await view.cover(0);
    const state = pending(view.reveal(.2, target, .05));
    view.update(.05); await flush();
    assert.equal(target.node.position.y, 100); assert.equal(target.opacity, 255);
    assert.equal(state.settled, false); assert.ok(view.opacity.opacity > 0);
    view.update(.151); await flush(); assert.equal(state.settled, true);
    assert.equal(view.isShown, false);
});

test('zero durations complete immediately without a timer or external update', async () => {
    const view = fixture(), target = new UIOpacity();
    assert.equal(await view.cover(0), true); assert.equal(view.opacity.opacity, 255);
    assert.equal(await view.reveal(0, target, 0), true);
    assert.equal(view.opacity.opacity, 0); assert.equal(view.node.active, false);
    assert.equal(target.opacity, 255); assert.equal(target.node.position.y, 100);
});

test('begin during reveal settles superseded promise and restores pose before starting again', async () => {
    const view = fixture(), target = new UIOpacity(); await view.cover(0);
    const old = view.reveal(.2, target, .2); view.update(.04); view.begin();
    assert.equal(await old, false); assert.equal(target.opacity, 255); assert.equal(target.node.position.y, 100);
    assert.equal(view.phase, 'preparing'); assert.equal(view.opacity.opacity, 0); assert.equal(view.isShown, true);
    const fresh = view.cover(.1); view.update(.1); assert.equal(await fresh, true);
});

test('hide and destruction settle animation promises without touching an invalid entrance node', async () => {
    for (const destroy of [false, true]) {
        const view = fixture(), target = new UIOpacity(); await view.cover(0);
        const animation = view.reveal(.2, target, .2); view.update(.03);
        if (destroy) { target.node.isValid = false; view.onDestroy(); }
        else view.hide();
        assert.equal(await animation, false); assert.equal(view.phase, 'idle');
        if (!destroy) { assert.equal(target.opacity, 255); assert.equal(target.node.position.y, 100); }
        view.update(10); assert.equal(view.busy, false);
    }
});

test('invalid timing is rejected without replacing the in-flight cover', async () => {
    const view = fixture(), cover = view.cover(.2);
    view.update(.05); const opacity = view.opacity.opacity;
    for (const duration of [-1, NaN, Infinity]) {
        assert.throws(() => view.cover(duration), /Invalid page transition duration/);
        assert.throws(() => view.reveal(.1, new UIOpacity(), duration), /Invalid page transition duration/);
        assert.equal(view.opacity.opacity, opacity); assert.equal(view.phase, 'covering');
    }
    view.update(.151); assert.equal(await cover, true); assert.equal(view.opacity.opacity, 255);
});

test('reset cancels an outstanding cover and a later begin can be used normally', async () => {
    const view = fixture(), cover = view.cover(.2); view.update(.1); view.reset();
    assert.equal(await cover, false); assert.equal(view.opacity.opacity, 0);
    assert.equal(view.isShown, false); assert.equal(view.busy, false);
    view.begin(); assert.equal(await view.cover(0), true);
    assert.equal(await view.reveal(0, new UIOpacity(), 0), true);
});

// Exercise the real async composition root with explicit ports; no engine renderer is simulated here.
function bootFixture({ delayLevel = false, failLevel = false } = {}) {
    class Session { constructor(level, attempt) { this.level = level; this.attemptId = attempt; } restore(value) { this.restored = value; } }
    const filename = resolve(root, 'app/FirstReleaseBoot.ts'), module = { exports: {} };
    const source = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
    } }).outputText;
    const req = id => id === 'cc' ? cc : id === 'cc/env' ? { EDITOR: false } : id.endsWith('/PuzzleSession') ? { PuzzleSession: Session }
        : new Proxy({}, { get: () => class {} });
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(req, module, module.exports);
    const boot = new module.exports.FirstReleaseBoot(), curtain = fixture(), log = [], destroyed = [];
    let ready; const levelReady = new Promise(resolve => { ready = resolve; });
    const next = { isClosed: false, pageOpacity: new UIOpacity(), entranceOpacity: new UIOpacity(),
        controller: { enabled: true, suspend() { log.push('next.suspend'); }, resume() { log.push('next.resume'); } },
        node: { once(_event, callback) { destroyed.push(callback); } },
        async setLevel() { log.push('prepare'); if (delayLevel) await levelReady; if (failLevel) throw Error('fixture asset failure'); log.push('ready'); },
        setHints(n) { log.push('hints:'+n); },
        close() { if (!this.isClosed) { this.isClosed = true; destroyed.forEach(fn=>fn()); log.push('next.close'); } },
    };
    next.pageOpacity.opacity = 0;
    boot.node = { getComponent() { return { cameraComponent: {} }; } };
    boot.transition = curtain; boot.currentRoute = 'home'; boot.homeView = { hide() { log.push('home.hide'); } };
    boot.services = { startOrResume() { log.push('attempt'); return { puzzleId: 'one', attemptId: 'attempt', levelNo: 1, snapshot: null }; }, state: { hints: 9 } };
    boot.catalog = { getById() { return { id: 'one' }; } };
    boot.assets = { createScope() { return { release() { log.push('scope.release'); } }; } };
    boot.meta = { getConstant(id) { return id === 'puzzleTransitionFadeSeconds' ? .15 : .12; } };
    boot.guide = { suspend() { log.push('guide.suspend'); }, attachPuzzle() { log.push('guide.attach'); }, sync() { log.push('guide.sync'); } };
    boot.mount = async () => next; boot.closeDialog = () => log.push('dialog.close'); boot.fit = () => {}; boot.requestRender = () => log.push('render');
    return { boot, next, curtain, log, ready };
}
const microtasks = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('entry keeps the home page until ready and covered, then unlocks only after reveal', async () => {
    const {boot,next,curtain,log,ready} = bootFixture({ delayLevel: true });
    const entry = boot.showPuzzle(); await microtasks();
    assert.equal(next.controller.enabled, false); assert.equal(next.pageOpacity.opacity, 0);
    assert.equal(boot.currentRoute, 'home'); assert.equal(log.includes('home.hide'), false);
    await boot.showPuzzle(); assert.equal(log.filter(x=>x==='attempt').length, 1, 'concurrent entry cannot create a second attempt');
    ready(); await microtasks();
    assert.equal(curtain.phase, 'covering'); assert.equal(log.includes('home.hide'), false);
    curtain.update(.15); await microtasks();
    assert.equal(log.includes('home.hide'), true); assert.equal(boot.currentRoute, 'puzzle');
    assert.equal(next.pageOpacity.opacity, 255); assert.equal(next.controller.enabled, false);
    assert.equal(log.includes('next.resume'), false); assert.equal(log.includes('guide.sync'), false);
    curtain.update(.15); await entry;
    assert.equal(next.controller.enabled, true); assert.equal(boot.puzzleOpening, false);
    assert.equal(log.includes('next.resume'), true); assert.equal(log.includes('guide.sync'), true);
    assert.ok(log.indexOf('hints:9') < log.indexOf('home.hide'));
});

test('asset preparation failure preserves home and removes the transparent candidate and barrier', async () => {
    const {boot,next,curtain,log} = bootFixture({ failLevel: true });
    await assert.rejects(boot.showPuzzle(), /fixture asset failure/);
    assert.equal(boot.currentRoute, 'home'); assert.equal(boot.puzzleView, null);
    assert.equal(log.includes('home.hide'), false); assert.equal(next.isClosed, true);
    assert.equal(curtain.busy, false); assert.equal(curtain.isShown, false);
    assert.equal(boot.puzzleOpening, false); assert.equal(log.includes('guide.sync'), true);
});

test('destroy during preparation does not revive the new page or its input when loading completes', async () => {
    const {boot,next,curtain,log,ready} = bootFixture({ delayLevel: true });
    const entry = boot.showPuzzle(); await microtasks();
    boot.disposed = true; curtain.close(); ready(); await entry;
    assert.equal(next.isClosed, true); assert.equal(log.includes('home.hide'), false);
    assert.equal(log.includes('next.resume'), false); assert.equal(log.includes('guide.sync'), false);
    assert.equal(log.includes('render'), false);
});

test('late preparation never closes a component already destructed by the engine', async () => {
    const { boot, next, curtain, ready } = bootFixture({ delayLevel: true });
    const entry = boot.showPuzzle(); await microtasks();
    boot.disposed = true; next.isValid = false; curtain.close();
    next.close = () => { throw Error('engine already destructed this candidate'); };
    ready(); await assert.doesNotReject(entry);
});

for (const action of ['restart', 'next']) test(action + ' asset failure returns home instead of reviving an obsolete attempt and retry resumes the committed attempt', async () => {
    const { boot, next, curtain, log } = bootFixture({ failLevel: true });
    const attempt = { puzzleId: 'one', attemptId: action + '-new', levelNo: 2, snapshot: null };
    let resumeCalls = 0, created = 0;
    boot.services.state = { activeAttempt: attempt, energy: 4, hints: 9 };
    boot.services.getGuidePhase = () => 'complete';
    boot.services.startOrResume = () => {
        resumeCalls++;
        if (!boot.services.state.activeAttempt) {
            created++; boot.services.state.energy--;
            boot.services.state.activeAttempt = { ...attempt, attemptId: action + '-unexpected' };
        }
        return boot.services.state.activeAttempt;
    };
    const old = { session: { attemptId: action + '-old' },
        controller: { suspend() { log.push('old.suspend'); }, resume() { log.push('old.resume'); } },
        close() { log.push('old.close'); } };
    boot.puzzleView = old; boot.currentRoute = 'puzzle';
    Object.assign(boot.homeView, { async setData() { log.push('home.data'); }, setMode() {}, show() { log.push('home.show'); } });
    boot.scheduleOnce = () => {};
    await assert.rejects(boot.showPuzzle(), /fixture asset failure/);
    assert.equal(boot.currentRoute, 'home'); assert.equal(boot.puzzleView, null);
    assert.equal(log.includes('old.close'), true); assert.equal(log.includes('old.resume'), false);
    assert.equal(log.includes('home.show'), true); assert.equal(next.isClosed, true);
    assert.equal(curtain.busy, false); assert.equal(curtain.isShown, false);
    assert.equal(boot.services.state.activeAttempt.attemptId, attempt.attemptId);
    assert.equal(boot.services.state.energy, 4); assert.equal(boot.puzzleOpening, false);
    const candidate = { ...next, isClosed: false, controller: { enabled: true, resume() { log.push('retry.resume'); } },
        pageOpacity: new UIOpacity(), entranceOpacity: new UIOpacity(), node: { once() {} },
        async setLevel(_scope, _level, session) { this.session = session; },
        close() { this.isClosed = true; } };
    candidate.pageOpacity.opacity = 0;
    boot.mount = async () => candidate;
    const retry = boot.showPuzzle(); await microtasks(); curtain.update(.15); await microtasks(); curtain.update(.15); await retry;
    assert.equal(boot.currentRoute, 'puzzle'); assert.equal(boot.puzzleView, candidate);
    assert.equal(candidate.session.attemptId, attempt.attemptId);
    assert.equal(candidate.controller.enabled, true); assert.equal(log.includes('retry.resume'), true);
    assert.equal(resumeCalls, 2); assert.equal(created, 0); assert.equal(boot.services.state.energy, 4);
    assert.equal(log.includes('old.resume'), false);
});
