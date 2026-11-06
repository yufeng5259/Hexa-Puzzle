// Writes assets/bundles/garden/config/rotor-pivots.json: wheel center of every watermill rotor stage, as a fraction of its
// 512×512 stage canvas (x from left, y from top), so the rotor can spin around its axle (FX-06).
// Usage: node tools/art-import/rotor-pivots.mjs
import path from 'node:path';
import sharp from 'sharp';
import { PROJECT, jsonMeta, readJson, writeJson } from '../ui-gen/lib/io.mjs';

const map = readJson(path.join(PROJECT, 'tools/art-import/asset-map.json'));
const pivots = {};
for (const [source, entry] of Object.entries(map)) {
  const m = /buildings\/(\w+)\/watermill_(\d)_rotor\.png$/.exec(entry.path);
  if (!m) continue;
  const file = path.join(PROJECT, 'arts/游戏素材', source);
  const meta = await sharp(file).metadata();
  const { info } = await sharp(file).trim().toBuffer({ resolveWithObject: true });
  const x = (-info.trimOffsetLeft + info.width / 2) / meta.width;
  const y = (-info.trimOffsetTop + info.height / 2) / meta.height;
  (pivots[m[1]] ??= {})[m[2]] = [Number(x.toFixed(4)), Number(y.toFixed(4))];
}
const out = path.join(PROJECT, 'assets/bundles/garden/config/rotor-pivots.json');
writeJson(out, pivots);
jsonMeta(out);
console.log(JSON.stringify(pivots));
