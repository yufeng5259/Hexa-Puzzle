// Imports arts/游戏素材 PNGs into assets/ (downsampled to max display size) and writes asset-map.json.
// Usage: node tools/art-import/import.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ARTS, PROJECT, directory, imageMeta, normalize, readJson, writeJson } from '../ui-gen/lib/io.mjs';

const MAP_FILE = path.join(PROJECT, 'tools/art-import/asset-map.json');
const NINE_SLICE = readJson(path.join(PROJECT, 'tools/art-import/nine-slice.json'));
const COMMON = 'assets/bundles/common/textures';
/** Art needed before any bundle loads (Boot.scene spinner, LoadingPage) lives in the main package. */
const BOOT = 'assets/resources/textures';
const BOOT_PAGES = ['主图'];
const BOOT_FILES = ['PNG/补充/R-07_加载转圈.png'];

const THEMES = { 向阳花园: 'sunny', 清风水湾: 'water', 云上蜂谷: 'cloud' };
const BUILDINGS = { 树屋: 'treehouse', 花园: 'garden', 蜂蜜工坊: 'workshop', 小溪水车: 'watermill', 温室: 'greenhouse' };

/** Art swapped at runtime gets a logical English path in its feature bundle; everything else is static UI art. */
function dynamicTarget(file) {
  const name = path.basename(file, '.png');
  let m = /^(向阳花园|清风水湾|云上蜂谷)_(树屋|花园|蜂蜜工坊|小溪水车|温室)_(\d)级_(?:(无轮静态本体|独立水轮转子)_)?原生母件_/.exec(name);
  if (m) return `assets/bundles/garden/buildings/${THEMES[m[1]]}/${BUILDINGS[m[2]]}_${m[3]}${m[4] === '独立水轮转子' ? '_rotor' : ''}.png`;
  m = /^(?:R-01_)?(向阳花园|清风水湾|云上蜂谷)完整无建筑裸地形/.exec(name);
  if (m) return `assets/bundles/garden/terrain/${THEMES[m[1]]}.png`;
  m = /^R-14_照片_(向阳花园|清风水湾|云上蜂谷)_(树屋|花园|蜂蜜工坊|小溪水车|温室)$/.exec(name);
  if (m) return `assets/bundles/meta/photos/${THEMES[m[1]]}_${BUILDINGS[m[2]]}.png`;
  m = /^R-15_整园合影_(清风水湾|云上蜂谷)$/.exec(name);
  if (m) return `assets/bundles/meta/photos/${THEMES[m[1]]}_group.png`;
  m = /^R-17_剧情_(\d)$/.exec(name);
  if (m) return `assets/bundles/meta/story/chapter_${m[1]}.png`;
  m = /^R-24_小蜜_(.+)$/.exec(name);
  if (m) return `assets/bundles/meta/outfits/xiaomi_${{ 云朵胸针: 'cloud_brooch', 水湾丝带: 'water_ribbon', 花朵帽: 'flower_hat', 野餐帽: 'picnic_hat' }[m[1]]}.png`;
  return null;
}

/** Max displayed/native ratio per source file across every page config layer. */
function displayScales() {
  const root = path.join(ARTS, '页面配置');
  const files = [...fs.readdirSync(root), ...fs.readdirSync(path.join(root, '缺少')).map(f => '缺少/' + f)].filter(f => f.endsWith('.json'));
  const scales = new Map();
  for (const f of files) {
    const config = readJson(path.join(root, f));
    for (const layer of config.layers ?? []) {
      if (!layer.file || !layer.size || !layer.native_size) continue;
      const ratio = Math.max(layer.size[0] / layer.native_size[0], layer.size[1] / layer.native_size[1]);
      scales.set(layer.file, Math.max(scales.get(layer.file) ?? 0, ratio));
    }
  }
  return scales;
}

function bootFiles() {
  const files = new Set(BOOT_FILES);
  for (const name of BOOT_PAGES) for (const layer of readJson(path.join(ARTS, '页面配置', name + '.json')).layers) if (layer.file) files.add(layer.file);
  return files;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

const scales = displayScales();
const sources = new Set([...scales.keys()]);
// Board materials of the block.hex.v1 renderer (procedural layers reference them only by id).
for (const material of Object.values(readJson(path.join(ARTS, '运行组件/renderer-contract.json')).materials)) {
  sources.add(normalize(path.relative(ARTS, path.join(ARTS, '运行组件', material.file))));
}
// Supplementary art and every building/terrain stage, whether or not a page config shows it.
for (const file of walk(path.join(ARTS, 'PNG')).filter(f => f.endsWith('.png'))) {
  const relative = normalize(path.relative(ARTS, file));
  if (relative.startsWith('PNG/补充/') || dynamicTarget(relative)) sources.add(relative);
}

const boot = bootFiles();
const previous = fs.existsSync(MAP_FILE) ? readJson(MAP_FILE) : {};
const map = {};
let bytes = 0;
for (const source of [...sources].sort()) {
  const input = path.join(ARTS, source);
  const target = dynamicTarget(source) ?? `${boot.has(source) ? BOOT : COMMON}/${source.slice('PNG/'.length)}`;
  const old = previous[source]?.path;
  if (old && old !== target) for (const f of [old, old + '.meta']) fs.rmSync(path.join(PROJECT, f), { force: true });
  const meta = await sharp(input).metadata();
  const scale = Math.min(1, scales.get(source) ?? 1);
  const width = Math.max(1, Math.round(meta.width * scale)), height = Math.max(1, Math.round(meta.height * scale));
  const output = path.join(PROJECT, target);
  directory(path.dirname(output));
  const buffer = scale < 0.95 ? await sharp(input).resize(width, height).png().toBuffer() : fs.readFileSync(input);
  const final = scale < 0.95 ? [width, height] : [meta.width, meta.height];
  if (!fs.existsSync(output) || !fs.readFileSync(output).equals(buffer)) fs.writeFileSync(output, buffer);
  bytes += buffer.length;
  const nine = NINE_SLICE[source];
  const border = nine ? nine.map(v => Math.round(v * final[0] / meta.width)) : [0, 0, 0, 0];
  const uuid = imageMeta(output, final, border);
  map[source] = { path: target, uuid, size: final, native: [meta.width, meta.height] };
}

directory(path.join(PROJECT, 'assets/bundles/common'), 'common');
directory(path.join(PROJECT, 'assets/bundles/garden'), 'garden');
directory(path.join(PROJECT, 'assets/bundles/meta'), 'meta');
writeJson(MAP_FILE, map);
console.log(`imported ${Object.keys(map).length} images, ${(bytes / 1048576).toFixed(1)} MB`);
