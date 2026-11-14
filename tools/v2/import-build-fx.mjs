// Migrates the coinbeach24 build effect (Creator 2.4: anim_build.prefab + build_anim.anim clip,
// a 2D particle and a Spine 3.6 skeleton) into v2 data that plays without Spine or 2.x formats.
// Reads the source project only. Outputs:
//   docs/v2/素材/UI/特效/build/fx_build_*.png  (atlas regions cut out, other textures copied; registered in the art manifest)
//   assets/bundles/ui/config/build-fx.json     (clip tracks, particle settings, skeleton setup and timelines)
// Run: node tools/v2/import-build-fx.mjs --run [sourceAssetsDir]
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PROJECT } from './env.mjs';
import { stableUuid } from './import-art.mjs';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('sharp');

const DEFAULT_SOURCE = 'E:/linewell/projects/cs-game-test/coinbeach24/assets';
const OUT_ART = 'docs/v2/素材/UI/特效/build';
const OUT_DATA = 'assets/bundles/ui/config/build-fx.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const asset = name => `UI/特效/build/${name}.png`;

function parseAtlas(text) {
    const lines = text.split(/\r?\n/), regions = {};
    let current = null;
    for (const line of lines.slice(1)) {
        if (!line.trim()) continue;
        if (!line.startsWith(' ') && !line.includes(':')) { current = regions[line.trim()] = {}; continue; }
        const [key, value] = line.trim().split(':').map(v => v.trim());
        if (current) current[key] = key === 'rotate' ? value === 'true' : value.split(',').map(Number);
    }
    return regions;
}

/** Spine region: size is the unrotated size; rotated regions occupy height×width in the page, turned 90° clockwise. */
async function cutRegion(page, region) {
    const [x, y] = region.xy, [w, h] = region.size;
    const box = region.rotate ? { left: x, top: y, width: h, height: w } : { left: x, top: y, width: w, height: h };
    let img = sharp(page).extract(box);
    if (region.rotate) img = sharp(await img.png().toBuffer()).rotate(-90);
    return img.png().toBuffer();
}

const vec = v => Array.isArray(v) ? v : [v.x, v.y];
function clipTracks(paths) {
    const tracks = {};
    for (const [name, { props = {} }] of Object.entries(paths)) {
        tracks[name] = {};
        for (const [prop, keys] of Object.entries(props)) {
            tracks[name][prop] = keys.map(k => [k.frame, ...(typeof k.value === 'object' && k.value !== null ? vec(k.value) : [k.value === true ? 1 : k.value === false ? 0 : k.value])]);
        }
    }
    return tracks;
}

export async function importBuildFx(source = DEFAULT_SOURCE) {
    const dir = path.join(source, 'LiveData/anim/build');
    const prefab = JSON.parse(fs.readFileSync(path.join(dir, 'anim_build.prefab'), 'utf8'));
    const clip = JSON.parse(fs.readFileSync(path.join(dir, 'build_anim.anim'), 'utf8'));
    const skeleton = JSON.parse(fs.readFileSync(path.join(dir, 'building.json'), 'utf8'));
    const regions = parseAtlas(fs.readFileSync(path.join(dir, 'building.atlas'), 'utf8'));
    const node = name => prefab.find(o => o.__type__ === 'cc.Node' && o._name === name);
    const comp = type => prefab.find(o => o.__type__ === type);

    // Art: atlas regions + the three loose textures the prefab references.
    const files = [
        { name: 'fx_build_hammer', from: 'LiveData/anim/build/building.png#hammer', bytes: await cutRegion(path.join(dir, 'building.png'), regions.hammer) },
        { name: 'fx_build_saw', from: 'LiveData/anim/build/building.png#saw', bytes: await cutRegion(path.join(dir, 'building.png'), regions.saw) },
        { name: 'fx_build_smoke', from: 'LiveData/anim/build/building.png#smoke particle', bytes: await cutRegion(path.join(dir, 'building.png'), regions['smoke particle']) },
        { name: 'fx_build_puff', from: 'LiveData/anim/build/building-yan.png', bytes: fs.readFileSync(path.join(dir, 'building-yan.png')) },
        { name: 'fx_build_ray', from: 'Texture/effect/light/PopUpRay1.png', bytes: fs.readFileSync(path.join(source, 'Texture/effect/light/PopUpRay1.png')) },
        { name: 'fx_build_spark', from: 'LiveData/particle/smoke/yan2.png', bytes: fs.readFileSync(path.join(source, 'LiveData/particle/smoke/yan2.png')) },
    ];
    // Pictures the art team has redrawn (manifest batch no longer 'reuse-build-fx') are never overwritten;
    // only the reused originals are (re)copied. The timelines below are always refreshed.
    const manifest = JSON.parse(fs.readFileSync(path.join(PROJECT, 'docs/v2/美术交付清单.json'), 'utf8'));
    const redrawn = new Set(manifest.uiAssets.filter(a => a.id.startsWith('fx_build_') && a.batch && a.batch !== 'reuse-build-fx').map(a => a.id));
    const reused = files.filter(f => !redrawn.has(f.name));
    fs.mkdirSync(path.join(PROJECT, OUT_ART), { recursive: true });
    for (const f of reused) fs.writeFileSync(path.join(PROJECT, OUT_ART, f.name + '.png'), f.bytes);
    registerArt(reused, source);

    const size = n => [node(n)._contentSize.width, node(n)._contentSize.height];
    const spark = comp('cc.ParticleSystem'), sk = comp('sp.Skeleton'), skNode = node('building');
    const color = c => [c.r, c.g, c.b, c.a];
    const skin = skeleton.skins.default;
    const data = {
        schema: 'honey-town.fx.v1',
        source: 'coinbeach24 anim_build.prefab (Creator 2.4.15), migrated by tools/v2/import-build-fx.mjs',
        /** The prefab destroys itself after this many seconds (TimeDestroy.t). */
        duration: prefab.find(o => typeof o.t === 'number' && o.node)?.t ?? 2,
        sprites: Object.fromEntries(['PopUpRay1', 'building-yan', 'building-yan2', 'building-yan3', 'building-yan4'].map(n => [n, {
            asset: asset(n === 'PopUpRay1' ? 'fx_build_ray' : 'fx_build_puff'), size: size(n),
            opacity: node(n)._opacity, additive: false,
        }])),
        clip: { tracks: clipTracks(clip.curveData.paths), length: clip._duration, speed: clip.speed ?? 1 },
        particle: {
            node: 'spark', asset: asset('fx_build_spark'),
            ...Object.fromEntries(['totalParticles', 'duration', 'emissionRate', 'life', 'lifeVar', 'angle', 'angleVar', 'startSize', 'startSizeVar', 'endSize', 'endSizeVar',
                'startSpin', 'startSpinVar', 'endSpin', 'endSpinVar', 'positionType', 'emitterMode', 'speed', 'speedVar', 'tangentialAccel', 'tangentialAccelVar',
                'radialAccel', 'radialAccelVar', 'rotationIsDir', 'startRadius', 'startRadiusVar', 'endRadius', 'endRadiusVar', 'rotatePerS', 'rotatePerSVar'].map(k => [k, spark[k]])),
            startColor: color(spark._startColor), startColorVar: color(spark._startColorVar), endColor: color(spark._endColor), endColorVar: color(spark._endColorVar),
            sourcePos: vec(spark.sourcePos), posVar: vec(spark.posVar), gravity: vec(spark.gravity),
        },
        skeleton: {
            offset: skNode._trs.array.slice(0, 2), scale: skNode._trs.array.slice(7, 9), timeScale: sk.timeScale,
            bones: skeleton.bones.map(b => ({ name: b.name, parent: b.parent ?? null, x: b.x ?? 0, y: b.y ?? 0, rotation: b.rotation ?? 0, scaleX: b.scaleX ?? 1, scaleY: b.scaleY ?? 1 })),
            slots: skeleton.slots.map(s => ({ name: s.name, bone: s.bone, attachment: s.attachment ?? null, color: s.color ?? 'ffffffff' })),
            attachments: Object.fromEntries(Object.entries(skin).map(([slot, map]) => [slot, Object.fromEntries(Object.entries(map).map(([name, a]) => [name, {
                asset: asset({ hammer: 'fx_build_hammer', saw: 'fx_build_saw' }[name] ?? 'fx_build_smoke'),
                x: a.x ?? 0, y: a.y ?? 0, rotation: a.rotation ?? 0, scaleX: a.scaleX ?? 1, scaleY: a.scaleY ?? 1, width: a.width, height: a.height,
            }]))])),
            animation: skeleton.animations[sk.defaultAnimation ?? 'animation'],
        },
    };
    const out = path.join(PROJECT, OUT_DATA);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(data, null, 1) + '\n');
    for (const [rel, importer] of [[path.dirname(OUT_DATA), 'directory'], [OUT_DATA, 'json']]) {
        const meta = path.join(PROJECT, rel + '.meta');
        if (!fs.existsSync(meta)) fs.writeFileSync(meta, JSON.stringify(importer === 'json'
            ? { ver: '2.0.1', importer, imported: true, uuid: stableUuid(rel), files: ['.json'], subMetas: {}, userData: {} }
            : { ver: '1.2.0', importer, imported: true, uuid: stableUuid(rel), files: [], subMetas: {}, userData: {} }, null, 2) + '\n');
    }
    return files.map(f => f.name);
}

/** Registers the reused textures in the art manifest (AGENTS.md: reuse is allowed when its source is recorded). */
function registerArt(files, source) {
    const file = path.join(PROJECT, 'docs/v2/美术交付清单.json'), text = fs.readFileSync(file, 'utf8'), manifest = JSON.parse(text);
    manifest.uiAssets = manifest.uiAssets.filter(a => a.batch !== 'reuse-build-fx'); // re-runs replace only this batch
    for (const f of files) {
        const meta = { width: f.bytes.readUInt32BE(16), height: f.bytes.readUInt32BE(20) };
        manifest.uiAssets.push({ id: f.name, name: `建造特效（coinbeach24 复用）${f.name.slice(9)}`, states: { default: asset(f.name) }, size: [meta.width, meta.height],
            scale: 1, slice: null, anchor: [0.5, 0.5], source: '复用 coinbeach24 建造特效，待按 v2 风格重绘', reuseFrom: `coinbeach24/assets/${f.from}`,
            priority: 'P2', batch: 'reuse-build-fx', sha256: { default: sha(f.bytes) } });
    }
    // Keep the file's own line endings (it is written with CRLF on the art machine).
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    fs.writeFileSync(file, (JSON.stringify(manifest, null, 2) + '\n').replace(/\n/g, eol));
}

if (process.argv.includes('--run')) console.log('build fx:', (await importBuildFx(process.argv[process.argv.indexOf('--run') + 1] ?? DEFAULT_SOURCE)).join(' '));
