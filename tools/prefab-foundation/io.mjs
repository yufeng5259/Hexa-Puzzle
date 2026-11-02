import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const WORKSPACE = path.dirname(PROJECT);
export const PROTOTYPE = path.join(WORKSPACE, 'prototype');
export const SCRATCH = path.join(WORKSPACE, 'tmp/prototype/prefab-foundation');
export const normalize = value => value.replaceAll('\\', '/');
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const stableUuid = seed => {
  const h = sha256('hexa-prefab-foundation-v1:' + seed);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export function resolveAsset(file) {
  const target = path.isAbsolute(file) ? path.resolve(file) : path.resolve(PROJECT, file);
  const relative = path.relative(path.join(PROJECT, 'assets'), target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Asset path escapes Project/assets: ' + file);
  return target;
}
export function writeFile(file, bytes) {
  const value = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file) || !fs.readFileSync(file).equals(value)) fs.writeFileSync(file, value);
}
export function writeOnceStableMeta(file, meta) {
  const target = file.endsWith('.meta') ? file : file + '.meta';
  if (fs.existsSync(target)) {
    const existing = JSON.parse(fs.readFileSync(target, 'utf8'));
    if (existing.uuid !== meta.uuid) throw new Error('Refusing to replace existing UUID: ' + target);
    // Creator and artists own import settings after first publication, including
    // every nested subMeta. Regeneration only verifies the stable identity.
    return existing.uuid;
  }
  writeFile(target, JSON.stringify(meta, null, 2) + '\n');
  return meta.uuid;
}
export function directory(file, bundle = null) {
  const target = resolveAsset(file);
  if (target === path.join(PROJECT, 'assets')) { fs.mkdirSync(target, { recursive: true }); return; }
  const parent = path.dirname(target);
  if (!fs.existsSync(parent)) directory(parent);
  const existing = fs.existsSync(target + '.meta') ? JSON.parse(fs.readFileSync(target + '.meta', 'utf8')) : null;
  const options = typeof bundle === 'string' ? { name: bundle, priority: bundle === 'common' ? 6 : 1 } : bundle;
  const userData = options ? { ...existing?.userData, isBundle: true, bundleConfigID: existing?.userData?.bundleConfigID ?? 'default', bundleName: options.name, priority: options.priority ?? 1 } : existing?.userData ?? {};
  writeOnceStableMeta(target, { ver: '1.2.0', importer: 'directory', imported: true, uuid: existing?.uuid ?? stableUuid(normalize(path.relative(PROJECT, target))), files: [], subMetas: {}, userData });
  // Bundle name / priority / flag are the explicit generator-managed fields.
  // Keep version, import state, custom platform settings and all other fields.
  if (existing && options && JSON.stringify(existing.userData) !== JSON.stringify(userData)) {
    writeFile(target + '.meta', JSON.stringify({ ...existing, userData }, null, 2) + '\n');
  }
  fs.mkdirSync(target, { recursive: true });
  return target;
}
export function assetJson(file, value) {
  const target = resolveAsset(file);
  directory(path.dirname(target));
  const assetPath = normalize(path.relative(PROJECT, target));
  const uuid = stableUuid(assetPath);
  writeOnceStableMeta(target, { ver: '2.0.1', importer: 'json', imported: true, uuid, files: ['.json'], subMetas: {}, userData: {} });
  writeFile(target, JSON.stringify(value, null, 2) + '\n');
  return { assetPath, uuid };
}
export function imageMeta(file, size, options = {}) {
  const target = resolveAsset(file), [width, height] = size;
  directory(path.dirname(target));
  const uuid = options.uuid ?? stableUuid('image:' + normalize(path.relative(PROJECT, target)));
  const textureUuid = uuid + '@6c48a', spriteFrameUuid = uuid + '@f9941';
  const sub = (importer, id, userData, ver) => ({ importer, uuid: uuid + '@' + id, displayName: path.basename(target, '.png'), id, name: importer === 'texture' ? 'texture' : 'spriteFrame', userData, ver, imported: true, files: ['.json'], subMetas: {} });
  writeOnceStableMeta(target, {
    ver: '1.0.27', importer: 'image', imported: true, uuid, files: ['.json', '.png'],
    subMetas: {
      '6c48a': sub('texture', '6c48a', { wrapModeS: 'clamp-to-edge', wrapModeT: 'clamp-to-edge', imageUuidOrDatabaseUri: uuid, isUuid: true, visible: false, minfilter: 'linear', magfilter: 'linear', mipfilter: 'none', anisotropy: 0 }, '1.0.22'),
      f9941: sub('sprite-frame', 'f9941', { trimThreshold: 1, rotated: false, offsetX: 0, offsetY: 0, trimX: 0, trimY: 0, width, height, rawWidth: width, rawHeight: height, borderTop: 0, borderBottom: 0, borderLeft: 0, borderRight: 0, packable: false, pixelsToUnit: 100, pivotX: .5, pivotY: .5, meshType: 0, vertices: { rawPosition: [-width / 2, -height / 2, 0, width / 2, -height / 2, 0, -width / 2, height / 2, 0, width / 2, height / 2, 0], indexes: [0, 1, 2, 2, 1, 3], uv: [0, height, width, height, 0, 0, width, 0], nuv: [0, 0, 1, 0, 0, 1, 1, 1], minPos: [-width / 2, -height / 2, 0], maxPos: [width / 2, height / 2, 0] }, isUuid: true, imageUuidOrDatabaseUri: textureUuid, atlasUuid: '', trimType: 'none' }, '1.0.12')
    }, userData: { type: 'sprite-frame', fixAlphaTransparencyArtifacts: true, hasAlpha: true, redirect: textureUuid }
  });
  return { uuid, textureUuid, spriteFrameUuid };
}
