// Copies delivered v2 art from docs/v2 into Cocos bundles and writes the resource registry.
// Idempotent: existing .meta UUIDs are kept, unchanged files are not rewritten.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PROJECT } from './env.mjs';

const DOCS = path.join(PROJECT, 'docs/v2');
const sha = v => createHash('sha256').update(v).digest('hex');
export const stableUuid = seed => { const h = sha('honey-town-v2:' + seed); return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const rel = file => path.relative(PROJECT, file).replaceAll('\\', '/');

function pngSize(bytes) {
    if (bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error('not a PNG');
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}
function write(file, bytes) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(Buffer.from(bytes))) fs.writeFileSync(file, bytes);
}
function dirMeta(dir, bundle) {
    for (let d = dir; d !== path.join(PROJECT, 'assets'); d = path.dirname(d)) {
        const meta = d + '.meta';
        if (fs.existsSync(meta)) continue;
        const isBundle = bundle && d === dir;
        write(meta, JSON.stringify({ ver: '1.2.0', importer: 'directory', imported: true, uuid: stableUuid(rel(d)), files: [], subMetas: {},
            userData: isBundle ? { isBundle: true, bundleConfigID: 'default', bundleName: bundle, priority: 1 } : {} }, null, 2) + '\n');
    }
    fs.mkdirSync(dir, { recursive: true });
}
function imageMeta(target, [width, height], slice = null) {
    const metaFile = target + '.meta';
    if (fs.existsSync(metaFile)) {
        // Keep the UUID; only the nine-slice border is owned by the art manifest.
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')), frame = meta.subMetas?.f9941?.userData;
        if (frame && slice) {
            const [l, t, r, b] = slice;
            if (frame.borderLeft !== l || frame.borderTop !== t || frame.borderRight !== r || frame.borderBottom !== b) {
                Object.assign(frame, { borderLeft: l, borderTop: t, borderRight: r, borderBottom: b });
                write(metaFile, JSON.stringify(meta, null, 2) + '\n');
            }
        }
        return meta.uuid;
    }
    const uuid = stableUuid('image:' + rel(target)), name = path.basename(target, '.png');
    const sub = (importer, id, userData, ver) => ({ importer, uuid: `${uuid}@${id}`, displayName: name, id, name: importer === 'texture' ? 'texture' : 'spriteFrame', userData, ver, imported: true, files: ['.json'], subMetas: {} });
    write(metaFile, JSON.stringify({
        ver: '1.0.27', importer: 'image', imported: true, uuid, files: ['.json', '.png'],
        subMetas: {
            '6c48a': sub('texture', '6c48a', { wrapModeS: 'clamp-to-edge', wrapModeT: 'clamp-to-edge', imageUuidOrDatabaseUri: uuid, isUuid: true, visible: false, minfilter: 'linear', magfilter: 'linear', mipfilter: 'none', anisotropy: 0 }, '1.0.22'),
            f9941: sub('sprite-frame', 'f9941', { trimThreshold: 1, rotated: false, offsetX: 0, offsetY: 0, trimX: 0, trimY: 0, width, height, rawWidth: width, rawHeight: height, borderTop: slice?.[1] ?? 0, borderBottom: slice?.[3] ?? 0, borderLeft: slice?.[0] ?? 0, borderRight: slice?.[2] ?? 0, packable: true, pixelsToUnit: 100, pivotX: 0.5, pivotY: 0.5, meshType: 0,
                vertices: { rawPosition: [-width / 2, -height / 2, 0, width / 2, -height / 2, 0, -width / 2, height / 2, 0, width / 2, height / 2, 0], indexes: [0, 1, 2, 2, 1, 3], uv: [0, height, width, height, 0, 0, width, 0], nuv: [0, 0, 1, 0, 0, 1, 1, 1], minPos: [-width / 2, -height / 2, 0], maxPos: [width / 2, height / 2, 0] },
                isUuid: true, imageUuidOrDatabaseUri: `${uuid}@6c48a`, atlasUuid: '', trimType: 'none' }, '1.0.12'),
        },
        userData: { type: 'sprite-frame', fixAlphaTransparencyArtifacts: true, hasAlpha: true, redirect: `${uuid}@6c48a` },
    }, null, 2) + '\n');
    return uuid;
}

/** Each entry: registry id, bundle, path inside the bundle (no extension), source file under docs/v2. */
export function plan() {
    const items = [];
    for (const map of ['M01', 'M02', 'M03']) {
        const layout = JSON.parse(fs.readFileSync(path.join(DOCS, `地图/${map}_建筑布局.json`), 'utf8'));
        items.push({ id: `map.${map}.background`, bundle: 'map', path: `backgrounds/${map}`, source: layout.background });
        for (const p of layout.placements) for (const s of p.stages)
            items.push({ id: `building.${p.building}.L${s.level}`, bundle: 'map', path: `buildings/${p.building}/${p.building}_L${s.level}`, source: s.file });
    }
    const hex = path.join(DOCS, '素材/六角块/母件');
    for (const file of fs.readdirSync(hex).filter(f => f.endsWith('.png')).sort()) {
        // "1_png_蜜金.png" -> hex.1_png ; "empty_well.png" -> hex.empty_well (keeps catalog textureName ids)
        const m = /^(\d+_png)_/.exec(file), key = m ? m[1] : file.slice(0, -4);
        items.push({ id: `hex.${key}`, bundle: 'puzzle', path: `textures/hex/${key}`, source: `素材/六角块/母件/${file}` });
    }
    // UI cut-outs: the registry id is the path layouts use in their "asset" field (relative to 素材/).
    const manifest = JSON.parse(fs.readFileSync(path.join(DOCS, '美术交付清单.json'), 'utf8')), seen = new Set();
    for (const asset of manifest.uiAssets) {
        for (const file of asset.states ? Object.values(asset.states) : asset.frames) {
            if (seen.has(file)) continue;
            seen.add(file);
            items.push({ id: file, bundle: 'ui', path: `textures/${path.basename(file, '.png')}`, source: `素材/${file}`, slice: asset.slice ?? null });
        }
    }
    return items;
}

export function importArt() {
    const registry = [];
    for (const item of plan()) {
        const bytes = fs.readFileSync(path.join(DOCS, item.source));
        const target = path.join(PROJECT, 'assets/bundles', item.bundle, item.path + '.png');
        dirMeta(path.join(PROJECT, 'assets/bundles', item.bundle), item.bundle);
        dirMeta(path.dirname(target), null);
        write(target, bytes);
        const uuid = imageMeta(target, pngSize(bytes), item.slice);
        registry.push({ id: item.id, bundle: item.bundle, path: item.path + '/spriteFrame', type: 'SpriteFrame', uuid: `${uuid}@f9941`, source: item.source });
    }
    // The 110-question catalog is kept as is; registering it lets the puzzle bundle load through ResourceLoader.
    const catalog = 'assets/bundles/puzzle/config/level-catalog.json';
    registry.push({ id: 'puzzle.catalog', bundle: 'puzzle', path: 'config/level-catalog', type: 'JsonAsset', uuid: JSON.parse(fs.readFileSync(path.join(PROJECT, catalog + '.meta'), 'utf8')).uuid, source: catalog });
    const out = path.join(PROJECT, 'assets/resources/config/resource-registry.json');
    write(out, JSON.stringify({ schema: 'honey-town.resources.v1', resources: registry }, null, 1) + '\n');
    if (!fs.existsSync(out + '.meta')) write(out + '.meta', JSON.stringify({ ver: '2.0.1', importer: 'json', imported: true, uuid: stableUuid(rel(out)), files: ['.json'], subMetas: {}, userData: {} }, null, 2) + '\n');
    return registry;
}

if (process.argv.includes('--run')) console.log(`imported ${importArt().length} images`);
