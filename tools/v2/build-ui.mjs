// Builds one Prefab per docs/v2/素材/布局/Sxx.json into assets/bundles/ui/prefabs.
// Run after import-art.mjs. Sprites/labels keep the artist's element ids; data-driven
// parts (map + buildings, puzzle board/tray cells) become empty mount nodes that
// feature code fills at runtime. Prefab/meta UUIDs are stable across runs.
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT } from './env.mjs';
import { stableUuid } from './import-art.mjs';
import { Builder, color, external, ref, scriptType } from './prefab-builder.mjs';

const LAYOUTS = path.join(PROJECT, 'docs/v2/素材/布局');
const OUT = 'assets/bundles/ui/prefabs';
const DESIGN = [853, 1844];
const VIEW = scriptType('assets/scripts/features/ui/LayoutView.ts');

/** Clickable element ids per page; they call LayoutView.onAction(id). */
const BUTTONS = {
    S02: ['hud_btn_square_purple', 'hud_energy', 'hud_level_badge', 'map_name', 'signin_entry', 'task_entry', 'endless_entry', 'home_play_btn', 'home_btn_home', 'home_btn_build'],
    S03: ['hud_btn_square_purple', 'hud_energy', 'home_btn_home', 'icon_gift'],
    S04: ['hud_btn_square_blue', 'hud_btn_square_blue_2', 'undo_button', 'replay_button', 'hint_button'],
    S05: ['hud_btn_square_blue', 'hud_btn_square_blue_2', 'undo_button', 'replay_button', 'hint_button'],
    S06: ['btn_green', 'btn_grey'], S07: ['retry', 'home'], S08: ['btn_close_dialog', 'save_home', 'continue', 'abandon'],
    S09: ['btn_close_dialog', 'restart', 'continue'], S10: ['btn_close_dialog', 'go_endless', 'return'],
    S11: ['btn_close_dialog', 'play', 'later'], S12: ['btn_close_dialog', 'continue'], S13: ['confirm'],
    S15: ['claim_next', 'stay'], S16: ['hud_btn_square_blue', 'm01_card', 'm02_card', 'm03_card', 'enter', 'return_home'],
    S17: ['btn_close', 'btn_green'], S18: ['btn_close', 'task_1_action', 'task_2_action', 'task_3_action', 'completion_claim'],
    S19: ['home_button', 'back_button', 'help_button', 'stage_0_status', 'stage_1_claim', 'start_challenge'],
    S20: ['hud_btn_square_blue', 'settings_button'], S21: ['retry', 'return_event'], S22: ['btn_close_dialog', 'save_leave', 'continue', 'end_game'],
    S23: ['btn_close_dialog', 'music_toggle_track', 'sound_toggle_track', 'vibration_toggle_track', 'done'], S24: ['retry_save', 'continue'], S25: ['claim_continue'],
};
const MOUNTS = [
    { name: 'MapMount', test: e => e.buildingId !== undefined || e.id === 'map_background', fullScreen: true },
    { name: 'BoardMount', test: e => /^board_cell_\d+$/.test(e.id) },
    { name: 'TrayMount', test: e => /^tray_\d+_cell_\d+$/.test(e.id) },
];

const registry = JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/resources/config/resource-registry.json'), 'utf8')).resources;
const frameBySource = new Map(registry.map(r => [r.source.replace(/^素材\//, ''), r.uuid]));
const hex = value => { const v = value.replace('#', ''); return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16)); };

function box(layout, rect) {
    const sx = DESIGN[0] / layout.size[0], sy = DESIGN[1] / layout.size[1];
    const [x, y, w, h] = [rect[0] * sx, rect[1] * sy, rect[2] * sx, rect[3] * sy];
    return { x: x + w / 2 - DESIGN[0] / 2, y: DESIGN[1] / 2 - (y + h / 2), width: w, height: h };
}
function frame(asset) {
    const uuid = frameBySource.get(asset.replace(/^\.\.\//, ''));
    if (!uuid) throw new Error(`asset not imported: ${asset}`);
    return uuid;
}
function addSprite(b, node, e) {
    const id = b.sprite(node, frame(e.asset), e.opacity ?? 1);
    const sprite = b.objects[id];
    if (e.slice) sprite._type = 1;
    if (e.tint) sprite._color = color(hex(e.tint));
    if (e.flipX) b.objects[node]._lscale.x = -1;
}
function addLabel(b, node, e) {
    const id = b.label(node, e.text ?? '', { font_size: e.fontSize, color_rgb: e.color ? hex(e.color) : [255, 255, 255], align: e.align ?? 'center', weight: e.bold ? 'bold' : 'normal',
        stroke_width: e.outlineWidth ?? 0, stroke_color: e.outlineColor ? hex(e.outlineColor) : [0, 0, 0] });
    Object.assign(b.objects[id], { _verticalAlign: { top: 0, center: 1, bottom: 2 }[e.verticalAlign ?? 'center'], _overflow: 2 });
    return id;
}

function buildPage(file) {
    const layout = JSON.parse(fs.readFileSync(path.join(LAYOUTS, file), 'utf8')), page = layout.page;
    const b = new Builder(page, DESIGN), buttons = new Set([...(BUTTONS[page] ?? []), ...layout.elements.filter(e => e.action).map(e => e.id)]);
    const nodes = [], nodeIds = [], labels = [], labelIds = [], mounts = new Map();
    for (const e of layout.elements) {
        const mount = MOUNTS.find(m => m.test(e));
        if (mount) {
            // Mount occupies the slot of its first element and the bounding box of all of them.
            if (!mounts.has(mount.name)) {
                const id = b.node(mount.name, b.root, { width: 10, height: 10 });
                mounts.set(mount.name, { id, rects: [] }); nodes.push(ref(id)); nodeIds.push(mount.name);
            }
            if (e.rect) mounts.get(mount.name).rects.push(e.rect);
            continue;
        }
        if (!e.rect) throw new Error(`${page}/${e.id}: element without rect`);
        const node = b.node(e.id, b.root, box(layout, e.rect));
        nodes.push(ref(node)); nodeIds.push(e.id);
        if (e.type === 'label') { labels.push(ref(addLabel(b, node, e))); labelIds.push(e.id); }
        else addSprite(b, node, e);
        if (buttons.has(e.id)) { b.button(node, b.root, 'LayoutView', 'onAction', e.id); buttons.delete(e.id); }
    }
    for (const [name, { id, rects }] of mounts) {
        const full = MOUNTS.find(m => m.name === name).fullScreen;
        const left = Math.min(...rects.map(r => r[0])), top = Math.min(...rects.map(r => r[1]));
        const right = Math.max(...rects.map(r => r[0] + r[2])), bottom = Math.max(...rects.map(r => r[1] + r[3]));
        const rect = full || !rects.length ? [0, 0, layout.size[0], layout.size[1]] : [left, top, right - left, bottom - top];
        const target = b.objects[id], at = box(layout, rect);
        target._lpos.x = at.x; target._lpos.y = at.y;
        b.objects[target._components[0].__id__]._contentSize = { __type__: 'cc.Size', width: at.width, height: at.height };
    }
    if (buttons.size) throw new Error(`${page}: button ids not in layout: ${[...buttons]}`);
    b.component(b.root, VIEW, { pageId: page, nodes, nodeIds, labels, labelIds });
    return { name: page, objects: b.finish() };
}

/** Per-building upgrade anchor (dots + cost) taken from S03's B01 group, positioned relative to the building feet. */
function buildAnchor() {
    const layout = JSON.parse(fs.readFileSync(path.join(LAYOUTS, 'S03.json'), 'utf8'));
    const group = layout.elements.filter(e => e.anchor === 'building_feet' && e.buildingId === 'B01');
    const b = new Builder('BuildAnchor', [200, 120]), nodes = [], nodeIds = [], labels = [], labelIds = [];
    for (const e of group) {
        const id = e.id.replace(/^B01_/, ''), [w, h] = e.size ?? [120, 40];
        const node = b.node(id, b.root, { x: e.offset[0], y: -e.offset[1], width: w, height: h });
        nodes.push(ref(node)); nodeIds.push(id);
        if (e.type === 'label') { labels.push(ref(addLabel(b, node, e))); labelIds.push(id); }
        else addSprite(b, node, e);
        if (id === 'cost') b.button(node, b.root, 'LayoutView', 'onAction', 'upgrade');
    }
    b.component(b.root, VIEW, { pageId: 'BuildAnchor', nodes, nodeIds, labels, labelIds });
    return { name: 'BuildAnchor', objects: b.finish() };
}

function writePrefab({ name, objects }) {
    const file = path.join(PROJECT, OUT, name + '.prefab');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const text = JSON.stringify(objects, null, 2) + '\n';
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text);
    if (!fs.existsSync(file + '.meta')) fs.writeFileSync(file + '.meta', JSON.stringify({ ver: '1.1.50', importer: 'prefab', imported: true,
        uuid: stableUuid(`${OUT}/${name}.prefab`), files: ['.json'], subMetas: {}, userData: { syncNodeName: name } }, null, 2) + '\n');
}
function dirMeta(rel) {
    const meta = path.join(PROJECT, rel + '.meta');
    if (!fs.existsSync(meta)) fs.writeFileSync(meta, JSON.stringify({ ver: '1.2.0', importer: 'directory', imported: true, uuid: stableUuid(rel), files: [], subMetas: {}, userData: {} }, null, 2) + '\n');
}

export function buildUi() {
    const pages = fs.readdirSync(LAYOUTS).filter(f => /^S\d\d\.json$/.test(f)).sort().map(buildPage);
    const all = [...pages, buildAnchor()];
    fs.mkdirSync(path.join(PROJECT, OUT), { recursive: true }); dirMeta(OUT);
    all.forEach(writePrefab);
    // Runtime registry: ResourceLoader verifies each prefab by UUID before instantiating it.
    const registry = all.map(p => ({ id: `prefab.${p.name}`, bundle: 'ui', path: `prefabs/${p.name}`, type: 'Prefab', uuid: stableUuid(`${OUT}/${p.name}.prefab`) }));
    const out = path.join(PROJECT, 'assets/resources/config/ui-prefabs.json'), text = JSON.stringify({ schema: 'honey-town.prefabs.v1', resources: registry }, null, 1) + '\n';
    if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== text) fs.writeFileSync(out, text);
    if (!fs.existsSync(out + '.meta')) fs.writeFileSync(out + '.meta', JSON.stringify({ ver: '2.0.1', importer: 'json', imported: true, uuid: stableUuid('assets/resources/config/ui-prefabs.json'), files: ['.json'], subMetas: {}, userData: {} }, null, 2) + '\n');
    return all.map(p => p.name);
}
if (process.argv.includes('--run')) console.log('prefabs:', buildUi().join(' '));
