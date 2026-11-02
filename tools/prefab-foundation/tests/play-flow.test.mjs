import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_PATH || 'G:/cocosCreator/Editor/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const cache = new Map();
function load(filename) {
    filename = path.resolve(filename.endsWith('.ts') ? filename : filename + '.ts');
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    vm.runInThisContext('(function(module,exports,require){' + code + '\n})', { filename })(module, module.exports,
        id => { assert.ok(id.startsWith('.'), 'App attempt data has no engine, storage or SDK dependency'); return load(path.resolve(path.dirname(filename), id)); });
    return module.exports;
}
const { UIFlow } = load(path.join(project, 'assets/scripts/app/UIFlow'));
const { PuzzleAttemptStore } = load(path.join(project, 'assets/scripts/app/PuzzleAttemptStore'));
const levels = JSON.parse(fs.readFileSync(path.join(project, 'assets/bundles/puzzle/config/level-catalog.json'))).levels;
const level = levels[0];
const translation = piece => ({ q: piece.targetCells[0].q - piece.cells[0].q, r: piece.targetCells[0].r - piece.cells[0].r });
const defer = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { resolve, reject, promise }; };

function fixture(number = 1, resultRoute = 'puzzle-result') {
    let status = 'active', returns = 0;
    const notices = [], mounts = [], waits = new Map(), context = Object.freeze({ presentation: 'level', mainlineNumber: number, levelId: 'question-' + number, mapPage: Math.ceil(number / 8) });
    const entry = (id, layer, context) => ({ id, layer, context, closed: false, visible: false,
        show() { this.visible = true; }, hide() { this.visible = false; }, close() { this.closed = true; this.visible = false; } });
    const page = entry('puzzle', 'page', context); page.show();
    const flow = new UIFlow({ allowDemo: true, levelIdFor: n => 'question-' + n,
        play: { status: () => status, resultRoute: () => resultRoute, returnPiece: () => { returns++; } },
        notice: text => notices.push(text), changed() {},
        async mount(id, layer, request, state, context) {
            const mounted = entry(id, layer, context); mounted.state = state; mounted.restart = request.restartAttempt; mounts.push(mounted);
            const remove = request.onCancel(() => mounted.close());
            try { if (waits.has(id)) await waits.get(id).promise; return mounted; } finally { remove(); }
        },
    }, page);
    return { flow, page, notices, mounts, waits, setStatus: value => { status = value; }, returns: () => returns };
}

test('attempt preparation is provisional; committing retains per-question attempts across navigation', () => {
    const store = new PuzzleAttemptStore(), first = store.prepare(level);
    assert.equal(store.current, null); assert.equal(store.get(level.id), null);
    first.commit(); first.session.place(level.pieces[0].id, translation(level.pieces[0]));
    const snapshot = first.session.snapshot;
    const other = store.prepare(levels[1]); other.commit(); assert.equal(store.current, other.session);
    const restored = store.prepare(level); assert.equal(restored.session, first.session); restored.commit();
    assert.deepEqual(store.current.snapshot, snapshot);
});

test('cancelled restart preparation leaves the old attempt and moves intact', () => {
    const store = new PuzzleAttemptStore(), initial = store.prepare(level); initial.commit();
    initial.session.place(level.pieces[0].id, translation(level.pieces[0]));
    const before = initial.session.snapshot, restart = store.prepare(level, true);
    assert.notEqual(restart.session.attemptId, before.attemptId);
    assert.equal(restart.session.snapshot.moves, 0);
    assert.deepEqual(store.current.snapshot, before);
    const restored = store.prepare(level); restored.commit();
    assert.throws(() => restart.commit(), /obsolete/);
    assert.deepEqual(store.current.snapshot, before);
});

test('accepted restart commits one fresh attempt; repeat show cannot replace it twice', () => {
    const store = new PuzzleAttemptStore(), initial = store.prepare(level); initial.commit();
    const restart = store.prepare(level, true); restart.commit(); const accepted = store.current;
    restart.commit(); assert.equal(store.current, accepted); assert.notEqual(accepted.attemptId, initial.session.attemptId);
    store.clear(); assert.equal(store.current, null); assert.equal(store.get(level.id), null);
});

test('real play rejects demo completion and only accepts matching terminal rule state', async () => {
    const f = fixture();
    await f.flow.handle('demo:result'); assert.equal(f.flow.page, f.page);
    assert.equal(await f.flow.showPuzzleOutcome('completed'), false);
    f.setStatus('failed'); assert.equal(await f.flow.showPuzzleOutcome('completed'), false);
    f.setStatus('completed'); assert.equal(await f.flow.showPuzzleOutcome('completed'), true);
    assert.equal(f.flow.current.id, 'puzzle-result');
    assert.equal(await f.flow.showPuzzleOutcome('completed'), false); assert.equal(f.mounts.length, 1);
});

test('challenge completion uses its own existing result prefab; failure is a retained-page overlay', async () => {
    const won = fixture(6, 'challenge-result'); won.setStatus('completed'); await won.flow.showPuzzleOutcome('completed');
    assert.equal(won.flow.page.id, 'challenge-result');
    const failed = fixture(6); failed.setStatus('failed'); await failed.flow.showPuzzleOutcome('failed');
    assert.equal(failed.flow.page, failed.page); assert.equal(failed.flow.current.id, 'challenge-fail');
    assert.equal(failed.page.closed, false); assert.equal(await failed.flow.showPuzzleOutcome('failed'), false);
});

test('pause/help block gameplay and outcome presentation until the retained page resumes', async () => {
    const f = fixture(); await f.flow.openOverlay('pause');
    await f.flow.handle('play:return-piece'); assert.equal(f.returns(), 0);
    f.setStatus('completed'); assert.equal(await f.flow.showPuzzleOutcome('completed'), false);
    f.flow.closeOverlay(); assert.equal(f.flow.page, f.page);
    await f.flow.showPuzzleOutcome('completed'); assert.equal(f.flow.page.id, 'puzzle-result');
});

test('return action reaches the narrow controller port without navigating or persisting', async () => {
    const f = fixture(); await f.flow.handle('play:return-piece'); await f.flow.handle('demo:return-piece');
    assert.equal(f.returns(), 2); assert.equal(f.flow.page, f.page); assert.equal(f.mounts.length, 0);
});

test('cancel restart keeps the page; confirmation mounts a forced provisional attempt', async () => {
    const f = fixture(); await f.flow.handle('open:confirmation-restart'); f.flow.closeOverlay();
    assert.equal(f.flow.page, f.page); assert.equal(f.page.closed, false);
    await f.flow.handle('open:confirmation-restart'); await f.flow.handle('confirm:restart');
    assert.equal(f.flow.current.id, 'puzzle'); assert.equal(f.mounts.at(-1).restart, true); assert.equal(f.page.closed, true);
});

test('failed restart navigation keeps the original page and confirmation for a safe retry', async () => {
    const f = fixture(); await f.flow.handle('open:confirmation-restart'); const confirmation = f.flow.current;
    const waiting = defer(); f.waits.set('puzzle', waiting);
    const restarting = f.flow.handle('confirm:restart'); waiting.reject(new Error('asset failure')); await restarting;
    assert.equal(f.flow.page, f.page); assert.equal(f.flow.current, confirmation); assert.equal(f.page.closed, false);
    f.waits.delete('puzzle'); await f.flow.handle('confirm:restart');
    assert.equal(f.flow.page.id, 'puzzle'); assert.equal(f.mounts.at(-1).restart, true);
});

test('free failure retry creates a new attempt only after successful puzzle preparation', async () => {
    const f = fixture(6); f.setStatus('failed'); await f.flow.showPuzzleOutcome('failed');
    await f.flow.handle('play:retry', f.flow.current);
    assert.equal(f.flow.current.id, 'puzzle'); assert.equal(f.flow.overlayCount, 0); assert.equal(f.mounts.at(-1).restart, true);
});

test('next question is gated by real completion and safely terminates at mainline 96', async () => {
    const f = fixture(5); await f.flow.handle('play:next'); assert.equal(f.flow.page, f.page);
    f.setStatus('completed'); await f.flow.showPuzzleOutcome('completed'); await f.flow.handle('play:next', f.flow.current);
    assert.equal(f.flow.page.id, 'puzzle'); assert.equal(f.flow.context.mainlineNumber, 6); assert.equal(f.flow.context.levelId, 'question-6');
    const last = fixture(96, 'challenge-result'); last.setStatus('completed');
    await last.flow.showPuzzleOutcome('completed'); await last.flow.handle('play:next', last.flow.current);
    assert.equal(last.flow.page.id, 'mainline-map'); assert.equal(last.flow.context.mainlineNumber, 96);
    assert.ok(!last.mounts.some(item => item.context.mainlineNumber > 96));
});

test('late cancelled forced restart cannot replace a newer navigation', async () => {
    const f = fixture(); await f.flow.handle('open:confirmation-restart');
    const waiting = defer(); f.waits.set('puzzle', waiting);
    const restarting = f.flow.handle('confirm:restart'); await f.flow.handle('nav:garden'); waiting.resolve(); await restarting;
    assert.equal(f.flow.current.id, 'garden'); assert.equal(f.mounts.find(item => item.restart).closed, true);
});

test('reserve completion preserves its own identity through challenge result and exits without mainline 97', async () => {
    const f = fixture(1, 'challenge-result');
    const reserve = { ...f.flow.context, levelId: 'challenge-026', debugLevelId: 'challenge-026' };
    await f.flow.replacePage('puzzle', undefined, true, false, reserve);
    f.setStatus('completed'); await f.flow.showPuzzleOutcome('completed');
    assert.equal(f.flow.context.levelId, 'challenge-026'); assert.equal(f.flow.context.debugLevelId, 'challenge-026');
    await f.flow.handle('play:next'); assert.equal(f.flow.current.id, 'mainline-map');
    assert.equal(f.flow.context.levelId, 'question-1'); assert.equal(f.flow.context.debugLevelId, undefined);
});

function bootClass(debug = true) {
    const filename = path.join(project, 'assets/scripts/app/FoundationBoot.ts');
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS, experimentalDecorators: true } }).outputText;
    const module = { exports: {} };
    vm.runInThisContext('(function(module,exports,require){' + code + '\n})', { filename })(module, module.exports,
        id => id === 'cc' ? { Component: class {}, isValid: value => !!value,
            _decorator: { ccclass: () => value => value, property: () => () => {} } }
            : id === 'cc/env' ? { DEBUG: debug, EDITOR: false } : {});
    return module.exports.FoundationBoot;
}

test('Boot view show failures do not commit provisional attempts or enable the staged controller', () => {
    const Boot = bootClass(), boot = new Boot(), store = new PuzzleAttemptStore();
    const initial = store.prepare(level); initial.commit();
    const restart = store.prepare(level, true), node = { position: { clone: () => ({}) }, setPosition() {}, on() {}, off() {} };
    const component = { show() {}, close() {}, hide() {} }, controller = { enabled: false };
    const entry = boot.entry('puzzle', 'page', node, component);
    entry.controller = controller; entry.commitAttempt = restart.commit;
    boot.fitNode = () => { throw new Error('layout failed'); };
    assert.throws(() => entry.show(), /layout failed/);
    assert.equal(store.current, initial.session); assert.equal(controller.enabled, false);
    boot.fitNode = () => {}; entry.show();
    assert.equal(store.current, restart.session); assert.equal(controller.enabled, true);
    entry.show(); assert.equal(store.current, restart.session);
});

test('Boot suspends the retained controller for every overlay and resumes the same attempt afterward', () => {
    const Boot = bootClass(), boot = new Boot(); let suspended = 0, resumed = 0;
    const page = { id: 'puzzle', view: {}, controller: { suspend() { suspended++; }, resume() { resumed++; } },
        session: { snapshot: { status: 'active' } } };
    boot.flow = { page, current: page, overlayCount: 0, navigating: false };
    boot.fit = () => {};
    boot.onFlowChanged(); assert.equal(resumed, 1);
    boot.flow.overlayCount = 1; boot.onFlowChanged(); assert.equal(suspended, 1);
    boot.flow.overlayCount = 3; boot.onFlowChanged(); assert.equal(suspended, 2);
    boot.flow.overlayCount = 0; boot.onFlowChanged(); assert.equal(resumed, 2);
    assert.equal(boot.currentPuzzleController, page.controller);
});

function liveBoot(status = 'completed', resultRoute = 'puzzle-result') {
    const Boot = bootClass(false), boot = new Boot(), waits = new Map(), mounts = [];
    const context = Object.freeze({ presentation: 'level', mainlineNumber: 1, levelId: level.id, mapPage: 1 });
    const snapshot = Object.freeze({ attemptId: 'retained-attempt', levelId: level.id, moves: 3, status, placements: Object.freeze({}) });
    const controller = { listening: true, suspend() { this.listening = false; }, resume() { this.listening = true; } };
    const page = { id: 'puzzle', layer: 'page', context, controller, session: { snapshot }, show() {}, hide() {}, close() {} };
    let failures = 1;
    const flow = new UIFlow({ allowDemo: false, changed: () => boot.onFlowChanged(),
        navigationChanged: () => boot.syncPuzzleInput(), notice: message => boot.notice(message),
        play: { status: () => snapshot.status, resultRoute: () => resultRoute, returnPiece() {} },
        async mount(id, layer, request, state, context) {
            mounts.push(id);
            if (waits.has(id)) await waits.get(id).promise;
            if ((id === resultRoute || id === 'challenge-fail') && failures-- > 0) throw new Error('result asset unavailable');
            return { id, layer, context, show() {}, hide() {}, close() {} };
        },
    }, page);
    boot.flow = flow; boot.fit = () => {};
    boot.statusLabel = { string: '', node: { active: false } };
    boot.unschedule = () => {}; boot.scheduleOnce = () => {};
    return { boot, flow, page, snapshot, controller, mounts, waits };
}

for (const [status, resultRoute, destination] of [['completed', 'puzzle-result', 'puzzle-result'], ['failed', 'challenge-result', 'challenge-fail']]) {
    test('release build ' + status + ' result failure exposes one explicit retry without replaying the attempt', async () => {
        const f = liveBoot(status, resultRoute);
        f.boot.openOutcome(f.page);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(f.flow.current, f.page); assert.equal(f.controller.listening, false);
        assert.equal(f.page.outcomeRetry, true); assert.equal(f.boot.statusLabel.node.active, true);
        assert.match(f.boot.statusLabel.string, /加载失败，点此重试/);
        assert.equal(f.mounts.length, 1);
        f.boot.onFlowChanged(); f.boot.onFlowChanged();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(f.mounts.length, 1, 'no automatic retry loop');
        f.boot.onDemoAction();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(f.flow.current.id, destination); assert.equal(f.mounts.length, 2);
        assert.equal(f.page.session.snapshot, f.snapshot); assert.equal(f.snapshot.moves, 3);
        assert.equal(f.snapshot.attemptId, 'retained-attempt'); assert.equal(f.boot.statusLabel.node.active, false);
    });
}

test('pending user navigation suspends input immediately and old terminal callbacks cannot replace or cancel it', async () => {
    const f = liveBoot('completed'), waiting = defer(); f.waits.set('garden', waiting);
    const nextContext = Object.freeze({ ...f.flow.context, mainlineNumber: 2, levelId: 'classic-002' });
    const navigating = f.flow.replacePage('garden', undefined, false, false, nextContext);
    assert.equal(f.controller.listening, false); assert.equal(f.flow.navigating, true);
    f.boot.openOutcome(f.page); assert.equal(await f.flow.showPuzzleOutcome('completed'), false);
    await f.flow.handle('play:return-piece');
    assert.deepEqual(f.mounts, ['garden']); assert.equal(f.flow.context.levelId, level.id);
    waiting.resolve(); assert.equal(await navigating, true);
    assert.equal(f.flow.current.id, 'garden'); assert.deepEqual(f.flow.context, nextContext);
    assert.equal(f.page.session.snapshot, f.snapshot);
});

test('failed navigation resumes an active retained puzzle after immediate pending suspension', async () => {
    const f = liveBoot('active'), waiting = defer(); f.waits.set('garden', waiting);
    const navigating = f.flow.replacePage('garden');
    assert.equal(f.controller.listening, false);
    waiting.reject(new Error('garden failed')); assert.equal(await navigating, false);
    assert.equal(f.controller.listening, true); assert.equal(f.flow.page, f.page);
    assert.equal(f.page.session.snapshot, f.snapshot);
});
