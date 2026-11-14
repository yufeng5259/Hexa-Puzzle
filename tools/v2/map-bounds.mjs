// Visible (opaque) extent of each map's buildings over all their levels, in map design
// coordinates (853x1844, y down). Home uses it to know how far the map may be enlarged
// before a building would slide under the HUD or the bottom bar. `picture` is the drawn
// background (the outpainted one where delivered) relative to the 853x1844 map centre,
// design units, y up.
// Run: node tools/v2/map-bounds.mjs --run   (writes assets/resources/config/map-bounds.json)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PROJECT } from './env.mjs';
import { extensions, stableUuid } from './import-art.mjs';
const sharp = createRequire(import.meta.url)('sharp');

const W = 853, H = 1844;
const OUT = 'assets/resources/config/map-bounds.json';

/** Opaque box of a picture as fractions of its size (alpha > 24). */
async function opaqueBox(file) {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return x1 < 0 ? null : { l: x0 / info.width, r: (x1 + 1) / info.width, t: y0 / info.height, b: (y1 + 1) / info.height };
}

/** Where an outpainted picture lies around its original drawn at w x h (design units, y up). */
export async function pictureRect(original, ext, w, h) {
    if (!ext) return { x: 0, y: 0, width: w, height: h };
    const meta = await sharp(path.join(PROJECT, 'docs/v2', original)).metadata(), kx = w / meta.width, ky = h / meta.height;
    const [ox, oy] = ext.offset, [ew, eh] = ext.size, r = v => Math.round(v * 100) / 100 + 0;
    return { x: r((ew / 2 - (ox + meta.width / 2)) * kx), y: r(-(eh / 2 - (oy + meta.height / 2)) * ky), width: r(ew * kx), height: r(eh * ky) };
}

export async function mapBounds() {
    const result = {}, ext = extensions();
    for (const map of ['M01', 'M02', 'M03']) {
        const layout = JSON.parse(fs.readFileSync(path.join(PROJECT, `docs/v2/地图/${map}_建筑布局.json`), 'utf8'));
        let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
        for (const p of layout.placements) {
            const size = p.render_width_fraction * W, [fx, fy] = [p.normalized_feet[0] * W, p.normalized_feet[1] * H];
            const [ax, ay] = p.anchor, x0 = fx - size * ax, y0 = fy - size * ay, flip = !!p.flip_x;
            for (const stage of p.stages) {
                const box = await opaqueBox(path.join(PROJECT, 'docs/v2', stage.file));
                if (!box) continue;
                const l = flip ? 1 - box.r : box.l, r = flip ? 1 - box.l : box.r;
                left = Math.min(left, x0 + l * size); right = Math.max(right, x0 + r * size);
                top = Math.min(top, y0 + box.t * size); bottom = Math.max(bottom, y0 + box.b * size);
            }
        }
        result[map] = { left: Math.floor(left), right: Math.ceil(right), top: Math.floor(top), bottom: Math.ceil(bottom),
            picture: await pictureRect(layout.background, ext.get(layout.background), W, H) };
    }
    const file = path.join(PROJECT, OUT), text = JSON.stringify({ schema: 'honey-town.map-bounds.v1', maps: result }, null, 1) + '\n';
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text);
    if (!fs.existsSync(file + '.meta')) fs.writeFileSync(file + '.meta', JSON.stringify({ ver: '2.0.1', importer: 'json', imported: true, uuid: stableUuid(OUT), files: ['.json'], subMetas: {}, userData: {} }, null, 2) + '\n');
    return result;
}

if (process.argv.includes('--run')) console.log(JSON.stringify(await mapBounds()));
