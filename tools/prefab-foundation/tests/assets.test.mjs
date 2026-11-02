import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { SCRATCH, sha256, stableUuid, writeOnceStableMeta } from '../io.mjs';
import { createImageAssetLocator } from '../import-assets.mjs';

const require = createRequire(import.meta.url);
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const manifest = JSON.parse(fs.readFileSync(path.join(project, 'assets/resources/framework/config/source-art-manifest.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(project, 'assets/resources/framework/config/prefab-registry.json'), 'utf8'));
const candidates = [process.env.TYPESCRIPT_PATH,
    'G:/cocosCreator/Editor/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js',
    'D:/Program Files/Trae/resources/app/extensions/node_modules/typescript/lib/typescript.js'];
let ts;
try { ts = require('typescript'); } catch {
    const candidate = candidates.find(value => value && fs.existsSync(value));
    if (!candidate) throw new Error('Set TYPESCRIPT_PATH to an existing TypeScript installation.');
    ts = require(candidate);
}

function runtime(debug) {
    class Asset { refs = 0; addRef() { this.refs++; } decRef() { this.refs--; } }
    class SpriteFrame extends Asset {}
    class Prefab extends Asset {}
    const registered = new Map(), events = [];
    for (const image of [...manifest.records, ...manifest.derivatives]) {
        registered.set(`${image.bundle === 'boot' ? 'resources' : image.bundle}:${image.bundle === 'boot' ? 'boot/' : ''}${image.resourcePath}`, image.spriteFrameUuid);
    }
    for (const prefab of registry.prefabs) registered.set(`${prefab.bundle}:${prefab.resourcePath}`, prefab.uuid);
    const bundle = name => ({ load: (location, type, callback) => {
        events.push(`${name}:${location}`);
        const asset = new type(); asset._uuid = registered.get(`${name}:${location}`);
        callback(null, asset);
    } });
    const cc = { Asset, SpriteFrame, Prefab, resources: bundle('resources'), assetManager: {
        getBundle: () => null,
        loadBundle: (name, callback) => { events.push(`bundle:${name}`); callback(null, bundle(name)); },
    } };
    const cache = new Map();
    function load(filename) {
        filename = path.resolve(filename.endsWith('.ts') ? filename : filename + '.ts');
        if (cache.has(filename)) return cache.get(filename).exports;
        const module = { exports: {} }; cache.set(filename, module);
        const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
            target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
        } }).outputText;
        vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(
            id => id === 'cc' ? cc : id === 'cc/env' ? { DEBUG: debug } : load(path.resolve(path.dirname(filename), id)), module, module.exports);
        return module.exports;
    }
    return { GardenAssetStore: load(path.join(project, 'assets/scripts/features/garden/resources/GardenAssetStore.ts')).GardenAssetStore,
        SpriteFrame, Prefab, events };
}

for (const debug of [true, false]) test(`full 82-Prefab registry constructs and releases with DEBUG=${debug}`, async () => {
    assert.equal(registry.prefabs.length, 82);
    const { GardenAssetStore, Prefab, events } = runtime(debug);
    const store = new GardenAssetStore(manifest, registry), scope = store.createScope();
    const available = registry.prefabs.filter(record => debug || record.bundle !== 'debug');
    const assets = [];
    for (const record of available) assets.push(await scope.load('prefab:' + record.id, Prefab));
    assert.equal(store.activeEntryCount, debug ? 82 : 80);
    assert.equal(events[0], 'bundle:common');
    if (!debug) {
        for (const record of registry.prefabs.filter(record => record.bundle === 'debug')) {
            await assert.rejects(scope.load('prefab:' + record.id, Prefab), /not registered/);
        }
        assert(!events.some(event => event.startsWith('debug:') || event === 'bundle:debug'));
    }
    scope.release(); scope.release();
    assert.equal(store.activeEntryCount, 0);
    assert(assets.every(asset => asset.refs === 0));
});

test('boot art keeps its registered suffix and malformed derivative provenance is rejected', async () => {
    const { GardenAssetStore, SpriteFrame, events } = runtime(false);
    const store = new GardenAssetStore(manifest, registry), scope = store.createScope();
    const boot = manifest.records.find(record => record.bundle === 'boot');
    await scope.load(boot.id, SpriteFrame);
    assert(events.includes('resources:boot/' + boot.resourcePath));
    scope.release(); assert.equal(store.activeEntryCount, 0);
    const bad = JSON.parse(JSON.stringify(manifest)); bad.derivatives[0].sourceId = 'missing';
    assert.throws(() => new GardenAssetStore(bad, registry), /provenance/);
});

test('existing image meta keeps artist options and nested subMeta data byte for byte', () => {
    fs.mkdirSync(SCRATCH, { recursive: true });
    const file = path.join(SCRATCH, `meta-preservation-${process.pid}.png`), target = file + '.meta';
    const uuid = stableUuid('meta-preservation-test');
    const original = JSON.stringify({ uuid, ver: 'artist-version', userData: { custom: true },
        subMetas: { f9941: { uuid: uuid + '@f9941', userData: { trimType: 'custom', borderLeft: 17 } } } }, null, 4) + '\n';
    fs.writeFileSync(target, original);
    try {
        writeOnceStableMeta(file, { uuid, userData: {}, subMetas: {} });
        assert.equal(fs.readFileSync(target, 'utf8'), original);
        assert.throws(() => writeOnceStableMeta(file, { uuid: stableUuid('different') }), /replace existing UUID/);
        assert.equal(fs.readFileSync(target, 'utf8'), original);
    } finally { fs.rmSync(target); }
});

function imageFixture(t) {
    const base = path.resolve(project, '../tmp/prototype/framework-simplification');
    fs.mkdirSync(base, { recursive: true });
    const root = fs.mkdtempSync(path.join(base, 'image-identity-'));
    t.after(() => {
        assert.ok(path.resolve(root).startsWith(base + path.sep));
        fs.rmSync(root, { recursive: true, force: true });
    });
    const uuid = stableUuid('source-image:test-background');
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
    const original = 'assets/resources/boot/textures/original.png';
    const meta = JSON.stringify({ importer: 'image', uuid, userData: { artistSetting: true },
        subMetas: { f9941: { uuid: uuid + '@f9941', userData: { borderLeft: 17 } } } }, null, 4) + '\n';
    const put = (relative, content = bytes) => {
        const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content); fs.writeFileSync(file + '.meta', meta); return file;
    };
    const locate = () => createImageAssetLocator(root);
    const request = { uuid, bundle: 'boot', assetPath: original, expectedSha256: sha256(bytes) };
    return { root, uuid, bytes, original, meta, put, locate, request };
}

test('source image identity follows a real artist rename without restoring its original path', t => {
    const f = imageFixture(t), original = f.put(f.original);
    const renamed = path.join(path.dirname(original), 'bj.png');
    fs.renameSync(original, renamed); fs.renameSync(original + '.meta', renamed + '.meta');
    assert.deepEqual(f.locate()(f.request), {
        assetPath: 'assets/resources/boot/textures/bj.png', resourcePath: 'textures/bj/spriteFrame',
    });
    assert.equal(fs.existsSync(original), false); assert.equal(fs.existsSync(original + '.meta'), false);
    assert.deepEqual(fs.readFileSync(renamed), f.bytes);
    assert.equal(fs.readFileSync(renamed + '.meta', 'utf8'), f.meta);
});

test('renamed images can move within their own bundle and keep a loadable relative resource path', t => {
    const f = imageFixture(t);
    const moved = f.put('assets/bundles/mainline/portraits/bee.png');
    const result = f.locate()({ ...f.request, bundle: 'mainline', assetPath: 'assets/bundles/mainline/textures/original.png' });
    assert.deepEqual(result, { assetPath: 'assets/bundles/mainline/portraits/bee.png', resourcePath: 'portraits/bee/spriteFrame' });
    assert.equal(JSON.parse(fs.readFileSync(moved + '.meta', 'utf8')).uuid, f.uuid);
});

test('duplicate image identities are rejected even when both copies have identical bytes', t => {
    const f = imageFixture(t);
    const original = f.put(f.original), renamed = f.put('assets/resources/boot/textures/bj.png');
    assert.throws(() => f.locate()(f.request), /Duplicate image UUID/);
    assert.deepEqual(fs.readFileSync(original), f.bytes); assert.deepEqual(fs.readFileSync(renamed), f.bytes);
});

test('source content conflicts fail without overwriting the artist image or its import options', t => {
    const f = imageFixture(t), changed = Buffer.from('artist-modified-image');
    const file = f.put('assets/resources/boot/textures/bj.png', changed);
    assert.throws(() => f.locate()(f.request), /Refusing to overwrite changed image/);
    assert.deepEqual(fs.readFileSync(file), changed); assert.equal(fs.readFileSync(file + '.meta', 'utf8'), f.meta);
    assert.equal(fs.existsSync(path.join(f.root, f.original)), false);
});

test('cross-bundle image moves and orphaned image metas fail explicitly', t => {
    const moved = imageFixture(t), file = moved.put('assets/bundles/mainline/textures/bj.png');
    assert.throws(() => moved.locate()(moved.request), /moved across bundle boundary/);
    assert.deepEqual(fs.readFileSync(file), moved.bytes);
    const orphan = imageFixture(t), missing = orphan.put('assets/resources/boot/textures/bj.png');
    fs.rmSync(missing);
    assert.throws(() => orphan.locate()(orphan.request), /meta has no matching PNG/);
    assert.equal(fs.existsSync(path.join(orphan.root, orphan.original)), false);
});
