import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
let ts;
try { ts = require('typescript'); } catch {
    const location = [process.env.TYPESCRIPT_PATH,
        'G:/cocosCreator/Editor/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js',
        'D:/Program Files/Trae/resources/app/extensions/node_modules/typescript/lib/typescript.js']
        .find(value => value && existsSync(value));
    if (!location) throw new Error('Set TYPESCRIPT_PATH to an existing TypeScript installation');
    ts = require(location);
}
const source = resolve(dirname(fileURLToPath(import.meta.url)), '../../../assets/scripts/app/UIFlow.ts');
const output = ts.transpileModule(readFileSync(source, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const module = { exports: {} };
vm.runInThisContext(`(function(module,exports){${output}\n})`, { filename: source })(module, module.exports);
const { UIFlow } = module.exports;
const deferred = () => {
    let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const entry = (id, layer = 'page') => ({
    id, layer, visible: false, closed: false, closes: 0, shows: 0, hides: 0,
    show() { assert.equal(this.closed, false); this.visible = true; this.shows++; },
    hide() { this.visible = false; this.hides++; },
    close() { if (this.closed) return; this.visible = false; this.closed = true; this.closes++; },
});
function fixture(initialId = 'mainline-map', allowDemo = true, levelIdFor) {
    const entries = [], notices = [], pending = new Map(); let changes = 0, cancels = 0;
    const initial = entry(initialId); initial.show();
    const flow = new UIFlow({
        allowDemo,
        levelIdFor,
        async mount(id, layer, request, state, context) {
            const target = entry(id, layer); entries.push(target);
            target.state = state;
            target.context = context;
            const remove = request.onCancel(() => { cancels++; target.close(); });
            try { if (pending.has(id)) await pending.get(id).promise; return target; }
            catch (error) { target.close(); throw error; }
            finally { remove(); }
        },
        notice(message) { notices.push(message); }, changed() { changes++; },
    }, initial);
    return { flow, initial, entries, notices, pending, changes: () => changes, cancels: () => cancels };
}

test('Loading, map, garden and puzzle preview follow UI routes without player-state side effects', async () => {
    const f = fixture('loading');
    await f.flow.replacePage('mainline-map'); const map = f.flow.page;
    await f.flow.handle('nav:garden', map); assert.equal(f.flow.page.id, 'garden'); assert.equal(map.closed, true);
    await f.flow.handle('back', f.flow.current); assert.equal(f.flow.page.id, 'mainline-map');
    const secondMap = f.flow.page;
    await f.flow.handle('nav:puzzle-preview', secondMap);
    assert.equal(f.flow.current.id, 'puzzle-preview'); assert.equal(f.flow.current.layer, 'dialog'); assert.equal(f.flow.page, secondMap);
    await f.flow.handle('nav:puzzle', f.flow.current);
    assert.equal(f.flow.page.id, 'puzzle'); assert.equal(f.flow.overlayCount, 0); assert.equal(secondMap.closed, true);
});
test('nested pause/settings/help overlays close back to the same retained instances', async () => {
    const f = fixture('puzzle'), page = f.flow.page;
    await f.flow.handle('open:pause', page); const pause = f.flow.current;
    await f.flow.handle('open:settings', pause); const settings = f.flow.current;
    await f.flow.handle('open:help-index', settings); const help = f.flow.current;
    assert.equal(f.flow.overlayCount, 3); assert.equal(page.closed, false); assert.equal(pause.visible, false);
    await f.flow.handle('back', help); assert.equal(f.flow.current, settings); assert.equal(settings.visible, true);
    await f.flow.handle('close', settings); assert.equal(f.flow.current, pause); assert.equal(pause.visible, true);
    await f.flow.handle('close', pause); assert.equal(f.flow.current, page); assert.equal(page.closes, 0);
});
test('back from puzzle opens confirmation and cancel keeps the current puzzle', async () => {
    const f = fixture('puzzle'), page = f.flow.page;
    await f.flow.handle('back', page); assert.equal(f.flow.current.id, 'confirmation');
    await f.flow.handle('close', f.flow.current); assert.equal(f.flow.current, page); assert.equal(page.closed, false);
    await f.flow.handle('back', page); await f.flow.handle('nav:mainline-map', f.flow.current);
    assert.equal(f.flow.page.id, 'mainline-map'); assert.equal(page.closes, 1); assert.equal(f.flow.overlayCount, 0);
});
test('failed page preparation preserves the page and its open overlay', async () => {
    const f = fixture('puzzle'), page = f.flow.page;
    await f.flow.openOverlay('settings'); const settings = f.flow.current;
    const delayed = deferred(); f.pending.set('garden', delayed);
    const request = f.flow.replacePage('garden'); delayed.reject(new Error('image unavailable'));
    assert.equal(await request, false); assert.equal(f.flow.page, page); assert.equal(f.flow.current, settings);
    assert.equal(page.closed, false); assert.equal(settings.visible, true); assert.equal(f.flow.navigating, false);
    assert.match(f.notices.at(-1), /重试/); assert.equal(f.entries.at(-1).closes, 1);
});
test('failed overlay preparation does not hide or replace the current overlay', async () => {
    const f = fixture('puzzle'); await f.flow.openOverlay('pause'); const pause = f.flow.current;
    const delayed = deferred(); f.pending.set('settings', delayed);
    const request = f.flow.openOverlay('settings'); delayed.reject(new Error('offline'));
    assert.equal(await request, false); assert.equal(f.flow.current, pause); assert.equal(pause.visible, true);
});
test('rapid navigation cancels prepared resources immediately and rejects a late page', async () => {
    const f = fixture(), slow = deferred(); f.pending.set('garden', slow);
    const first = f.flow.replacePage('garden'); assert.equal(f.flow.navigating, true);
    const second = f.flow.replacePage('puzzle'); assert.equal(f.cancels(), 1);
    await second; const puzzle = f.flow.page; slow.resolve();
    assert.equal(await first, false); assert.equal(f.flow.page, puzzle); assert.equal(f.entries[0].closes, 1);
    assert.equal(f.flow.navigating, false);
});
test('rapid overlay navigation preserves only the newest request', async () => {
    const f = fixture('puzzle'), slow = deferred(); f.pending.set('settings', slow);
    const first = f.flow.openOverlay('settings'); await f.flow.openOverlay('pause');
    slow.resolve(); assert.equal(await first, false); assert.equal(f.flow.current.id, 'pause'); assert.equal(f.flow.overlayCount, 1);
});
test('back cancels an unfinished overlay before it can reappear', async () => {
    const f = fixture(), slow = deferred(); f.pending.set('settings', slow);
    const request = f.flow.openOverlay('settings'); await f.flow.back(); slow.resolve(); await request;
    assert.equal(f.flow.current, f.initial); assert.equal(f.flow.overlayCount, 0); assert.equal(f.cancels(), 1);
});
test('actions from hidden or replaced views cannot navigate', async () => {
    const f = fixture('puzzle'), page = f.flow.page; await f.flow.openOverlay('pause');
    await f.flow.handle('nav:garden', page); assert.equal(f.flow.page, page);
    const pause = f.flow.current; f.flow.closeOverlay();
    await f.flow.handle('nav:garden', pause); assert.equal(f.flow.page, page);
});
test('duplicate active routes do not remount, and returning to the page closes overlays', async () => {
    const f = fixture('garden'), page = f.flow.page;
    await f.flow.replacePage('garden'); assert.equal(f.entries.length, 0);
    await f.flow.openOverlay('settings'); const settings = f.flow.current;
    await f.flow.openOverlay('settings'); assert.equal(f.entries.length, 1);
    await f.flow.replacePage('garden'); assert.equal(f.flow.page, page); assert.equal(settings.closes, 1);
});
test('guide uses the guide layer and restores an underlying dialog', async () => {
    const f = fixture('puzzle'); await f.flow.openOverlay('pause'); const pause = f.flow.current;
    await f.flow.openOverlay('guide-overlay', 'guide'); assert.equal(f.flow.current.layer, 'guide');
    f.flow.closeOverlay(); assert.equal(f.flow.current, pause); assert.equal(pause.visible, true);
});
test('demo result is explicitly gated and does not silently open during a pause', async () => {
    const release = fixture('puzzle', false); await release.flow.handle('demo:result'); assert.equal(release.flow.page.id, 'puzzle');
    const f = fixture('puzzle'); await f.flow.openOverlay('pause'); await f.flow.handle('demo:result'); assert.equal(f.flow.page.id, 'puzzle');
    f.flow.closeOverlay(); await f.flow.handle('demo:result'); assert.equal(f.flow.page.id, 'puzzle-result'); assert.match(f.notices.at(-1), /未发放奖励/);
});
test('unconnected actions have a visible preview explanation', async () => {
    const f = fixture(); await f.flow.handle('nav:shop'); await f.flow.handle('unknown'); assert.equal(f.notices.length, 2); assert.match(f.notices[0], /尚未接入/);
});
test('dispose cancels loading, closes every retained view once and never revives a page', async () => {
    const f = fixture('puzzle'); await f.flow.openOverlay('pause'); await f.flow.openOverlay('settings');
    const slow = deferred(); f.pending.set('garden', slow); const request = f.flow.replacePage('garden');
    f.flow.dispose(); f.flow.dispose(); slow.resolve(); await request;
    assert.equal(f.flow.page, null); assert.equal(f.flow.current, null); assert.equal(f.initial.closes, 1);
    assert.ok(f.entries.every(value => value.closes === 1));
});
test('development preview can force a new state and propagate binding/render failures', async () => {
    const f = fixture('garden'); await f.flow.replacePage('garden', undefined, true, true); assert.equal(f.entries.length, 1);
    const slow = deferred(); f.pending.set('broken', slow); const request = f.flow.replacePage('broken', undefined, true, true);
    slow.reject(new Error('missing binding')); await assert.rejects(request, /missing binding/); assert.equal(f.flow.page.id, 'garden');
});
test('exit and restart confirmations select their registered layouts and retain the underlying page', async () => {
    const f = fixture('puzzle'), page = f.flow.page;
    await f.flow.handle('open:confirmation-exit', page);
    assert.equal(f.flow.current.state, 'T37-01_退出本局确认');
    await f.flow.handle('close', f.flow.current);
    await f.flow.handle('open:confirmation-restart', page);
    assert.equal(f.flow.current.state, 'T38-01_重新开始确认');
    await f.flow.handle('confirm:restart', f.flow.current);
    assert.equal(f.flow.current, page); assert.equal(page.closes, 0); assert.match(f.notices.at(-1), /未重开真实对局或保存/);
    await f.flow.handle('open:confirmation-exit', page);
    await f.flow.handle('confirm:exit', f.flow.current);
    assert.equal(f.flow.page.id, 'mainline-map'); assert.equal(page.closes, 1);
});
test('confirmation actions outside the confirmation overlay cannot mutate navigation', async () => {
    const f = fixture('puzzle'); await f.flow.handle('confirm:exit', f.initial);
    assert.equal(f.flow.page, f.initial); assert.match(f.notices.at(-1), /先打开/);
});
test('help actions bind all three registered variants and variant changes are not ignored', async () => {
    const f = fixture('puzzle'); await f.flow.openOverlay('help-index'); const index = f.flow.current;
    for (const [action, state] of [
        ['help:puzzle', 'T40-02_图示帮助_拖放拼图'],
        ['help:endless', 'T40-03_图示帮助_三轴消除'],
        ['help:build', 'T40-04_图示帮助_五级建设'],
    ]) {
        await f.flow.handle(action, f.flow.current);
        assert.equal(f.flow.current.id, 'help-detail'); assert.equal(f.flow.current.state, state);
    }
    assert.equal(f.flow.overlayCount, 4);
    f.flow.closeOverlay(); f.flow.closeOverlay(); f.flow.closeOverlay();
    assert.equal(f.flow.current, index); assert.equal(index.closes, 0);
});
test('repeat overlay state is reused and hint/return-piece demos only explain the preview boundary', async () => {
    const f = fixture('puzzle');
    await f.flow.handle('open:confirmation-restart'); const confirmation = f.flow.current;
    await f.flow.handle('open:confirmation-restart'); assert.equal(f.flow.current, confirmation); assert.equal(f.flow.overlayCount, 1);
    f.flow.closeOverlay(); const count = f.entries.length;
    await f.flow.handle('demo:hint'); await f.flow.handle('demo:return-piece');
    assert.equal(f.flow.page, f.initial); assert.equal(f.entries.length, count);
    assert.match(f.notices.at(-2), /未扣除道具或保存/); assert.match(f.notices.at(-1), /未修改真实对局或保存/);
});
test('serialized Boot demo callback only delegates from a DEBUG puzzle route', () => {
    const bootPath = resolve(dirname(source), 'FoundationBoot.ts');
    const compiled = ts.transpileModule(readFileSync(bootPath, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true },
    }).outputText;
    for (const [debug, route, expected] of [[true, 'puzzle', true], [true, 'mainline-map', false], [true, 'pause', false], [false, 'puzzle', false]]) {
        const nativeModule = { exports: {} };
        const nativeRequire = name => name === 'cc' ? {
            _decorator: { ccclass: () => target => target, property: () => () => {} }, Component: class {},
        } : name === 'cc/env' ? { DEBUG: debug, EDITOR: false } : {};
        vm.runInThisContext(`(function(module,exports,require){${compiled}\n})`, { filename: bootPath })
            (nativeModule, nativeModule.exports, nativeRequire);
        const boot = new nativeModule.exports.FoundationBoot(), calls = [], notices = [];
        boot.flow = { current: { id: route }, handle: action => calls.push(action) };
        boot.notice = message => notices.push(message);
        boot.onDemoAction();
        assert.deepEqual(calls, expected ? ['demo:result'] : []);
        assert.equal(notices.length, expected ? 0 : 1);
    }
});

test('typed mainline selection carries the same source identity through preview, puzzle, pause and return', async () => {
    const f = fixture('mainline-map', true, n => n % 6 === 0
        ? `challenge-${String(n / 6).padStart(3, '0')}` : `classic-${String(n - Math.floor(n / 6)).padStart(3, '0')}`);
    await f.flow.handle('select:mainline', f.flow.page, { mainlineNumber: 96 });
    assert.equal(f.flow.current.id, 'puzzle-preview');
    assert.deepEqual(f.flow.context, { presentation: 'level', mainlineNumber: 96, levelId: 'challenge-016', mapPage: 12 });
    assert.equal(Object.isFrozen(f.flow.context), true);
    assert.deepEqual(f.flow.current.context, f.flow.context);
    await f.flow.handle('nav:puzzle', f.flow.current);
    const puzzle = f.flow.page;
    await f.flow.handle('open:pause', puzzle);
    assert.equal(f.flow.current.context.levelId, 'challenge-016');
    await f.flow.handle('back', f.flow.current);
    assert.equal(f.flow.page, puzzle);
    await f.flow.handle('open:confirmation-exit', puzzle);
    await f.flow.handle('confirm:exit', f.flow.current);
    assert.equal(f.flow.page.id, 'mainline-map');
    assert.equal(f.flow.context.mainlineNumber, 96);
    assert.equal(f.flow.context.mapPage, 12);
});

test('same puzzle route with a different selected question replaces the old puzzle', async () => {
    const f = fixture();
    await f.flow.handle('select:mainline', f.flow.current, { mainlineNumber: 1 });
    await f.flow.handle('nav:puzzle', f.flow.current);
    const first = f.flow.page;
    await f.flow.handle('select:mainline', f.flow.current, { mainlineNumber: 2 });
    await f.flow.handle('nav:puzzle', f.flow.current);
    assert.notEqual(f.flow.page, first);
    assert.equal(first.closes, 1);
    assert.equal(f.flow.page.context.mainlineNumber, 2);
    const second = f.flow.page;
    await f.flow.replacePage('puzzle');
    assert.equal(f.flow.page, second);
});

test('failed or cancelled selection leaves the last successfully displayed question selected', async () => {
    const f = fixture();
    await f.flow.handle('select:mainline', f.flow.current, { mainlineNumber: 8 });
    f.flow.closeOverlay();
    const original = f.flow.context, failed = deferred();
    f.pending.set('puzzle-preview', failed);
    const changing = f.flow.handle('select:mainline', f.flow.current, { mainlineNumber: 9 });
    failed.reject(new Error('missing piece artwork')); await changing;
    assert.equal(f.flow.context, original);
    const slow = deferred(); f.pending.set('puzzle-preview', slow);
    const cancelled = f.flow.handle('select:mainline', f.flow.current, { mainlineNumber: 10 });
    await f.flow.handle('nav:garden', f.flow.current);
    slow.resolve(); await cancelled;
    assert.equal(f.flow.context.levelId, original.levelId);
    assert.equal(f.flow.current.id, 'garden');
});

test('newer question selection wins over a late earlier preparation', async () => {
    const f = fixture(), slow = deferred();
    f.pending.set('puzzle-preview', slow);
    const first = f.flow.handle('select:mainline', f.flow.current, { mainlineNumber: 25 });
    f.pending.delete('puzzle-preview');
    await f.flow.handle('select:mainline', f.flow.current, { mainlineNumber: 96 });
    const selected = f.flow.current;
    slow.resolve(); await first;
    assert.equal(f.flow.current, selected);
    assert.equal(f.flow.context.mainlineNumber, 96);
    assert.equal(f.flow.context.mapPage, 12);
});

test('invalid numbers and reserve identities cannot enter normal mainline navigation', async () => {
    const f = fixture('mainline-map', true, n => { if (n === 7) throw new Error('catalog missing'); return `question-${n}`; });
    for (const number of [undefined, null, 0, -1, 1.5, 97, Infinity, NaN, '1', 'challenge-017', 7]) {
        await f.flow.handle('select:mainline', f.flow.current, { mainlineNumber: number });
        assert.equal(f.flow.current, f.initial);
        assert.equal(f.flow.context.mainlineNumber, 1);
    }
    assert.equal(f.entries.length, 0);
    assert.ok(f.notices.every(message => message.includes('编号无效')));
});

test('map paging spans all twelve pages and respects bounds without changing question identity', async () => {
    const f = fixture();
    await f.flow.handle('map:previous', f.flow.current);
    assert.equal(f.entries.length, 0);
    for (let page = 2; page <= 12; page++) {
        await f.flow.handle('map:next', f.flow.current);
        assert.equal(f.flow.current.id, 'mainline-map');
        assert.equal(f.flow.context.mapPage, page);
        assert.equal(f.flow.context.mainlineNumber, 1);
    }
    const final = f.flow.current;
    await f.flow.handle('map:next', final);
    assert.equal(f.flow.current, final);
    for (let page = 11; page >= 1; page--) {
        await f.flow.handle('map:previous', f.flow.current);
        assert.equal(f.flow.context.mapPage, page);
    }
    await f.flow.openOverlay('settings');
    await f.flow.handle('map:next', f.flow.current);
    assert.equal(f.flow.context.mapPage, 1);
});

test('fixture previews stay isolated until an explicit typed mainline selection', async () => {
    const f = fixture();
    const fixtureContext = { ...f.flow.context, presentation: 'fixture' };
    await f.flow.replacePage('mainline-map', undefined, true, true, fixtureContext);
    await f.flow.handle('nav:puzzle-preview', f.flow.current);
    await f.flow.handle('nav:puzzle', f.flow.current);
    assert.equal(f.flow.page.context.presentation, 'fixture');
    await f.flow.handle('select:mainline', f.flow.current, { mainlineNumber: 12 });
    await f.flow.handle('nav:puzzle', f.flow.current);
    assert.equal(f.flow.page.context.presentation, 'level');
    assert.equal(f.flow.page.context.mainlineNumber, 12);
});

test('same question preview is reused when the mount resolves a concrete art state', async () => {
    const f = fixture();
    await f.flow.handle('select:mainline', f.flow.current, { mainlineNumber: 81 });
    const preview = f.flow.current;
    preview.state = 'T04-01_限步关开局';
    await f.flow.handle('select:mainline', preview, { mainlineNumber: 81 });
    assert.equal(f.flow.current, preview);
    assert.equal(f.flow.overlayCount, 1);
});

test('cancelling another question preview restores the retained puzzle identity', async () => {
    const f = fixture();
    await f.flow.handle('select:mainline', f.flow.current, { mainlineNumber: 5 });
    await f.flow.handle('nav:puzzle', f.flow.current);
    const puzzle = f.flow.page;
    await f.flow.handle('select:mainline', puzzle, { mainlineNumber: 81 });
    assert.equal(f.flow.context.mainlineNumber, 81);
    await f.flow.handle('close', f.flow.current);
    assert.equal(f.flow.current, puzzle);
    assert.equal(f.flow.context.mainlineNumber, 5);
    await f.flow.handle('open:pause', puzzle);
    assert.equal(f.flow.current.context.mainlineNumber, 5);
});

test('reserve context leaves through normal map identity and cannot leak into subsequent product navigation', async () => {
    const f = fixture();
    const reserve = { ...f.flow.context, levelId: 'challenge-017', debugLevelId: 'challenge-017' };
    await f.flow.replacePage('puzzle', undefined, true, false, reserve);
    await f.flow.handle('open:pause', f.flow.current);
    assert.equal(f.flow.current.context.debugLevelId, 'challenge-017');
    await f.flow.handle('nav:mainline-map', f.flow.current);
    assert.equal(f.flow.context.debugLevelId, undefined);
    assert.equal(f.flow.context.mainlineNumber, 1);
    assert.equal(f.flow.context.levelId, '1');
    await f.flow.handle('nav:puzzle', f.flow.current);
    assert.equal(f.flow.page.context.debugLevelId, undefined);
});

test('public reserve preview is DEBUG only, rejects mapped/unknown questions, and never claims a mainline number', async () => {
    const bootPath = resolve(dirname(source), 'FoundationBoot.ts');
    const compiled = ts.transpileModule(readFileSync(bootPath, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true },
    }).outputText;
    for (const debug of [false, true]) {
        const nativeModule = { exports: {} }, calls = [];
        const nativeRequire = name => name === 'cc' ? {
            _decorator: { ccclass: () => target => target, property: () => () => {} }, Component: class {},
        } : name === 'cc/env' ? { DEBUG: debug, EDITOR: false } : {};
        vm.runInThisContext(`(function(module,exports,require){${compiled}\n})`, { filename: bootPath })(nativeModule, nativeModule.exports, nativeRequire);
        const boot = new nativeModule.exports.FoundationBoot();
        boot.catalog = { getById: id => {
            if (id === 'challenge-017') return { mainlineNumber: null };
            if (id === 'classic-001') return { mainlineNumber: 1 };
            throw new Error('Unknown level');
        } };
        boot.flow = { context: { presentation: 'level', mainlineNumber: 1, levelId: 'classic-001', mapPage: 1 },
            replacePage: async (...args) => { calls.push(args); boot.flow.context = args[4]; return true; } };
        if (!debug) {
            await assert.rejects(boot.previewLevel('challenge-017'), /unavailable/);
            assert.equal(calls.length, 0); continue;
        }
        await assert.rejects(boot.previewLevel('classic-001'), /normal mainline/);
        await assert.rejects(boot.previewLevel('missing'), /Unknown/);
        await boot.previewLevel('challenge-017');
        assert.equal(calls.length, 1);
        assert.equal(calls[0][0], 'puzzle');
        assert.equal(calls[0][4].debugLevelId, 'challenge-017');
        assert.equal(boot.selectedMainlineNumber, null);
        assert.equal(boot.selectedLevelId, 'challenge-017');
    }
});
