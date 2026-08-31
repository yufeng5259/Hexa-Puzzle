import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const assets = path.join(root, 'assets');

function files(directory, extension, recursive = false) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return recursive ? files(fullPath, extension, true) : [];
    return !extension || entry.name.endsWith(extension) ? [fullPath] : [];
  });
}

const prefabs = files(path.join(assets, 'prefabs/legacy'), '.prefab');
const atlasManifest = JSON.parse(readFileSync(path.join(assets, 'resources/legacy/flax/atlas-manifest.json'), 'utf8'));
const frames = atlasManifest.frames.map((frame) => path.join(assets, 'resources/legacy/flax/frames', `${frame.id}.png`));
const tiles = files(path.join(assets, 'resources/gameplay/tiles'), '.png');
const audio = files(path.join(assets, 'resources/audio'), '.mp3');
assert.equal(prefabs.length, 15, 'Expected 15 generated Prefabs from the runtime visual baseline');
assert.equal(frames.length, 42, 'Expected 42 extracted Flax frames from the runtime visual baseline');
assert.equal(tiles.length, 18, 'Expected 18 gameplay tile textures');
assert.equal(audio.length, 2, 'Expected music and win audio clips');

for (const asset of [...prefabs, ...frames, ...tiles, ...audio]) {
  assert.ok(statSync(asset).size > 0, `Empty asset: ${path.relative(root, asset)}`);
  assert.ok(statSync(`${asset}.meta`).size > 0, `Missing meta: ${path.relative(root, asset)}.meta`);
}
for (const prefab of prefabs) {
  assert.ok(!readFileSync(prefab, 'utf8').includes('more_btn'), `Channel UI remains in ${path.relative(root, prefab)}`);
}

let levelCount = 0;
for (const mapId of ['classic', 'novice']) {
  const levels = JSON.parse(readFileSync(path.join(assets, `resources/data/levels/${mapId}.json`), 'utf8'));
  assert.equal(levels.length, 80, `${mapId} must contain 80 levels`);
  levelCount += levels.length;
}

const forbidden = /xxhd|mgframework|mgdelegate|com4j|moregames|shareto|sendanaly|channelsdk/i;
const scanRoots = ['assets/scripts', 'tools', 'build-templates'];
const textExtensions = new Set(['.ts', '.mjs', '.cjs', '.html', '.css', '.json', '.md']);
const violations = [];
for (const scanRoot of scanRoots) {
  for (const file of files(path.join(root, scanRoot), null, true)) {
    if (!textExtensions.has(path.extname(file)) || file.endsWith('final-asset-audit.mjs')) continue;
    const content = readFileSync(file, 'utf8');
    if (forbidden.test(content)) violations.push(path.relative(root, file));
  }
}
assert.deepEqual(violations, [], `Forbidden SDK references: ${violations.join(', ')}`);

console.log(`Final asset audit: ${prefabs.length} Prefabs, ${frames.length} Flax frames, ${tiles.length} tiles, ${audio.length} audio clips, ${levelCount} levels, and zero SDK references.`);
