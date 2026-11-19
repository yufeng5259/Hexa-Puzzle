// Builds one Prefab per docs/v2/素材/布局/Sxx.json into assets/bundles/ui/prefabs.
// Run after import-art.mjs. Sprites/labels keep the artist's element ids; data-driven
// parts (map + buildings, puzzle board/tray cells) become empty mount nodes that
// feature code fills at runtime. Prefab/meta UUIDs are stable across runs.
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT } from './env.mjs';
import { extensions, importImageTo, stableUuid } from './import-art.mjs';
import { Builder, color, external, ref, scriptType } from './prefab-builder.mjs';

const LAYOUTS = path.join(PROJECT, 'docs/v2/素材/布局');
const OUT = 'assets/bundles/ui/prefabs';
const DESIGN = [853, 1844];
const VIEW = scriptType('assets/scripts/features/ui/LayoutView.ts');
const EDGE_PIN = scriptType('assets/scripts/features/ui/EdgePin.ts');

/** Clickable element ids per page; they call LayoutView.onAction(id). */
const BUTTONS = {
    S02: ['hud_btn_square_purple', 'hud_energy', 'hud_level_badge', 'map_name', 'signin_entry', 'task_entry', 'endless_entry', 'home_play_btn', 'home_btn_back', 'home_btn_build'],
    S03: ['hud_btn_square_purple', 'hud_energy', 'home_btn_home', 'icon_gift'],
    S04: ['hud_btn_square_blue', 'hud_btn_square_blue_2', 'undo_button', 'replay_button', 'hint_button'],
    S05: ['hud_btn_square_blue', 'hud_btn_square_blue_2', 'undo_button', 'replay_button', 'hint_button'],
    S06: ['btn_green', 'btn_grey'], S07: ['retry', 'home'], S08: ['btn_close_dialog', 'save_home', 'continue', 'abandon'],
    S09: ['btn_close_dialog', 'restart', 'continue'], S10: ['btn_close_dialog', 'go_endless', 'return'],
    S11: ['btn_close_dialog', 'play', 'later'], S12: ['btn_close_dialog', 'continue'], S13: ['confirm'],
    S15: ['claim_next', 'stay'], S16: ['hud_btn_square_blue', 'hud_btn_square_purple', 'hud_energy', 'return_home'],
    S17: ['btn_close', 'btn_green'], S18: ['btn_close', 'task_1_action', 'task_2_action', 'task_3_action', 'completion_claim'],
    S19: ['home_button', 'help_button', 'league_entry', 'stage_0_claim', 'stage_1_claim', 'stage_2_claim', 'stage_3_claim', 'start_challenge'],
    S20: ['hud_btn_square_blue', 'settings_button', 'tool_swap', 'tool_hammer', 'end_rescue'], S21: ['retry', 'return_event'], S22: ['btn_close_dialog', 'save_leave', 'continue', 'end_game'],
    S23: ['btn_close_dialog', 'music_toggle_track', 'sound_toggle_track', 'vibration_toggle_track', 'done'], S24: ['retry_save', 'continue'], S25: ['claim_continue'],
    S26: ['home_button', 'help_button', 'tab_daily', 'tab_weekly', 'tab_all', 'go_play'], S27: ['claim'],
};
/** Same element as drawn on another stage row, moved onto row i (S19 draws each row in one state only). */
const onRow = (layout, id, newId, from, to) => {
    const el = key => layout.elements.find(e => e.id === key), r = el(id).rect, dy = el(`stage_${to}_row`).rect[1] - el(`stage_${from}_row`).rect[1];
    return { ...el(id), id: newId, rect: [r[0], r[1] + dy, r[2], r[3]], hidden: true };
};
/**
 * Home page bottom (decided 2026-11-14, differs from the S02 reference): no bottom bar and no
 * home button on the home page. A square build button sits bottom-left and Play is centred,
 * both sized after common mobile casual games (button height ≈ 20% of the screen width on a
 * long phone). The back button takes the build button's place while looking at a finished map.
 */
const HOME_DROP = new Set(['home_bottom_bar', 'home_btn_home', 'icon_home', 'home_btn_build', 'icon_build', 'build_text']);
export const HOME_ROW = { height: 168, margin: 48, side: 12, playWidth: 470 };
function homeRow(layout) {
    const [W, H] = layout.size, { height: h, margin, side, playWidth } = HOME_ROW, y = H - margin - h, px = Math.round((W - playWidth) / 2);
    const play = [px, y, playWidth, h];
    const moved = { home_play_btn: play, home_play_level_arrow: [px + 9, y + 6, 217, 151], play_level: [px + 44, y + 28, 138, 96], play_text: [px + 226, y + 30, 230, 98] };
    const fonts = { play_level: 72, play_text: 58 };
    const elements = layout.elements.filter(e => !HOME_DROP.has(e.id))
        .map(e => moved[e.id] ? { ...e, rect: moved[e.id], ...(fonts[e.id] ? { fontSize: fonts[e.id] } : {}) } : e);
    const tile = (prefix, icon, text, hidden) => [
        { id: `home_btn_${prefix}`, asset: 'UI/主页/home_btn_square_large_normal.png', rect: [side, y, h, h], hidden },
        { id: `icon_${prefix}`, asset: icon, rect: [side + 22, y + 4, 124, 124], hidden },
        { id: `${prefix}_text`, type: 'label', text, rect: [side, y + h - 56, h, 48], fontSize: 36, color: '#FFFFFF', bold: true, align: 'center', verticalAlign: 'center', outlineColor: '#1F3F8C', outlineWidth: 4, hidden },
    ];
    const dot = { id: 'build_reddot', asset: 'UI/通用/reddot.png', rect: [side + h - 34, y - 4, 38, 38], hidden: true };
    return { ...layout, elements: [...elements, ...tile('build', 'UI/图标/icon_build.png', '建造', false), ...tile('back', 'UI/图标/icon_back.png', '返回', true), dot] };
}
/**
 * HUD energy (decided 2026-11-14): the heart grows past the capsule's left end and carries the
 * energy count; the capsule shows "已满" or the countdown to the next point.
 */
const ENERGY = {
    light: { heart: [-13, -10, 109, 92], value: [98, 9, 84, 54], count: 46 },
    dark: { heart: [2, -7, 119, 100], value: [126, 15, 84, 55], count: 50 },
};
function energyHud(layout) {
    const capsule = layout.elements.find(e => e.id === 'hud_energy');
    if (!capsule || !layout.elements.some(e => e.id === 'energy_value')) return layout;
    // Offsets from the capsule's top-left corner.
    const spec = ENERGY[capsule.asset.includes('dark') ? 'dark' : 'light'], at = ([x, y, w, h]) => [capsule.rect[0] + x, capsule.rect[1] + y, w, h];
    const [hx, hy, hw, hh] = at(spec.heart);
    const count = { id: 'energy_count', type: 'label', text: '5', rect: [hx, hy + 8, hw, hh - 22], fontSize: spec.count, color: '#FFFFFF', bold: true,
        align: 'center', verticalAlign: 'center', outlineColor: '#9C1230', outlineWidth: 4 };
    const elements = layout.elements.flatMap(e => e.id === 'energy_icon' ? [{ ...e, rect: at(spec.heart) }, count]
        : e.id === 'energy_value' ? [{ ...e, rect: at(spec.value), fontSize: 34, text: '已满' }] : [e]);
    return { ...layout, elements };
}
/**
 * HUD of the map pages (decided 2026-11-14): no full-width backdrop (it stretched on wide
 * screens); level, energy and coins each sit in their own dark capsule like the puzzle HUD,
 * settings stays a square button. Layout units (854 wide).
 */
const HUD_PAGES = new Set(['S02', 'S03', 'S16']);
const HUD_RECTS = {
    hud_level_capsule: [62, 46, 232, 80], hud_level_badge: [12, 26, 110, 118], player_level: [22, 52, 90, 72],
    bar_bg: [124, 63, 154, 46], bar_fill_green: [130, 68, 142, 36],
    hud_energy: [310, 46, 212, 80], hud_coin: [536, 46, 194, 80], coin_icon: [524, 40, 88, 88], coin_value: [608, 58, 112, 56],
    hud_btn_square_purple: [744, 36, 98, 100], icon_settings: [762, 54, 62, 65],
};
const DARK_CAPSULE = 'UI/HUD/hud_capsule_dark.png';
function hudBar(layout) {
    const elements = layout.elements.flatMap(e => {
        if (e.id === 'hud_bar_bg') return [{ id: 'hud_level_capsule', asset: DARK_CAPSULE, slice: true, rect: HUD_RECTS.hud_level_capsule }];
        // Capsule text was dark on the light capsules; white on the dark ones, as on the puzzle HUD.
        const white = e.id === 'energy_value' || e.id === 'coin_value' ? { color: '#FFFFFF' } : {};
        if (!HUD_RECTS[e.id]) return [{ ...e, ...white }];
        return [{ ...e, rect: HUD_RECTS[e.id], ...white, ...(/^hud_(energy|coin)$/.test(e.id) ? { asset: DARK_CAPSULE } : {}) }];
    });
    return { ...layout, elements };
}
/**
 * Progress bars (09 §9): the fill element becomes a left-anchored viewport with a rect Mask over
 * the whole inner slot (its track minus the fill's inset on both sides); the nine-slice fill
 * picture inside keeps the full slot width, so any progress keeps the round left end. Code only
 * changes the viewport width (features/ui/ProgressBar.ts). Fill id → its track id.
 */
const trackOf = id => /fill_green/.test(id) ? id.replace('fill_green', 'bg') : /progress_fill$/.test(id) ? id.replace(/progress_fill$/, 'progress_bg') : null;
function progressSlots(layout) {
    const byId = new Map(layout.elements.map(e => [e.id, e]));
    const elements = layout.elements.map(e => {
        const track = byId.get(trackOf(e.id) ?? '');
        if (!track || e.type === 'label') return e;
        const inset = e.rect[0] - track.rect[0];
        return { ...e, progress: true, rect: [e.rect[0], e.rect[1], track.rect[2] - 2 * inset, e.rect[3]] };
    });
    return { ...layout, elements };
}
/** Node box of a progress viewport: anchored at its left end. */
const progressBox = at => ({ ...at, x: at.x - at.width / 2, anchorX: 0 });
/** Mask on the viewport node and the full-width fill picture inside it. */
function addProgress(b, node, e, width, height) {
    graphics(b, node);
    b.component(node, 'cc.Mask', { _type: 0, _inverted: false, _segments: 64, _alphaThreshold: 0.1 });
    addSprite(b, b.node(`${e.id}_art`, node, { width, height, anchorX: 0 }), e);
}
const ENERGY_PAGES = ['S02', 'S03', 'S04', 'S05', 'S16'];
/**
 * S05 buttons (decided 2026-11-16): the reference drew the undo / replay / hint row 130 units
 * higher than on S04, outside the bottom band. On 16:9 phones only the two pinned side buttons
 * then grew and moved, the middle one and the captions did not, so the row broke apart. The row
 * now sits where S04 has it, in the bottom band, and grows and pins as one row; it stays below
 * the tray frame (bottom 1435) at any band scale.
 */
const PUZZLE_ROW = /^(undo|replay|hint)_(button|icon|text)$|^puzzle_badge_count$|^hint_count$/;
export const S05_ROW_SHIFT = 130;
function puzzleRow(layout) {
    return { ...layout, elements: layout.elements.map(e => PUZZLE_ROW.test(e.id) ? { ...e, rect: [e.rect[0], e.rect[1] + S05_ROW_SHIFT, e.rect[2], e.rect[3]] } : e) };
}
/**
 * Puzzle win dialog (docs/v2/16 §9.4, decided 2026-11-17): the bottom win bar of 10 §4.1 is gone; the
 * win ends in the centred S06 dialog. It gets the gold win ribbon instead of the blue title ribbon
 * and, once delivered (P2-12), the decoration above the panel.
 */
const WIN_HEADER = 'UI/通用/win_panel_header.png';
function winDialog(layout) {
    const ribbon = layout.elements.find(e => e.id === 'ribbon_title_blue'), panel = layout.elements.find(e => e.id === 'panel_dialog');
    const header = frameBySource.has(WIN_HEADER) ? [{ id: 'win_panel_header', asset: WIN_HEADER, rect: [panel.rect[0] + (panel.rect[2] - 560) / 2, panel.rect[1] - 160, 560, 180] }] : [];
    const elements = layout.elements.flatMap(e => {
        if (e.id === 'ribbon_title_blue') return [...header, { ...e, id: 'ribbon_win_gold', asset: 'UI/通用/ribbon_win_gold.png', slice: true, rect: [ribbon.rect[0] - 20, ribbon.rect[1] - 10, ribbon.rect[2] + 40, ribbon.rect[3] + 10] }];
        if (e.id === 'title') return [{ ...e, fontSize: 56, color: '#FFFFFF', bold: true, outlineColor: '#8A4B08', outlineWidth: 5 }];
        // The coin amount sat 7 units into the line under it: coin and amount move up, the line stays inside the frame.
        if (e.id === 'icon_coin' || e.id === 'reward_coin') return [{ ...e, rect: [e.rect[0], e.rect[1] - (e.id === 'icon_coin' ? 12 : 16), e.rect[2], e.rect[3]] }];
        return [e];
    });
    return { ...layout, elements };
}
/** Page-level layout changes decided after the reference art; applied before building and pinning. */
const LAYOUT_PATCH = {
    ...Object.fromEntries(ENERGY_PAGES.map(p => [p, layout => {
        const hud = energyHud(HUD_PAGES.has(p) ? hudBar(layout) : layout);
        return p === 'S02' ? homeRow(hud) : p === 'S05' ? puzzleRow(hud) : hud;
    }])),
    // Home and back both left the activity: one home button, as on S20.
    S19: layout => ({ ...layout, elements: layout.elements.filter(e => e.id !== 'back_button' && e.id !== 'icon_back') }),
    S20: endlessTools,
    S06: winDialog,
};
/**
 * S20 tools (P5, docs/v2/09 §7.2, decided 2026-11-16): "换一手" bottom-left and "单格锤" bottom-right
 * under the tray, each a blue capsule with its icon, name and uses left; "结束本局" sits between
 * them only while no piece fits (rescue). The rule line moves up between board and tray, where
 * the placement feedback already showed.
 */
export const TOOL_ROW = { y: 1660, height: 100, width: 250, side: 40, endWidth: 226, hintY: 1212 };
function endlessTools(layout) {
    const { y, height: h, width: w, side, endWidth, hintY } = TOOL_ROW, W = layout.size[0];
    const up = { rule_hint: hintY, divider_gold: hintY + 17, divider_right: hintY + 17 };
    const elements = layout.elements.map(e => up[e.id] !== undefined ? { ...e, rect: [e.rect[0], up[e.id], e.rect[2], e.rect[3]] } : e);
    const text = { type: 'label', color: '#FFFFFF', bold: true, verticalAlign: 'center', outlineColor: '#1F3F8C', outlineWidth: 3 };
    const tool = (id, x, icon, name) => [
        { id, asset: 'UI/通用/btn_blue_normal.png', slice: true, rect: [x, y, w, h] },
        { id: `${id}_icon`, asset: icon, rect: [x + 12, y + 8, 84, 84] },
        { ...text, id: `${id}_label`, text: name, rect: [x + 96, y + 4, w - 108, 52], fontSize: 36, align: 'center' },
        { ...text, id: `${id}_count`, text: '剩1次', rect: [x + 96, y + 52, w - 108, 42], fontSize: 30, align: 'center' },
    ];
    const ex = (W - endWidth) / 2;
    return { ...layout, elements: [...elements,
        ...tool('tool_swap', side, 'UI/图标/icon_replay.png', '换一手'), ...tool('tool_hammer', W - side - w, 'UI/图标/icon_build.png', '单格锤'),
        { id: 'end_rescue', asset: 'UI/通用/btn_grey_normal.png', slice: true, rect: [ex, y, endWidth, h], hidden: true },
        { ...text, id: 'end_rescue_label', text: '结束本局', rect: [ex, y, endWidth, h], fontSize: 36, align: 'center', outlineColor: '#4A4F5C', hidden: true },
    ] };
}
export function pageLayout(file) {
    const layout = JSON.parse(fs.readFileSync(path.join(LAYOUTS, file), 'utf8'));
    return progressSlots(readable(iconAspect(LAYOUT_PATCH[layout.page]?.(layout) ?? layout)));
}
/**
 * UI quality audit (2026-11-18). A simple (not nine-sliced) picture is drawn at its own proportions:
 * when its layout rect differs by more than ASPECT_TOLERANCE (many rects were measured on older art
 * with another canvas shape) it is fitted inside the rect — characters stand on the rect's bottom edge,
 * everything else stays centred. Nine-slice art stretched beyond the tolerance is drawn nine-sliced
 * instead (see sliceFor), and full-screen pictures (backgrounds, dims) cover the screen as before.
 */
export const ASPECT_TOLERANCE = 1.06;
const FULL = (layout, e) => e.rect[2] >= layout.size[0] - 20 && e.rect[3] >= layout.size[1] - 60;
function iconAspect(layout) {
    return { ...layout, elements: layout.elements.map(e => {
        if (!e.asset || !e.rect || e.type === 'label' || e.progress || FULL(layout, e)) return e;
        const px = texturePixels(e.asset);
        if (!px || sliceFor(e, e.rect[2], e.rect[3], px)) return e;
        const [x, y, w, h] = e.rect, k = Math.min(w / px.width, h / px.height), fw = px.width * k, fh = px.height * k;
        if (Math.max(w / fw, h / fh) <= ASPECT_TOLERANCE) return e;
        const standing = /^角色\//.test(e.asset.replace(/^\.\.\//, ''));
        return { ...e, rect: [x + (w - fw) / 2, standing ? y + h - fh : y + (h - fh) / 2, fw, fh] };
    }) };
}
/**
 * Whether a picture is drawn nine-sliced: the layout says so, or it is nine-slice art (borders in its
 * import settings) stretched out of proportion; close to its proportions it keeps the plain drawing,
 * which keeps the gloss and texture of its middle intact.
 */
/** Nine-slice art with decoration across a middle cell (the crown's honeycombs): never sliced automatically. */
const DECORATED_MIDDLE = /panel_feature_crown/;
function sliceFor(e, w, h, px = texturePixels(e.asset)) {
    if (e.slice) return true;
    if (!px?.borders || px.borders.every(b => !b) || DECORATED_MIDDLE.test(e.asset)) return false;
    const r = (w / h) / (px.width / px.height);
    return Math.max(r, 1 / r) > ASPECT_TOLERANCE;
}

/**
 * Readability rules (decided 2026-11-14), applied to every generated layout in design units:
 * tappable areas at least HIT (icon buttons get a transparent hit area around the picture),
 * text at least MIN_FONT, dialog buttons at least BUTTON_HEIGHT, text links a full row to tap.
 */
export const UI_RULES = { HIT: 110, WIDE: 200, MIN_FONT: 30, BUTTON_HEIGHT: 92, LINK: [400, 88], CLOSE: 84 };
/** Labels only the reference art needed (a toggle shows its own state). */
const READABLE_DROP = new Set(['music_state', 'sound_state', 'vibration_state']);
/** A full-screen dim marks a dialog: it scales about the screen centre (LayoutView.dialog). */
export const isDialog = layout => layout.elements.some(e => e.id === 'mask_black');
const grow = ([x, y, w, h], nw, nh) => [x - (nw - w) / 2, y - (nh - h) / 2, nw, nh];
function readable(layout) {
    const panel = layout.elements.find(e => e.id === 'panel_dialog')?.rect, { MIN_FONT, BUTTON_HEIGHT, LINK, CLOSE } = UI_RULES;
    const elements = layout.elements.filter(e => !READABLE_DROP.has(e.id)).map(e => {
        if (e.id === 'btn_close_dialog' && panel) {
            // The small round close sat outside the panel corner: the large one sits inside it, right of the title ribbon.
            return { ...e, asset: 'UI/通用/btn_close_normal.png', rect: [panel[0] + panel[2] - CLOSE - 8, panel[1] + 14, CLOSE, CLOSE] };
        }
        if (e.type === 'label' && (e.action || BUTTONS[layout.page]?.includes(e.id))) return { ...e, rect: grow(e.rect, Math.max(e.rect[2], LINK[0]), Math.max(e.rect[3], LINK[1])), fontSize: Math.max(e.fontSize ?? MIN_FONT, MIN_FONT) };
        if (e.type === 'label' && e.fontSize && e.fontSize < MIN_FONT) {
            const k = MIN_FONT / e.fontSize, [x, y, w, h] = e.rect, nw = w * k, nh = h * k;
            const nx = e.align === 'left' ? x : e.align === 'right' ? x + w - nw : x - (nw - w) / 2;
            return { ...e, fontSize: MIN_FONT, rect: [nx, y - (nh - h) / 2, nw, nh] };
        }
        // Wide dialog buttons (secondary ones were drawn flatter) share the primary height.
        if (panel && e.asset && /btn_|^(continue|return|later|return_event|retry|save_|restart|play|go_)/.test(e.id) && e.rect[2] >= 400 && e.rect[3] < BUTTON_HEIGHT)
            return { ...e, rect: grow(e.rect, e.rect[2], BUTTON_HEIGHT) };
        return e;
    });
    return { ...layout, elements };
}
/**
 * Icon-sized tappable picture (narrower than WIDE) smaller than HIT: the rect of its transparent
 * hit area (layout units), else null. Wide buttons keep their own size (≥ BUTTON_HEIGHT tall).
 */
function hitRect(layout, e) {
    const k = layout.size[0] / DESIGN[0], min = UI_RULES.HIT * k, [, , w, h] = e.rect;
    return e.type !== 'label' && w < UI_RULES.WIDE * k && (w < min || h < min) ? grow(e.rect, Math.max(w, min), Math.max(h, min)) : null;
}
/** Runtime-only decorations not drawn in the reference layouts; created hidden, shown by feature code. */
const EXTRAS = {
    S02: () => [
        { id: 'signin_reddot', asset: 'UI/通用/reddot.png', rect: [124, 180, 34, 34], hidden: true },
        { id: 'task_reddot', asset: 'UI/通用/reddot.png', rect: [124, 349, 34, 34], hidden: true },
        { id: 'endless_reddot', asset: 'UI/通用/reddot.png', rect: [796, 180, 34, 34], hidden: true },
    ],
    // Every stage row gets all three states: claimed/locked tag with mark, or the claim button.
    S19: layout => [
        ...leagueEntry(),
        ...[0, 2, 3].flatMap(i => [onRow(layout, 'stage_1_claim', `stage_${i}_claim`, 1, i), onRow(layout, 'stage_1_claim_label', `stage_${i}_claim_label`, 1, i)]),
        onRow(layout, 'stage_2_status', 'stage_1_status', 2, 1), onRow(layout, 'mark_lock', 'stage_1_mark', 2, 1), onRow(layout, 'stage_2_status_text', 'stage_1_status_text', 2, 1),
    ],
    // "新纪录" badge beside the score (docs/v2/09 §8), reusing the map tag; only a strict new record pops it.
    S21: () => [
        { id: 'league_rank', type: 'label', text: '', rect: [150, 1130, 554, 50], fontSize: 30, color: '#B25A12', bold: true, align: 'center', verticalAlign: 'center' },
        { id: 'record_badge', asset: 'UI/地图选择/map_tag_current.png', rect: [568, 700, 174, 54], hidden: true },
        { id: 'record_badge_label', type: 'label', text: '新纪录', rect: [568, 700, 174, 54], fontSize: 32, color: '#FFFFFF', bold: true, align: 'center', verticalAlign: 'center', outlineColor: '#A2530B', outlineWidth: 3, hidden: true },
    ],
};
/** S16 map cards: the layout's three cards become one MapCard Prefab, listed by data. */
const MAP_CARD = /^(m0\d_|map_tag_current$|current_tag$|map_progress|enter)/;
const MOUNTS = [
    { name: 'MapList', test: (e, page) => page === 'S16' && MAP_CARD.test(e.id), rect: layout => layout.scrollArea },
    { name: 'MapMount', test: e => e.buildingId !== undefined || e.id === 'map_background', fullScreen: true },
    { name: 'BoardMount', test: e => /^board_cell_\d+$/.test(e.id) },
    { name: 'TrayMount', test: e => /^tray_\d+_cell_\d+$/.test(e.id) },
    { name: 'LeagueList', test: (e, page) => page === 'S26' && e.id === 'league_list' },
];

/**
 * Elements that keep their design distance to the screen's left/right edge on phones wider
 * than the design (EdgePin): the HUD band, the bottom button band and these side entries.
 * Each group goes by its outermost element's centre (left third / right third); the middle
 * stays centred. Decorations that frame centred text keep their place.
 */
const PIN_BANDS = { top: 140, bottom: 1590 };
const PIN_EXTRA = { S02: ['signin_entry', 'task_entry', 'endless_entry'], S16: ['hud_btn_square_blue'] };
const PIN_SKIP = /^divider/;
export function edgePins(layout) {
    const [W, H] = layout.size, sy = H / DESIGN[1];
    const els = layout.elements.filter(e => e.rect && !e.buildingId && !PIN_SKIP.test(e.id) && e.rect[2] < W - 20);
    // Hidden runtime parts (the win bar over the button row) never group what lies under them.
    const inside = (e, c) => c !== e && !c.hidden && c.rect[2] * c.rect[3] > e.rect[2] * e.rect[3] && e.rect[0] + e.rect[2] / 2 >= c.rect[0] && e.rect[0] + e.rect[2] / 2 <= c.rect[0] + c.rect[2]
        && e.rect[1] + e.rect[3] / 2 >= c.rect[1] && e.rect[1] + e.rect[3] / 2 <= c.rect[1] + c.rect[3];
    // Outermost element containing e (itself if none).
    const root = e => { let r = e; for (let c = els.find(x => inside(r, x)); c; c = els.find(x => inside(r, x))) r = c; return r; };
    const extra = new Set(PIN_EXTRA[layout.page] ?? []), pins = new Map();
    for (const e of els) {
        const g = root(e), [x, y, w, h] = g.rect;
        if (!(y + h <= PIN_BANDS.top * sy || y >= PIN_BANDS.bottom * sy || extra.has(g.id))) continue;
        const c = (x + w / 2) / W;
        if (c < 0.43) pins.set(e.id, 0); else if (c > 0.57) pins.set(e.id, 1);
    }
    return pins;
}

const registry = JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/resources/config/resource-registry.json'), 'utf8')).resources;
const frameBySource = new Map(registry.map(r => [(r.original ?? r.source).replace(/^素材\//, ''), r.uuid]));
const hex = value => { const v = value.replace('#', ''); return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16)); };

function box(layout, rect) {
    const sx = DESIGN[0] / layout.size[0], sy = DESIGN[1] / layout.size[1];
    const [x, y, w, h] = [rect[0] * sx, rect[1] * sy, rect[2] * sx, rect[3] * sy];
    return { x: x + w / 2 - DESIGN[0] / 2, y: DESIGN[1] / 2 - (y + h / 2), width: w, height: h };
}
/** Overrides used while building start-scene prefabs: their images live in the main package, not a bundle. */
let frameOverride = null;
function frame(asset) {
    const uuid = frameOverride?.(asset) ?? frameBySource.get(asset.replace(/^\.\.\//, ''));
    if (!uuid) throw new Error(`asset not imported: ${asset}`);
    return uuid;
}
/** Art manifest entry of each delivered file (size, nine-slice), keyed by its path under 素材/. */
const manifestByFile = new Map(JSON.parse(fs.readFileSync(path.join(PROJECT, 'docs/v2/美术交付清单.json'), 'utf8')).uiAssets
    .flatMap(a => Object.values(a.states ?? {}).concat(a.frames ?? []).map(file => [file, a])));
/**
 * An outpainted background (P2-4) is drawn instead of the design one, on a rect grown so the
 * design part stays exactly where the layout put it.
 */
const EXT = extensions();
function pngSize(file) {
    const full = path.join(PROJECT, 'docs/v2', file);
    if (!fs.existsSync(full)) return null;
    const b = fs.readFileSync(full);
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
function grown(e) {
    const file = e.asset?.replace(/^\.\.\//, ''), x = file && (EXT.get(`素材/${file}`) ?? EXT.get(file));
    const size = x && (manifestByFile.get(file)?.size ?? pngSize(EXT.get(file) ? file : `素材/${file}`));
    if (!size) return e.rect;
    const [rx, ry, rw, rh] = e.rect, kx = rw / size[0], ky = rh / size[1];
    return [rx - x.offset[0] * kx, ry - x.offset[1] * ky, x.size[0] * kx, x.size[1] * ky];
}
/**
 * Capsule art (buttons, tags, HUD capsules): both ends are half circles whose radius is the
 * picture's height, so the nine-slice may only stretch them in width. Their width is never
 * changed at runtime (progress bars are, so they are not listed).
 */
const CAPSULE = /^(btn_|tag_|hud_capsule_|home_play_btn$|home_btn_build$|build_cost_capsule$|map_tag_current$|signin_today_tag$|puzzle_steps_plate$|home_side_label$|ribbon_win_gold$)/;

/** Pixel size of an imported picture (its sprite frame in the texture meta); null when not imported. */
function texturePixels(asset) {
    const id = asset.replace(/^\.\.\//, ''), entry = registry.find(r => (r.original ?? r.source).replace(/^素材\//, '') === id);
    const m = entry && /^textures\/(.+)\/spriteFrame$/.exec(entry.path);
    if (!m) return null;
    const file = path.join(PROJECT, 'assets/bundles', entry.bundle, 'textures', m[1] + '.png.meta');
    if (!fs.existsSync(file)) return null;
    const frame = Object.values(JSON.parse(fs.readFileSync(file, 'utf8')).subMetas ?? {}).find(s => s.importer === 'sprite-frame');
    if (!frame) return null;
    const u = frame.userData;
    return { width: u.rawWidth, height: u.rawHeight, borders: [u.borderLeft ?? 0, u.borderRight ?? 0, u.borderTop ?? 0, u.borderBottom ?? 0] };
}
function addSprite(b, node, e) {
    const size = b.objects[b.objects[node]._components[0].__id__]._contentSize;
    if (!e.slice && sliceFor(e, size.width, size.height)) e = { ...e, slice: true };
    const id = b.sprite(node, frame(e.asset), e.opacity ?? 1);
    const sprite = b.objects[id];
    if (e.slice) sprite._type = 1;
    if (e.tint) sprite._color = color(hex(e.tint));
    if (e.flipX) b.objects[node]._lscale.x = -1;
    const art = manifestByFile.get(e.asset.replace(/^\.\.\//, '').replace(/^素材\//, ''));
    if (e.slice && art?.slice && art.scale === 2 && !CAPSULE.test(art.id)) {
        // 2x nine-slice art (P2-12 rows and tabs): borders are in 2x pixels, so the node is laid out at
        // twice its size and drawn at half scale; corners then look as drawn at the 1x display size.
        const ui = b.objects[b.objects[node]._components[0].__id__], { width, height } = ui._contentSize, sc = b.objects[node]._lscale;
        ui._contentSize = { __type__: 'cc.Size', width: width * 2, height: height * 2 };
        b.objects[node]._lscale = { __type__: 'cc.Vec3', x: sc.x * 0.5, y: sc.y * 0.5, z: 1 };
    }
    if (e.slice && art?.size && CAPSULE.test(art.id)) {
        // Lay the capsule out at the picture's own pixel height and scale the node to the layout height:
        // the round ends keep their shape at any button height. The pixel height comes from the imported
        // texture (2x art registers its size in 1x or 2x units), so the slice borders always fit.
        const pixels = texturePixels(e.asset)?.height ?? art.size[1];
        const ui = b.objects[b.objects[node]._components[0].__id__], { width, height } = ui._contentSize, k = height / pixels;
        if (Math.abs(k - 1) > 0.01) {
            ui._contentSize = { __type__: 'cc.Size', width: width / k, height: pixels };
            const sc = b.objects[node]._lscale;
            b.objects[node]._lscale = { __type__: 'cc.Vec3', x: Math.sign(sc.x || 1) * k, y: k, z: 1 };
        }
    }
}
function addLabel(b, node, e) {
    const id = b.label(node, e.text ?? '', { font_size: e.fontSize, color_rgb: e.color ? hex(e.color) : [255, 255, 255], align: e.align ?? 'center', weight: e.bold ? 'bold' : 'normal',
        stroke_width: e.outlineWidth ?? 0, stroke_color: e.outlineColor ? hex(e.outlineColor) : [0, 0, 0] });
    Object.assign(b.objects[id], { _verticalAlign: { top: 0, center: 1, bottom: 2 }[e.verticalAlign ?? 'center'], _overflow: 2 });
    return id;
}

function buildPage(file) { return buildLayout(pageLayout(file)); }
function buildLayout(layout) {
    const page = layout.page;
    const b = new Builder(page, DESIGN), buttons = new Set([...(BUTTONS[page] ?? []), ...layout.elements.filter(e => e.action).map(e => e.id)]);
    // Extras (red dots) are pinned with the entry they sit on.
    const elements = [...layout.elements, ...(EXTRAS[page]?.(layout) ?? [])];
    const nodes = [], nodeIds = [], labels = [], labelIds = [], mounts = new Map(), pins = edgePins({ ...layout, elements });
    for (const e of elements) {
        const mount = MOUNTS.find(m => m.test(e, page));
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
        // A small tappable picture becomes a transparent hit area (the element) holding the picture.
        const hit = buttons.has(e.id) ? hitRect(layout, e) : null, at = box(layout, grown(e));
        const node = b.node(e.id, b.root, hit ? box(layout, hit) : e.progress ? progressBox(at) : at, !e.hidden);
        nodes.push(ref(node)); nodeIds.push(e.id);
        if (e.type === 'label') { labels.push(ref(addLabel(b, node, e))); labelIds.push(e.id); }
        else if (e.progress) addProgress(b, node, e, at.width, at.height);
        else if (hit) { const outer = box(layout, hit); addSprite(b, b.node(`${e.id}_art`, node, { x: at.x - outer.x, y: at.y - outer.y, width: at.width, height: at.height }), e); }
        else addSprite(b, node, e);
        if (buttons.has(e.id)) { b.button(node, b.root, 'LayoutView', 'onAction', e.id); buttons.delete(e.id); }
        if (pins.has(e.id)) b.component(node, EDGE_PIN, { side: pins.get(e.id) });
    }
    for (const [name, { id, rects }] of mounts) {
        const spec = MOUNTS.find(m => m.name === name), full = spec.fullScreen;
        const left = Math.min(...rects.map(r => r[0])), top = Math.min(...rects.map(r => r[1]));
        const right = Math.max(...rects.map(r => r[0] + r[2])), bottom = Math.max(...rects.map(r => r[1] + r[3]));
        const rect = spec.rect ? spec.rect(layout) : full || !rects.length ? [0, 0, layout.size[0], layout.size[1]] : [left, top, right - left, bottom - top];
        const target = b.objects[id], at = box(layout, rect);
        target._lpos.x = at.x; target._lpos.y = at.y;
        b.objects[target._components[0].__id__]._contentSize = { __type__: 'cc.Size', width: at.width, height: at.height };
    }
    if (buttons.size) throw new Error(`${page}: button ids not in layout: ${[...buttons]}`);
    b.component(b.root, VIEW, { pageId: page, nodes, nodeIds, labels, labelIds, dialog: isDialog(layout) });
    if (PUZZLE_PAGES.has(page)) puzzleRig(b, layout, mounts.get('BoardMount').id, mounts.get('TrayMount').id);
    if (page === 'S16') listRig(b, layout, mounts.get('MapList').id);
    if (page === 'S26') leagueListRig(b, mounts.get('LeagueList').id);
    if (page === 'S20') {
        // Endless tray fills its frame (inset 24); the sample cells only mark its middle.
        const frameRect = layout.elements.find(e => e.id === 'puzzle_tray_frame').rect, inset = 24, id = mounts.get('TrayMount').id;
        const at = box(layout, [frameRect[0] + inset, frameRect[1] + inset, frameRect[2] - 2 * inset, frameRect[3] - 2 * inset]), node = b.objects[id];
        node._lpos.x = at.x; node._lpos.y = at.y;
        b.objects[node._components[0].__id__]._contentSize = { __type__: 'cc.Size', width: at.width, height: at.height };
    }
    return { name: page, objects: b.finish() };
}

const PUZZLE_PAGES = new Set(['S04', 'S05']);
const BOARD = scriptType('assets/scripts/features/puzzle/presentation/PuzzleBoardPresentation.ts');
const CONTROLLER = scriptType('assets/scripts/features/puzzle/controller/PuzzleController.ts');
const metaUuid = rel => JSON.parse(fs.readFileSync(path.join(PROJECT, rel + '.meta'), 'utf8')).uuid;
const TEXTURES = ['1', '3', '6', '7', '8', '9', '10', '11', '12', '13', '16', '17'].map(n => `${n}_png`);
const graphics = (b, node) => b.component(node, 'cc.Graphics', { _customMaterial: null, _visFlags: 0, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(),
    _lineWidth: 1, _strokeColor: color([0, 0, 0]), _lineJoin: 2, _lineCap: 0, _fillColor: color(), _miterLimit: 10 });

/**
 * Board and tray of S04/S05. The sample cells in the layout only mark the regions: the
 * board spans title to instruction, the tray sits inside its frame. Cells and pieces are
 * instantiated by PuzzleBoardPresentation; PuzzleController drags on the page root.
 */
function puzzleRig(b, layout, boardId, trayId) {
    const el = id => layout.elements.find(e => e.id === id);
    const top = Math.max(...['puzzle_title_line', 'puzzle_steps_plate'].map(el).filter(Boolean).map(e => e.rect[1] + e.rect[3])) + 20;
    const bottom = el('puzzle_instruction').rect[1] - 16, frameRect = el('puzzle_tray_frame').rect, inset = 18;
    const place = (id, rect) => {
        const at = box(layout, rect), node = b.objects[id];
        node._lpos.x = at.x; node._lpos.y = at.y;
        b.objects[node._components[0].__id__]._contentSize = { __type__: 'cc.Size', width: at.width, height: at.height };
        return at;
    };
    const boardBox = place(boardId, [30, top, layout.size[0] - 60, bottom - top]);
    const trayBox = place(trayId, [frameRect[0] + inset, frameRect[1] + inset, frameRect[2] - 2 * inset, frameRect[3] - 2 * inset]);
    const size = at => ({ width: at.width, height: at.height });

    const preview = b.node('PreviewRoot', boardId, size(boardBox), false);
    const previewGraphics = graphics(b, preview), previewOpacity = b.component(preview, 'cc.UIOpacity', { _opacity: 255 });
    // Hint outlines draw above cells and pieces, in the board's coordinates.
    const hint = b.node('HintLayer', b.root, { x: boardBox.x, y: boardBox.y, ...size(boardBox) });
    const rootChildren = b.objects[b.root]._children;
    rootChildren.splice(rootChildren.findIndex(r => r.__id__ === boardId) + 1, 0, rootChildren.pop());
    const hintGraphics = graphics(b, hint);

    const view = b.node('TrayView', trayId, size(trayBox));
    graphics(b, view);
    b.component(view, 'cc.Mask', { _type: 0, _inverted: false, _segments: 64, _alphaThreshold: 0.1 });
    const content = b.node('TrayContent', view, size(trayBox));
    const scroll = b.component(trayId, 'cc.ScrollView', { bounceDuration: 0.23, brake: 0.75, elastic: true, inertia: true, horizontal: true, vertical: false,
        cancelInnerEvents: true, scrollEvents: [], _content: ref(content), _horizontalScrollBar: null, _verticalScrollBar: null });
    const drag = b.node('DragRoot', b.root, { width: DESIGN[0], height: DESIGN[1] });

    const board = b.component(b.root, BOARD, {
        liveRoot: ref(boardId), fixtureNodes: [], boardMount: ref(boardId), piecesMount: ref(content),
        cellPrefab: external(metaUuid('assets/bundles/puzzle/prefabs/items/HexCellItem.prefab'), 'cc.Prefab'),
        piecePrefab: external(metaUuid('assets/bundles/puzzle/prefabs/items/PuzzlePieceItem.prefab'), 'cc.Prefab'),
        boardFloor: null, boardRim: null, boardShadow: null, remainingLabel: null, remainingCaptionLabel: null, levelLabel: null, totalCellsLabel: null, moveLimitLabel: null,
        wellAssetId: 'hex.empty_well', obstacleAssetId: 'hex.obstacle_riveted', textureAssetIds: JSON.stringify(Object.fromEntries(TEXTURES.map(t => [t, `hex.${t}`]))),
        boardPadding: 8, maxRadius: 62, trayMaxRadius: 37, trayGap: 12, trayPadding: 12, trayScroll: ref(scroll), trayViewport: ref(view), hintGraphics: ref(hintGraphics), countMoves: false,
    });
    b.component(b.root, CONTROLLER, { board: ref(board), dragRoot: ref(drag), previewRoot: ref(preview), previewGraphics: ref(previewGraphics), previewOpacity: ref(previewOpacity) });
}

const VIRTUAL_LIST = scriptType('assets/scripts/framework/ui/VirtualList.ts');
const LIST_ITEM = scriptType('assets/scripts/framework/ui/VirtualListItem.ts');
const REPLAY_ROW = { width: 760, height: 132 };

/** A top-left anchored ScrollView (view with rect Mask + content) filling an existing mount node. */
function scrollRig(b, mountId, prefix, vertical = true) {
    const ui = b.objects[b.objects[mountId]._components[0].__id__]._contentSize, topLeft = { anchorX: 0, anchorY: 1 };
    const view = b.node(prefix + 'View', mountId, { x: -ui.width / 2, y: ui.height / 2, width: ui.width, height: ui.height, ...topLeft });
    graphics(b, view);
    b.component(view, 'cc.Mask', { _type: 0, _inverted: false, _segments: 64, _alphaThreshold: 0.1 });
    const content = b.node(prefix + 'Content', view, { width: ui.width, height: ui.height, ...topLeft });
    const scroll = b.component(mountId, 'cc.ScrollView', { bounceDuration: 0.23, brake: 0.75, elastic: true, inertia: true, horizontal: !vertical, vertical,
        cancelInnerEvents: true, scrollEvents: [], _content: ref(content), _horizontalScrollBar: null, _verticalScrollBar: null });
    return { view, content, scroll };
}

/**
 * S16 holds two lists in the same scroll area: map cards (MapList, filled by the page)
 * and the replay list of cleared levels (ReplayList, a VirtualList of ReplayRow, hidden
 * until the page switches to its "选择已通关关卡" variant).
 */
function listRig(b, layout, mapListId) {
    scrollRig(b, mapListId, 'Map');
    const at = box(layout, layout.scrollArea);
    const replay = b.node('ReplayList', b.root, at, false);
    const rootChildren = b.objects[b.root]._children;
    rootChildren.splice(rootChildren.findIndex(r => r.__id__ === mapListId) + 1, 0, rootChildren.pop());
    const { view, content, scroll } = scrollRig(b, replay, 'Replay');
    b.component(replay, VIRTUAL_LIST, { scrollView: ref(scroll), viewport: ref(view), content: ref(content),
        itemPrefab: external(stableUuid(`${OUT}/ReplayRow.prefab`), 'cc.Prefab'), itemExtent: REPLAY_ROW.height, spacing: 14, buffer: 2, horizontal: false });
    const view16 = b.objects.find(o => o.__type__ === VIEW);
    view16.nodes.push(ref(replay)); view16.nodeIds.push('ReplayList');
}

/** Height of the chapter title row above a chapter's first S16 card (design px); MapPage adds it to the list. */
export const MAP_CHAPTER_ROW = 64;
/** One S16 card in every state: drawn as the current card, plus the locked row of the next card. */
function buildMapCard() {
    const layout = progressSlots(readable(JSON.parse(fs.readFileSync(path.join(LAYOUTS, 'S16.json'), 'utf8')))), el = id => layout.elements.find(e => e.id === id);
    const card = el('m01_card').rect, cx = card[0] + card[2] / 2, cy = card[1] + card[3] / 2;
    const nameShift = el('m01_name').rect[1] - el('m02_name').rect[1];
    const parts = [['m01_card', 'card'], ['m01_thumbnail', 'thumbnail'], ['m01_name', 'name'], ['map_tag_current', 'tag'], ['current_tag', 'tag_text'],
        ['map_progress_bg', 'progress_bg'], ['map_progress_fill', 'progress_fill'], ['map_progress', 'progress'], ['enter', 'enter'], ['enter_text', 'enter_text'],
        ['m02_lock', 'lock', nameShift], ['m02_condition', 'condition', nameShift]];
    const b = new Builder('MapCard', [card[2], card[3]]), nodes = [], nodeIds = [], labels = [], labelIds = [];
    for (const [from, id, dy = 0] of parts) {
        const e = el(from), [x, y, w, h] = e.rect;
        const at = { x: x + w / 2 - cx, y: cy - (y + dy + h / 2), width: w, height: h };
        const node = b.node(id, b.root, e.progress ? progressBox(at) : at);
        nodes.push(ref(node)); nodeIds.push(id);
        if (e.type === 'label') { labels.push(ref(addLabel(b, node, e))); labelIds.push(id); }
        else if (e.progress) addProgress(b, node, { ...e, id }, w, h);
        else addSprite(b, node, e);
        if (id === 'enter') b.button(node, b.root, 'LayoutView', 'onAction', 'enter');
    }
    // docs/v2/14 §6: the speciality honey on the thumbnail's lower left, and the chapter title above
    // the first card of each chapter (hidden here; MapPage shows it and makes room for it).
    const thumb = el('m01_thumbnail').rect, extra = [
        { id: 'subtitle', type: 'label', text: '晨露花蜜', rect: [thumb[0] + 18, thumb[1] + thumb[3] - 62, 420, 50], fontSize: 30, color: '#FFFFFF', bold: true, align: 'left', outlineColor: '#5B3A16', outlineWidth: 3 },
        { id: 'chapter', type: 'label', text: '第一章 · 家园启程', rect: [card[0], card[1] - MAP_CHAPTER_ROW, card[2], MAP_CHAPTER_ROW - 6], fontSize: 36, color: '#FFFFFF', bold: true, align: 'center', outlineColor: '#A2530B', outlineWidth: 4, hidden: true },
    ];
    for (const e of extra) {
        const [x, y, w, h] = e.rect, node = b.node(e.id, b.root, { x: x + w / 2 - cx, y: cy - (y + h / 2), width: w, height: h }, !e.hidden);
        nodes.push(ref(node)); nodeIds.push(e.id); labels.push(ref(addLabel(b, node, e))); labelIds.push(e.id);
    }
    b.component(b.root, VIEW, { pageId: 'MapCard', nodes, nodeIds, labels, labelIds });
    return { name: 'MapCard', objects: b.finish() };
}

/** One cleared level in the S16-B replay list; tapping it selects the level. */
function buildReplayRow() {
    const { width: w, height: h } = REPLAY_ROW, b = new Builder('ReplayRow', [w, h]);
    const root = b.objects[b.objects[b.root]._components[0].__id__];
    root._anchorPoint = { __type__: 'cc.Vec2', x: 0, y: 1 };
    const row = { asset: 'UI/任务/task_row_normal.png' }, picked = { asset: 'UI/任务/task_row_done.png' };
    addSprite(b, b.node('row', b.root, { x: w / 2, y: -h / 2, width: w - 16, height: h - 8 }), row);
    const selected = b.node('selected', b.root, { x: w / 2, y: -h / 2, width: w - 16, height: h - 8 }, false);
    addSprite(b, selected, picked);
    const title = b.node('title', b.root, { x: w / 2, y: -h / 2, width: w - 80, height: h - 20 });
    const label = addLabel(b, title, { text: '', fontSize: 38, color: '#5B3A16', bold: true });
    b.button(b.root, b.root, 'VirtualListItem', 'onItemClicked');
    b.component(b.root, LIST_ITEM, { titleLabel: ref(label), selectedMarker: ref(selected) });
    return { name: 'ReplayRow', objects: b.finish() };
}

/**
 * Standard help dialog (S19 "?"), built from the S22 dialog frame. The rules picture
 * (05_美术补充任务 2.4) is included once it is imported; until then the text fills the panel.
 */
function buildHelpDialog() {
    const layout = pageLayout('S22.json'), el = id => layout.elements.find(e => e.id === id);
    const art = 'UI/无尽/endless_help_axes.png', hasArt = frameBySource.has(art);
    const elements = [el('mask_black'), el('panel_dialog'), el('ribbon_title_blue'), { ...el('title'), text: '玩法说明' }, el('btn_close_dialog'),
        ...(hasArt ? [{ id: 'help_art', asset: art, rect: [147, 640, 560, 380] }] : []),
        { id: 'help_text', type: 'label', text: '', fontSize: 30, color: '#5B3A16', rect: hasArt ? [110, 1030, 634, 130] : [110, 680, 634, 420], wrap: true },
        { ...el('save_leave'), id: 'confirm', rect: [143, 1180, 568, 105] }, { ...el('save_leave_label'), id: 'confirm_label', text: '知道了', rect: [155, 1186, 544, 93] }];
    const b = new Builder('HelpDialog', DESIGN), nodes = [], nodeIds = [], labels = [], labelIds = [];
    for (const e of elements) {
        const hit = e.id === 'btn_close_dialog' ? hitRect(layout, e) : null, at = box(layout, e.rect);
        const node = b.node(e.id, b.root, hit ? box(layout, hit) : at);
        nodes.push(ref(node)); nodeIds.push(e.id);
        if (hit) { const outer = box(layout, hit); addSprite(b, b.node(`${e.id}_art`, node, { x: at.x - outer.x, y: at.y - outer.y, width: at.width, height: at.height }), e); }
        else if (e.type === 'label') {
            const id = addLabel(b, node, e);
            if (e.wrap) Object.assign(b.objects[id], { _enableWrapText: true, _overflow: 1, _horizontalAlign: 0, _verticalAlign: hasArt ? 0 : 1, _lineHeight: hasArt ? 44 : 54, _fontSize: hasArt ? 30 : 36, _actualFontSize: hasArt ? 30 : 36 });
            labels.push(ref(id)); labelIds.push(e.id);
        } else addSprite(b, node, e);
        if (e.id === 'confirm' || e.id === 'btn_close_dialog') b.button(node, b.root, 'LayoutView', 'onAction', e.id);
    }
    b.component(b.root, VIEW, { pageId: 'HelpDialog', nodes, nodeIds, labels, labelIds, dialog: true });
    return { name: 'HelpDialog', objects: b.finish() };
}

// ---- Bee league (docs/v2/16 §9) ------------------------------------------------------------

/**
 * Pictures of the league (P2-12, docs/v2/17). Until delivered the pages use these stand-ins:
 * tabs and podium bases from the common capsule/panel art, chests for the gifts.
 */
export const LEAGUE_ART = {
    entry: 'UI/图标/icon_leaderboard.png', entryStandIn: 'UI/图标/icon_gift.png',
    tab: 'UI/排行榜/tab_normal.png', tabOn: 'UI/排行榜/tab_selected.png', tabStandIn: 'UI/通用/btn_blue_normal.png', tabOnStandIn: 'UI/通用/btn_green_normal.png',
    row: 'UI/排行榜/rank_row_normal.png', rowSelf: 'UI/排行榜/rank_row_self.png', rowStandIn: 'UI/任务/task_row_normal.png', rowSelfStandIn: 'UI/任务/task_row_done.png',
    avatarBg: 'UI/排行榜/avatar_bg.png', avatarBgStandIn: 'UI/通用/panel_inner.png',
    podium: i => `UI/排行榜/podium_${i}.png`, podiumStandIn: 'UI/通用/panel_inner.png',
    badge: i => `UI/排行榜/league_badge_${i}.png`, badgeStandIn: 'UI/HUD/hud_level_badge.png',
    gift: 'UI/图标/icon_chest_closed.png',
};
const art = (file, standIn) => frameBySource.has(file) ? file : standIn;
/** S19: league button left of help, today's rank under it, a red dot while a settlement waits. */
function leagueEntry() {
    const x = 600, y = 37;
    return [
        { id: 'league_entry', asset: 'UI/HUD/hud_btn_square_blue_normal.png', rect: [x, y, 110, 97] },
        { id: 'league_icon', asset: art(LEAGUE_ART.entry, LEAGUE_ART.entryStandIn), rect: [x + 22, y + 12, 66, 66] },
        // Caption on the home side-entry label (seen floating on device 2026-11-18): over the button's lower edge, clear of the title.
        { id: 'league_label_bg', asset: 'UI/主页/home_side_label.png', slice: true, rect: [x - 12, y + 70, 134, 46] },
        { id: 'league_entry_rank', type: 'label', text: '联赛', rect: [x - 8, y + 72, 126, 42], fontSize: 30, color: '#233E7C', bold: true, align: 'center', verticalAlign: 'center' },
        { id: 'league_reddot', asset: 'UI/通用/reddot.png', rect: [x + 84, y - 6, 34, 34], hidden: true },
    ];
}
const LEAGUE_W = 853, LEAGUE_H = 1844;
export const LEAGUE_ROW = { width: 793, height: 110, spacing: 10 };
export const LEAGUE_LIST = [30, 830, 793, 690];
const label = (id, text, rect, fontSize, color, extra = {}) => ({ id, type: 'label', text, rect, fontSize, color, align: 'center', verticalAlign: 'center', ...extra });
const white = { color: '#FFFFFF', bold: true, outlineColor: '#1F3F8C', outlineWidth: 3 };
/** Avatar group: tinted square, the animal picture (hidden until art), its initial as a stand-in. */
const avatar = (id, x, y, s, frame = 'normal') => {
    const ring = `UI/排行榜/avatar_frame_${frame}.png`, f = s * 288 / 256;
    return [
        { id: `${id}_bg`, asset: art(LEAGUE_ART.avatarBg, LEAGUE_ART.avatarBgStandIn), slice: !frameBySource.has(LEAGUE_ART.avatarBg), rect: [x, y, s, s] },
        { id: `${id}_avatar`, asset: 'UI/图标/icon_coin.png', rect: [x + 4, y + 4, s - 8, s - 8], hidden: true },
        label(`${id}_initial`, '', [x, y, s, s], Math.round(s * 0.42), '#FFFFFF', { bold: true, outlineColor: '#5B3A16', outlineWidth: 3 }),
        ...(frameBySource.has(ring) ? [{ id: `${id}_frame`, asset: ring, rect: [x - (f - s) / 2, y - (f - s) / 2, f, f] }] : []),
    ];
};
const MEDAL = i => `UI/排行榜/rank_medal_${i}.png`, STAR = 'UI/排行榜/icon_league_star.png';
/** S26 bee league page: header, three tabs, tier and countdown, podium, ranking list, the pinned own row. */
export function leagueLayout() {
    const tabs = [['tab_daily', '每日'], ['tab_weekly', '每周'], ['tab_all', '总榜']].flatMap(([id, text], i) => {
        const x = 40 + i * 266;
        return [{ id, asset: art(LEAGUE_ART.tab, LEAGUE_ART.tabStandIn), slice: true, rect: [x, 160, 240, 92] }, label(`${id}_label`, text, [x, 164, 240, 80], 40, '#FFFFFF', white)];
    });
    // Bases at the delivered proportions (docs/v2/17 §3.4). The avatar stands on the top face; its name and
    // score sit above it; the medal sits high on the front, clear of the honeycomb decoration (seen on device).
    const podium = [[1, 316, 640, 220, 160], [2, 96, 700, 200, 120], [3, 556, 720, 200, 100]].flatMap(([i, x, y, w, h]) => {
        const real = frameBySource.has(LEAGUE_ART.podium(i)), s = 120, ax = x + (w - s) / 2, ay = y + h * 0.1 - s;
        const m = Math.round(Math.min(52, h * 0.44)), my = y + h * 0.22 - m / 2;
        return [
            { id: `podium_${i}`, asset: art(LEAGUE_ART.podium(i), LEAGUE_ART.podiumStandIn), slice: !real, rect: [x, y, w, h], tint: real ? undefined : ['#F5C542', '#C9D6E8', '#E7A066'][i - 1] },
            ...avatar(`podium_${i}`, ax, ay, s, ['gold', 'silver', 'bronze'][i - 1]),
            ...(frameBySource.has(MEDAL(i)) ? [{ id: `podium_${i}_medal`, asset: MEDAL(i), rect: [x + (w - m) / 2, my, m, m] }] : []),
            label(`podium_${i}_rank`, String(i), [x, my, w, m], Math.round(m * 0.62), '#FFFFFF', { bold: true, outlineColor: '#8A4B08', outlineWidth: 3 }),
            label(`podium_${i}_name`, '', [x - 30, ay - 92, w + 60, 44], 30, '#FFFFFF', white),
            label(`podium_${i}_score`, '', [x - 10, ay - 50, w + 20, 42], 32, '#FFE27A', { bold: true, outlineColor: '#5B3A16', outlineWidth: 3 }),
        ];
    });
    const me = 1530;
    return {
        page: 'S26', size: [LEAGUE_W, LEAGUE_H], elements: [
            { id: 'background', asset: '背景/bg_puzzle.png', rect: [0, 0, LEAGUE_W, LEAGUE_H] },
            { id: 'home_button', asset: 'UI/HUD/hud_btn_square_blue_normal.png', rect: [28, 37, 110, 97] },
            { id: 'icon_back', asset: 'UI/图标/icon_back.png', rect: [50, 57, 67, 57] },
            { id: 'help_button', asset: 'UI/HUD/hud_btn_square_blue_normal.png', rect: [715, 37, 110, 97] },
            { id: 'icon_help', asset: 'UI/图标/icon_help.png', rect: [744, 57, 52, 57] },
            label('title', '蜂群联赛', [180, 45, 493, 80], 56, '#FFFFFF', { bold: true, outlineColor: '#1F3F8C', outlineWidth: 4 }),
            ...tabs,
            { id: 'tier_panel', asset: 'UI/无尽/endless_score_panel.png', rect: [36, 272, 781, 160] },
            { id: 'tier_badge', asset: art(LEAGUE_ART.badge(1), LEAGUE_ART.badgeStandIn), rect: [58, 278, 128, 140] },
            label('tier_badge_text', '1', [58, 300, 128, 80], 52, '#FFFFFF', { bold: true, outlineColor: '#8A4B08', outlineWidth: 4 }),
            label('tier_name', '工蜂', [206, 290, 330, 56], 42, '#FFFFFF', { ...white, align: 'left' }),
            { id: 'stars_bg', asset: 'UI/通用/bar_bg.png', slice: true, rect: [230, 360, 396, 42] },
            { id: 'stars_fill_green', asset: 'UI/通用/bar_fill_green.png', slice: true, rect: [236, 365, 384, 32] },
            ...(frameBySource.has(STAR) ? [{ id: 'stars_icon', asset: STAR, rect: [196, 349, 64, 64] }] : []),
            label('stars_text', '0/50', [632, 352, 170, 56], 34, '#FFFFFF', white),
            label('board_info', '', [80, 296, 460, 110], 34, '#FFFFFF', { ...white, align: 'left', hidden: true }),
            { id: 'countdown_bg', asset: 'UI/HUD/hud_capsule_light.png', slice: true, rect: [560, 284, 240, 62] },
            label('countdown', '00:00:00', [560, 284, 240, 62], 32, '#6B3F12', { bold: true }),
            ...podium,
            { id: 'league_list', rect: LEAGUE_LIST },
            { id: 'me_row', asset: art(LEAGUE_ART.rowSelf, LEAGUE_ART.rowSelfStandIn), slice: true, rect: [30, me, 793, 110] },
            label('me_rank', '-', [36, me, 90, 110], 42, '#B25A12', { bold: true }),
            ...avatar('me', 130, me + 13, 84, 'self'),
            label('me_name', '我', [232, me, 280, 110], 36, '#5B3A16', { bold: true, align: 'left' }),
            label('me_score', '0', [500, me, 170, 110], 38, '#5B3A16', { bold: true, align: 'right' }),
            { id: 'me_gift', asset: LEAGUE_ART.gift, rect: [703, me + 18, 67, 74] },
            { id: 'go_play', asset: 'UI/通用/btn_green_normal.png', slice: true, rect: [190, 1680, 473, 120] },
            label('go_play_label', '去挑战', [190, 1686, 473, 104], 48, '#FFFFFF', { bold: true, outlineColor: '#2E6B12', outlineWidth: 4 }),
        ],
    };
}
/** S27 settlement dialog, on the S21 dialog frame: rank, gift, reward, stars and tier; one claim per settlement. */
export function leagueResultLayout() {
    const s21 = JSON.parse(fs.readFileSync(path.join(LAYOUTS, 'S21.json'), 'utf8')), el = id => s21.elements.find(e => e.id === id);
    const sx = LEAGUE_W / s21.size[0], sy = LEAGUE_H / s21.size[1], scale = e => ({ ...e, rect: [e.rect[0] * sx, e.rect[1] * sy, e.rect[2] * sx, e.rect[3] * sy] });
    return {
        page: 'S27', size: [LEAGUE_W, LEAGUE_H], elements: [
            ...['mask_black', 'panel_dialog', 'ribbon_title_blue'].map(id => scale(el(id))), { ...scale(el('title')), text: '每日联赛结算' },
            label('result_rank', '第 1 名', [150, 600, 554, 100], 66, '#B25A12', { bold: true }),
            label('result_info', '', [120, 700, 614, 50], 30, '#6B3F12'),
            { id: 'gift', asset: 'UI/图标/icon_chest_closed.png', rect: [310, 760, 233, 256] },
            label('reward_text', '', [120, 1020, 614, 56], 38, '#5B3A16', { bold: true }),
            label('stars_text', '', [120, 1078, 614, 50], 32, '#6B3F12'),
            label('tier_text', '', [120, 1128, 614, 50], 36, '#2E6B12', { bold: true, hidden: true }),
            { id: 'claim', asset: 'UI/通用/btn_green_normal.png', slice: true, rect: [143, 1190, 568, 105] },
            label('claim_label', '领取', [155, 1196, 544, 93], 44, '#FFFFFF', { bold: true, outlineColor: '#2E6B12', outlineWidth: 4 }),
            label('page_text', '', [150, 1310, 554, 50], 30, '#6B3F12'),
        ],
    };
}
/** One ranking row (S26 list, rank 4 onwards): row picture, rank, avatar, name, score, prize. */
function buildLeagueRow() {
    const { width: w, height: h } = LEAGUE_ROW, b = new Builder('LeagueRow', [w, h]);
    b.objects[b.objects[b.root]._components[0].__id__]._anchorPoint = { __type__: 'cc.Vec2', x: 0, y: 1 };
    const at = (x, y, bw, bh) => ({ x: x + bw / 2, y: -(y + bh / 2), width: bw, height: bh });
    const sprite = (name, asset, rect, slice = false) => { const n = b.node(name, b.root, at(...rect)); addSprite(b, n, { asset, slice }); return n; };
    const text = (name, rect, e) => { const n = b.node(name, b.root, at(...rect)); return addLabel(b, n, { text: '', verticalAlign: 'center', ...e }); };
    const row = sprite('row', art(LEAGUE_ART.row, LEAGUE_ART.rowStandIn), [0, 0, w, h], true);
    const self = sprite('self', art(LEAGUE_ART.rowSelf, LEAGUE_ART.rowSelfStandIn), [0, 0, w, h], true);
    b.objects[self]._active = false;
    const rank = text('rank', [6, 0, 90, h], { fontSize: 40, color: '#B25A12', bold: true });
    const bg = sprite('avatar_bg', art(LEAGUE_ART.avatarBg, LEAGUE_ART.avatarBgStandIn), [100, 13, 84, 84], !frameBySource.has(LEAGUE_ART.avatarBg));
    const pic = sprite('avatar', 'UI/图标/icon_coin.png', [104, 17, 76, 76]);
    b.objects[pic]._active = false;
    const initial = text('initial', [100, 13, 84, 84], { fontSize: 36, color: '#FFFFFF', bold: true, outlineColor: '#5B3A16', outlineWidth: 3 });
    const ring = 'UI/排行榜/avatar_frame_normal.png', ringNode = frameBySource.has(ring) ? sprite('avatar_frame', ring, [100 - 5.25, 13 - 5.25, 94.5, 94.5]) : null;
    const name = text('name', [202, 0, 300, h], { fontSize: 34, color: '#5B3A16', bold: true, align: 'left' });
    const score = text('score', [470, 0, 200, h], { fontSize: 36, color: '#5B3A16', bold: true, align: 'right' });
    const gift = sprite('gift', LEAGUE_ART.gift, [703, 18, 67, 74]);
    const spriteOf = node => ref(b.objects[node]._components.find(c => b.objects[c.__id__].__type__ === 'cc.Sprite').__id__);
    b.component(b.root, LEAGUE_ITEM, {
        titleLabel: null, selectedMarker: ref(self), rankLabel: ref(rank), nameLabel: ref(name), scoreLabel: ref(score), initialLabel: ref(initial),
        avatarBg: spriteOf(bg), avatarSprite: spriteOf(pic), giftSprite: spriteOf(gift), rowSprite: spriteOf(row), frameSprite: ringNode === null ? null : spriteOf(ringNode),
    });
    return { name: 'LeagueRow', objects: b.finish() };
}
const LEAGUE_ITEM = scriptType('assets/scripts/features/ui/LeagueRowItem.ts');
/** S26 ranking list: a VirtualList of LeagueRow in the list mount. */
function leagueListRig(b, mountId) {
    const { view, content, scroll } = scrollRig(b, mountId, 'League');
    b.component(mountId, VIRTUAL_LIST, { scrollView: ref(scroll), viewport: ref(view), content: ref(content),
        itemPrefab: external(stableUuid(`${OUT}/LeagueRow.prefab`), 'cc.Prefab'), itemExtent: LEAGUE_ROW.height, spacing: LEAGUE_ROW.spacing, buffer: 2, horizontal: false });
}

const BOOT = 'assets/boot';
const GAME_BOOT = scriptType('assets/scripts/app/GameBoot.ts');
const manifestSlices = new Map(JSON.parse(fs.readFileSync(path.join(PROJECT, 'docs/v2/美术交付清单.json'), 'utf8')).uiAssets
    .flatMap(a => Object.values(a.states ?? {}).concat(a.frames ?? []).map(file => [file, a.slice ?? null])));

/**
 * S01 loading as a start-scene prefab: it and its images sit in the main package and are
 * referenced by Main.scene, so they load with the scene and the first frame is never black.
 * Outpainted backgrounds are drawn from their wider file (see grown).
 */
function buildLoading() {
    const layout = progressSlots(JSON.parse(fs.readFileSync(path.join(LAYOUTS, 'S01.json'), 'utf8')));
    const ext = extensions(), copies = new Map(layout.elements.filter(e => e.asset).map(e => {
        const file = e.asset.replace(/^\.\.\//, ''), src = `素材/${file}`, draw = ext.get(src)?.file ?? src;
        return [e.asset, importImageTo(draw, `${BOOT}/textures/${path.basename(file)}`, manifestSlices.get(file) ?? null)];
    }));
    frameOverride = asset => copies.get(asset);
    try {
        const b = new Builder('Loading', DESIGN), nodes = [], nodeIds = [], labels = [], labelIds = [];
        for (const e of layout.elements) {
            const at = box(layout, grown(e)), node = b.node(e.id, b.root, e.progress ? progressBox(at) : at);
            nodes.push(ref(node)); nodeIds.push(e.id);
            if (e.type === 'label') { labels.push(ref(addLabel(b, node, e))); labelIds.push(e.id); }
            else if (e.progress) addProgress(b, node, e, at.width, at.height);
            else addSprite(b, node, e);
        }
        // Tapping the caption retries a failed boot.
        b.button(nodeIds.includes('loading_caption') ? nodes[nodeIds.indexOf('loading_caption')].__id__ : b.root, b.root, 'LayoutView', 'onAction', 'retry');
        b.component(b.root, VIEW, { pageId: 'Loading', nodes, nodeIds, labels, labelIds });
        return { name: 'Loading', dir: BOOT, objects: b.finish() };
    } finally { frameOverride = null; }
}

/** Points GameBoot on Main.scene at the loading prefab (scene dependencies load before the first frame). */
function linkBootScene(loadingUuid) {
    const file = path.join(PROJECT, 'assets/scenes/Main.scene'), text = fs.readFileSync(file, 'utf8'), scene = JSON.parse(text);
    const boot = scene.find(o => o.__type__ === GAME_BOOT);
    if (!boot) throw new Error('Main.scene has no GameBoot');
    boot.loadingPrefab = external(loadingUuid, 'cc.Prefab');
    const next = JSON.stringify(scene, null, 2) + '\n';
    if (next !== text) fs.writeFileSync(file, next);
}

/** Per-building upgrade anchor (dots + cost) taken from S03's B01 group, positioned relative to the building feet. */
function buildAnchor() {
    const layout = JSON.parse(fs.readFileSync(path.join(LAYOUTS, 'S03.json'), 'utf8'));
    const group = layout.elements.filter(e => e.anchor === 'building_feet' && e.buildingId === 'B01');
    const b = new Builder('BuildAnchor', [200, 120]), nodes = [], nodeIds = [], labels = [], labelIds = [];
    for (const e of group) {
        const id = e.id.replace(/^B01_/, ''), [w, h] = e.size ?? [120, 40], tap = id === 'cost' && h < UI_RULES.HIT;
        // The price tag is the upgrade button: a taller transparent hit area holds its picture.
        const node = b.node(id, b.root, { x: e.offset[0], y: -e.offset[1], width: w, height: tap ? UI_RULES.HIT : h });
        nodes.push(ref(node)); nodeIds.push(id);
        if (e.type === 'label') { labels.push(ref(addLabel(b, node, e))); labelIds.push(id); }
        else addSprite(b, tap ? b.node(`${id}_art`, node, { width: w, height: h }) : node, e);
        if (id === 'cost') b.button(node, b.root, 'LayoutView', 'onAction', 'upgrade');
    }
    b.component(b.root, VIEW, { pageId: 'BuildAnchor', nodes, nodeIds, labels, labelIds });
    return { name: 'BuildAnchor', objects: b.finish() };
}

function writePrefab({ name, objects, dir = OUT }) {
    const file = path.join(PROJECT, dir, name + '.prefab');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const text = JSON.stringify(objects, null, 2) + '\n';
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text);
    if (!fs.existsSync(file + '.meta')) fs.writeFileSync(file + '.meta', JSON.stringify({ ver: '1.1.50', importer: 'prefab', imported: true,
        uuid: stableUuid(`${dir}/${name}.prefab`), files: ['.json'], subMetas: {}, userData: { syncNodeName: name } }, null, 2) + '\n');
}
function dirMeta(rel) {
    const meta = path.join(PROJECT, rel + '.meta');
    if (!fs.existsSync(meta)) fs.writeFileSync(meta, JSON.stringify({ ver: '1.2.0', importer: 'directory', imported: true, uuid: stableUuid(rel), files: [], subMetas: {}, userData: {} }, null, 2) + '\n');
}

export function buildUi() {
    const pages = fs.readdirSync(LAYOUTS).filter(f => /^S\d\d\.json$/.test(f)).sort().map(buildPage);
    const league = [leagueLayout(), leagueResultLayout()].map(l => buildLayout(progressSlots(readable(iconAspect(l)))));
    const all = [...pages, ...league, buildAnchor(), buildMapCard(), buildReplayRow(), buildHelpDialog(), buildLeagueRow()];
    fs.mkdirSync(path.join(PROJECT, OUT), { recursive: true }); dirMeta(OUT);
    all.forEach(writePrefab);
    const loading = buildLoading();
    writePrefab(loading);
    linkBootScene(JSON.parse(fs.readFileSync(path.join(PROJECT, BOOT, 'Loading.prefab.meta'), 'utf8')).uuid);
    // Runtime registry: ResourceLoader verifies each prefab by UUID before instantiating it.
    const registry = all.map(p => ({ id: `prefab.${p.name}`, bundle: 'ui', path: `prefabs/${p.name}`, type: 'Prefab', uuid: stableUuid(`${OUT}/${p.name}.prefab`) }));
    const out = path.join(PROJECT, 'assets/resources/config/ui-prefabs.json'), text = JSON.stringify({ schema: 'honey-town.prefabs.v1', resources: registry }, null, 1) + '\n';
    if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== text) fs.writeFileSync(out, text);
    if (!fs.existsSync(out + '.meta')) fs.writeFileSync(out + '.meta', JSON.stringify({ ver: '2.0.1', importer: 'json', imported: true, uuid: stableUuid('assets/resources/config/ui-prefabs.json'), files: ['.json'], subMetas: {}, userData: {} }, null, 2) + '\n');
    return all.map(p => p.name);
}
if (process.argv.includes('--run')) console.log('prefabs:', buildUi().join(' '));
