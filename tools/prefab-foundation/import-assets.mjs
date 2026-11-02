import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PROJECT, PROTOTYPE, SCRATCH, stableUuid, sha256, normalize, directory, imageMeta, assetJson, writeFile } from './io.mjs';

const SOURCE = path.join(PROTOTYPE, 'assets/block');
const MANIFEST = 'assets/resources/framework/config/source-art-manifest.json';
const PYTHON = process.env.HEXA_ASSET_PYTHON || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const TOOL = path.dirname(fileURLToPath(import.meta.url));
export function extractBlockArt(source) {
  const match = /^\s*window\.BlockArt\s*=\s*([\s\S]*?)\s*;?\s*$/.exec(source);
  if (!match) throw new Error('Expected standalone JSON assignment to window.BlockArt');
  const result = JSON.parse(match[1].replace(/;$/, ''));
  if (!result.configs || !Array.isArray(result.assets) || !result.designBoards) throw new Error('Incomplete BlockArt data');
  return result;
}
export function featureForPage(page) {
  if (page === '主图') return 'boot';
  if (page === '关卡选择' || page.startsWith('微信图片') || /^T(10|27)-/.test(page)) return 'mainline';
  if (page === '玩法' || page === '结算' || /^T0[1-9]-/.test(page)) return 'puzzle';
  if (page === '无尽模式' || /^T1[1-4]-/.test(page)) return 'endless';
  if (page === '建造界面' || /^T1[5-8]-/.test(page)) return 'garden';
  if (page === '好友界面' || /^T(19|2[0-6]|28)-/.test(page)) return 'collection';
  if (page === '每日任务' || /^T(29|3[0-5]|47)-/.test(page)) return 'daily';
  // Tutorial artwork may span multiple real pages; it is shared infrastructure.
  if (/^T51-/.test(page)) return 'common';
  return 'services';
}
function pngSize(bytes) {
  if (bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error('Expected PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
const imageRoot = bundle => bundle === 'boot' ? 'assets/resources/boot' : 'assets/bundles/' + bundle;

/** Locate imported images by identity, so artist renames never restore an old path. */
export function createImageAssetLocator(project = PROJECT) {
  const identities = new Map();
  function visit(folder) {
    if (!fs.existsSync(folder)) return;
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name.endsWith('.meta')) {
        const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (meta.importer !== 'image') continue;
        if (!identities.has(meta.uuid)) identities.set(meta.uuid, []);
        identities.get(meta.uuid).push(file.slice(0, -5));
      }
    }
  }
  visit(path.join(project, 'assets'));
  return ({ uuid, bundle, assetPath: proposed, expectedSha256 }) => {
    const matches = identities.get(uuid) || [];
    if (matches.length > 1) throw new Error(`Duplicate image UUID ${uuid}: ${matches.map(file => normalize(path.relative(project, file))).join(', ')}`);
    const file = matches[0] || path.resolve(project, proposed);
    const root = path.resolve(project, imageRoot(bundle)), relative = path.relative(root, file);
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
      throw new Error(`Image ${uuid} moved across bundle boundary: ${normalize(path.relative(project, file))}; expected ${imageRoot(bundle)}`);
    }
    if (path.extname(file).toLowerCase() !== '.png') throw new Error('Expected registered PNG image: ' + file);
    if (matches.length && !fs.existsSync(file)) throw new Error('Image meta has no matching PNG: ' + file);
    if (fs.existsSync(file)) {
      if (!expectedSha256 || sha256(fs.readFileSync(file)) !== expectedSha256) {
        throw new Error('Refusing to overwrite changed image: ' + file);
      }
      if (fs.existsSync(file + '.meta')) {
        const meta = JSON.parse(fs.readFileSync(file + '.meta', 'utf8'));
        if (meta.uuid !== uuid || meta.importer !== 'image') throw new Error('Refusing to replace existing image identity: ' + file);
      }
    }
    return { assetPath: normalize(path.relative(project, file)), resourcePath: normalize(relative.slice(0, -4)) + '/spriteFrame' };
  };
}
let current = null;
export function importAssets() {
  const previous = fs.existsSync(path.join(PROJECT, MANIFEST)) ? JSON.parse(fs.readFileSync(path.join(PROJECT, MANIFEST), 'utf8')) : null;
  const previousDerivatives = new Map((previous?.derivatives || []).map(record => [record.id, record]));
  const locateImage = createImageAssetLocator();
  const art = extractBlockArt(fs.readFileSync(path.join(PROTOTYPE, 'block-data.js'), 'utf8'));
  const sourceManifest = JSON.parse(fs.readFileSync(path.join(SOURCE, '素材清单.json'), 'utf8'));
  const byId = new Map(), byFile = new Map(), records = [], derivatives = [], pending = new Map(), derivativeMap = new Map();
  const layers = [...Object.values(art.configs), ...Object.values(art.designBoards)].flatMap(c => (c.layers || []).map(l => ({ layer: l, page: c.page })));
  const usage = new Map(), metadata = new Map();
  for (const { layer, page } of layers) {
    if (!layer.file) continue;
    if (!usage.has(layer.file)) usage.set(layer.file, new Set());
    usage.get(layer.file).add(page);
    if (!metadata.has(layer.file)) metadata.set(layer.file, []);
    if (layer.metadata) metadata.get(layer.file).push(layer.metadata);
  }
  const themeBundle = asset => {
    const theme = (metadata.get(asset.file) || []).map(x => x.theme).find(x => ['sunny', 'water', 'cloud'].includes(x));
    if (theme) return 'garden-' + theme;
    const boards = asset.design_boards ?? asset.editor_views ?? [];
    if (boards.length === 1 && /^A0[123]/.test(boards[0])) return 'garden-' + ({ A01: 'sunny', A02: 'water', A03: 'cloud' }[boards[0].slice(0, 3)]);
    if (boards.some(x => /^A04/.test(x))) return 'common';
    return null;
  };
  const bundles = ['common', 'mainline', 'puzzle', 'endless', 'garden', 'garden-sunny', 'garden-water', 'garden-cloud', 'collection', 'daily', 'services'];
  for (const bundle of bundles) directory('assets/bundles/' + bundle, { name: bundle, priority: bundle === 'common' ? 6 : 1 });
  for (const asset of sourceManifest.assets) {
    const source = path.resolve(SOURCE, asset.file);
    if (!source.startsWith(SOURCE + path.sep)) throw new Error('Source path escapes block assets');
    const bytes = fs.readFileSync(source), sourceSha256 = sha256(bytes), size = pngSize(bytes);
    if (sourceSha256 !== asset.sha256) throw new Error('Frozen asset hash changed: ' + asset.id);
    if (size.some((v, i) => v !== asset.size[i])) throw new Error('Asset dimensions changed: ' + asset.id);
    const pages = [...new Set([...(asset.runtime_pages ?? asset.pages ?? []), ...[...(usage.get(asset.file) || [])].filter(p => !/^A0/.test(p))])];
    const features = new Set(pages.map(featureForPage));
    const bundle = themeBundle(asset) || (features.size === 1 ? [...features][0] : 'common');
    const root = imageRoot(bundle);
    const filename = sha256(asset.file).slice(0, 20) + '.png';
    const uuid = stableUuid('source-image:' + asset.id);
    const { assetPath, resourcePath } = locateImage({ uuid, bundle, assetPath: `${root}/textures/${filename}`, expectedSha256: sourceSha256 });
    const ids = imageMeta(assetPath, size, { uuid });
    writeFile(path.join(PROJECT, assetPath), bytes);
    const record = {
      id: asset.id, stableId: asset.id, ...ids, assetPath, bundle,
      resourcePath, size, sourceSha256,
      sourceFile: normalize(path.relative(PROTOTYPE, source)), sourceAssetFile: asset.file,
      name: asset.name, pages, identities: asset.identities ?? [],
      designBoards: asset.design_boards ?? [], metadata: metadata.get(asset.file) ?? [],
      provenance: asset.provenance ?? null, rgbaSha256: asset.rgba_sha256,
    };
    records.push(record); byFile.set(asset.file, record);
    byId.set(asset.id, record);
  }
  // Historic aliases can point to several later exports. Canonical IDs and exact
  // source files remain authoritative; never let an alias replace a real ID.
  const canonicalIds = new Set(records.map(r => r.id)), ambiguousAliases = new Set();
  for (const asset of sourceManifest.assets) for (const id of [...(asset.identities || []), ...(asset.retired_duplicate_ids || [])]) {
    if (canonicalIds.has(id) || ambiguousAliases.has(id)) continue;
    const record = byFile.get(asset.file);
    if (byId.has(id) && byId.get(id).id !== record.id) { byId.delete(id); ambiguousAliases.add(id); }
    else byId.set(id, record);
  }
  const manifest = {
    schema: 'hexa.prefab-foundation.art.v1', revision: art.revision,
    sourceManifest: 'prototype/assets/block/素材清单.json', sourceManifestSha256: sha256(fs.readFileSync(path.join(SOURCE, '素材清单.json'))),
    rebuild: 'node Project/tools/prefab-foundation/generate.mjs',
    bundlePriorities: { resources: 8, common: 6, featureBundles: 1 },
    sourceCount: records.length, configCount: Object.keys(art.configs).length, designBoardCount: Object.keys(art.designBoards).length,
    records, derivatives, ambiguousHistoricalAliases: [...ambiguousAliases].sort(),
  };
  function persist() {
    assetJson(MANIFEST, manifest);
  }
  function ensureLayerImage(layer, defer = false) {
    const source = byFile.get(layer.file) || byId.get(layer.asset) || byId.get(layer.master_asset) || byId.get(layer.id);
    if (!source) throw new Error('Unregistered layer asset: ' + (layer.file || layer.asset || layer.id));
    const spec = layer.render_transform;
    if (!spec) return source;
    const resized = spec.resize || source.size;
    const crop = spec.alpha_crop;
    const identityCrop = !crop || (crop[0] === 0 && crop[1] === 0 && crop[2] === resized[0] && crop[3] === resized[1]);
    if (!spec.source_crop && !spec.nine_slice && !spec.rotation_degrees && (spec.alpha_multiplier === undefined || spec.alpha_multiplier === 1) && identityCrop) return source;
    const key = sha256(canonical({ source: source.sourceSha256, transform: spec }));
    if (derivativeMap.has(key)) return derivativeMap.get(key);
    const id = 'derivative_' + key.slice(0, 24);
    const root = imageRoot(source.bundle), uuid = stableUuid('derivative-image:' + key);
    const cached = previousDerivatives.get(id);
    const { assetPath, resourcePath } = locateImage({ uuid, bundle: source.bundle,
      assetPath: `${root}/textures/derived/${key.slice(0, 24)}.png`, expectedSha256: cached?.sha256 });
    const record = {
      id, stableId: id, uuid, spriteFrameUuid: uuid + '@f9941',
      textureUuid: uuid + '@6c48a', assetPath, bundle: source.bundle,
      resourcePath, sourceId: source.id, sourceSha256: source.sourceSha256,
      transform: spec, rebuild: 'node Project/tools/prefab-foundation/generate.mjs',
      generatorSha256: sha256(fs.readFileSync(path.join(TOOL, 'raster.py'))),
      size: crop ? [crop[2] - crop[0], crop[3] - crop[1]] : [...resized],
    };
    derivatives.push(record); derivativeMap.set(key, record);
    const sourcePath = path.join(PROTOTYPE, source.sourceFile), destination = path.join(PROJECT, assetPath);
    directory(path.dirname(destination));
    if (cached?.generatorSha256 === record.generatorSha256 && cached?.sourceSha256 === source.sourceSha256 && fs.existsSync(destination) && sha256(fs.readFileSync(destination)) === cached.sha256) {
      Object.assign(record, { size: cached.size, sha256: cached.sha256, rgbaSha256: cached.rgbaSha256, pillowVersion: cached.pillowVersion });
      imageMeta(assetPath, record.size, { uuid: record.uuid });
      if (!defer) persist();
      return record;
    }
    // Render outside assets first: rotation/crop may change the final dimensions.
    // Publish the complete first meta only after those dimensions are known,
    // then publish its PNG; future imports preserve the artist's import options.
    pending.set(id, { id, source: sourcePath, sourceSha256: source.sourceSha256,
      destination: path.join(SCRATCH, 'raster', id + '.png'), transform: spec });
    if (!defer) flush();
    return record;
  }
  function flush() {
    if (!pending.size) return;
    fs.mkdirSync(SCRATCH, { recursive: true });
    const report = path.join(SCRATCH, 'raster-report.json'), jobsPath = path.join(SCRATCH, 'raster-jobs.json');
    writeFile(jobsPath, JSON.stringify({ jobs: [...pending.values()], report }, null, 2));
    const result = spawnSync(PYTHON, [path.join(TOOL, 'raster.py'), jobsPath], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    if (result.status !== 0) throw new Error('Layer derivative renderer failed: ' + (result.error?.message || result.stderr));
    const reports = JSON.parse(fs.readFileSync(report, 'utf8'));
    for (const rendered of reports) {
      const record = derivatives.find(d => d.id === rendered.id);
      record.size = rendered.size; record.sha256 = rendered.sha256; record.rgbaSha256 = rendered.rgbaSha256; record.pillowVersion = rendered.pillowVersion;
      imageMeta(record.assetPath, record.size, { uuid: record.uuid });
      writeFile(path.join(PROJECT, record.assetPath), fs.readFileSync(pending.get(record.id).destination));
    }
    pending.clear(); persist();
  }
  function prepareDerivatives(configs = art.configs) {
    const values = Array.isArray(configs) ? configs : Object.values(configs);
    for (const config of values) for (const layer of config.layers || []) if ((layer.type === 'image' || (!layer.type && layer.asset)) && layer.file) ensureLayerImage(layer, true);
    flush(); persist(); return derivatives;
  }
  persist();
  current = { art, manifest, records, byId, byFile, derivatives, prepareDerivatives, ensureLayerImage, persist };
  return current;
}
export function ensureLayerImage(layer) { if (!current) throw new Error('Call importAssets first'); return current.ensureLayerImage(layer); }
export function prepareDerivatives(configs) { if (!current) throw new Error('Call importAssets first'); return current.prepareDerivatives(configs); }
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const imported = importAssets(); imported.prepareDerivatives();
  console.log(JSON.stringify({ sources: imported.records.length, derivatives: imported.derivatives.length, configs: Object.keys(imported.art.configs).length, designBoards: Object.keys(imported.art.designBoards).length }));
}
