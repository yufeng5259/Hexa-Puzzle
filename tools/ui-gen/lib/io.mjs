import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const ARTS = path.join(PROJECT, 'arts/游戏素材');
export const normalize = value => value.replaceAll('\\', '/');
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const stableUuid = seed => {
  const h = sha256('hexa-rebuild-v1:' + seed);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export const rel = file => normalize(path.relative(PROJECT, file));

export function writeFile(file, bytes) {
  const value = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file) || !fs.readFileSync(file).equals(value)) fs.writeFileSync(file, value);
}

export const writeJson = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
export const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

/** An existing meta keeps its uuid (Creator or an earlier run created it); only managed fields are merged. Returns the uuid. */
function writeMeta(target, meta, merge) {
  const metaFile = target + '.meta';
  if (fs.existsSync(metaFile)) {
    const existing = readJson(metaFile);
    writeJson(metaFile, merge ? merge(existing) : existing);
    return existing.uuid;
  }
  writeJson(metaFile, meta);
  return meta.uuid;
}

/** Folder meta; `bundle` turns the folder into an Asset Bundle. Parents are created too. */
export function directory(dir, bundle = null) {
  const assets = path.join(PROJECT, 'assets');
  if (path.resolve(dir) === assets) return;
  const parent = path.dirname(dir);
  if (path.resolve(parent) !== assets) directory(parent);
  fs.mkdirSync(dir, { recursive: true });
  const userData = bundle ? { isBundle: true, bundleConfigID: 'default', bundleName: bundle, priority: bundle === 'common' ? 8 : 1 } : {};
  writeMeta(dir, { ver: '1.2.0', importer: 'directory', imported: true, uuid: stableUuid('dir:' + rel(dir)), files: [], subMetas: {}, userData },
    existing => bundle ? { ...existing, userData: { ...existing.userData, ...userData } } : existing);
}

export function scriptMeta(file) {
  const uuid = stableUuid('script:' + rel(file));
  return writeMeta(file, { ver: '4.0.24', importer: 'typescript', imported: true, uuid, files: [], subMetas: {}, userData: {} });
}

export function jsonMeta(file) {
  directory(path.dirname(file));
  writeMeta(file, { ver: '2.0.1', importer: 'json', imported: true, uuid: stableUuid('json:' + rel(file)), files: ['.json'], subMetas: {}, userData: {} });
  return readJson(file + '.meta').uuid;
}

export function prefabMeta(file) {
  directory(path.dirname(file));
  writeMeta(file, { ver: '1.1.50', importer: 'prefab', imported: true, uuid: stableUuid('prefab:' + rel(file)), files: ['.json'], subMetas: {}, userData: { syncNodeName: path.basename(file, '.prefab') } });
  return readJson(file + '.meta').uuid;
}

export function sceneMeta(file) {
  directory(path.dirname(file));
  writeMeta(file, { ver: '1.1.50', importer: 'scene', imported: true, uuid: stableUuid('scene:' + rel(file)), files: ['.json'], subMetas: {}, userData: {} });
  return readJson(file + '.meta').uuid;
}

/** Image meta with sprite-frame sub-asset `@f9941`; border = [top, bottom, left, right] in imported pixels. */
export function imageMeta(file, [width, height], border = [0, 0, 0, 0]) {
  directory(path.dirname(file));
  const uuid = stableUuid('image:' + rel(file));
  const name = path.basename(file, '.png');
  const [borderTop, borderBottom, borderLeft, borderRight] = border;
  const frame = { trimThreshold: 1, rotated: false, offsetX: 0, offsetY: 0, trimX: 0, trimY: 0, width, height, rawWidth: width, rawHeight: height,
    borderTop, borderBottom, borderLeft, borderRight, packable: true, pixelsToUnit: 100, pivotX: 0.5, pivotY: 0.5, meshType: 0,
    vertices: { rawPosition: [], indexes: [], uv: [], nuv: [], minPos: [], maxPos: [] }, isUuid: true, imageUuidOrDatabaseUri: uuid + '@6c48a', atlasUuid: '', trimType: 'none' };
  const meta = {
    ver: '1.0.27', importer: 'image', imported: true, uuid, files: ['.json', '.png'],
    subMetas: {
      '6c48a': { importer: 'texture', uuid: uuid + '@6c48a', displayName: name, id: '6c48a', name: 'texture', ver: '1.0.22', imported: true, files: ['.json'], subMetas: {},
        userData: { wrapModeS: 'clamp-to-edge', wrapModeT: 'clamp-to-edge', imageUuidOrDatabaseUri: uuid, isUuid: true, visible: false, minfilter: 'linear', magfilter: 'linear', mipfilter: 'none', anisotropy: 0 } },
      f9941: { importer: 'sprite-frame', uuid: uuid + '@f9941', displayName: name, id: 'f9941', name: 'spriteFrame', ver: '1.0.12', imported: true, files: ['.json'], subMetas: {}, userData: frame },
    },
    userData: { type: 'sprite-frame', fixAlphaTransparencyArtifacts: true, hasAlpha: true, redirect: uuid + '@6c48a' },
  };
  return writeMeta(file, meta, existing => {
    existing.subMetas.f9941.userData = { ...existing.subMetas.f9941.userData, borderTop, borderBottom, borderLeft, borderRight };
    return existing;
  });
}
