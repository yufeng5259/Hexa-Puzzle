// Builds one Prefab per docs/v2/素材/布局/Sxx.json into assets/bundles/ui/prefabs.
// Run after import-art.mjs. Sprites/labels keep the artist's element ids; data-driven
// parts (map + buildings, puzzle board/tray cells) become empty mount nodes that
// feature code fills at runtime. Prefab/meta UUIDs are stable across runs.
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT } from './env.mjs';
import { importImageTo, stableUuid } from './import-art.mjs';
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
    S15: ['claim_next', 'stay'], S16: ['hud_btn_square_blue', 'hud_btn_square_purple', 'hud_energy', 'return_home'],
    S17: ['btn_close', 'btn_green'], S18: ['btn_close', 'task_1_action', 'task_2_action', 'task_3_action', 'completion_claim'],
    S19: ['home_button', 'back_button', 'help_button', 'stage_0_claim', 'stage_1_claim', 'stage_2_claim', 'stage_3_claim', 'start_challenge'],
    S20: ['hud_btn_square_blue', 'settings_button'], S21: ['retry', 'return_event'], S22: ['btn_close_dialog', 'save_leave', 'continue', 'end_game'],
    S23: ['btn_close_dialog', 'music_toggle_track', 'sound_toggle_track', 'vibration_toggle_track', 'done'], S24: ['retry_save', 'continue'], S25: ['claim_continue'],
};
/** Same element as drawn on another stage row, moved onto row i (S19 draws each row in one state only). */
const onRow = (layout, id, newId, from, to) => {
    const el = key => layout.elements.find(e => e.id === key), r = el(id).rect, dy = el(`stage_${to}_row`).rect[1] - el(`stage_${from}_row`).rect[1];
    return { ...el(id), id: newId, rect: [r[0], r[1] + dy, r[2], r[3]], hidden: true };
};
/** Runtime-only decorations not drawn in the reference layouts; created hidden, shown by feature code. */
const EXTRAS = {
    S02: () => [
        { id: 'signin_reddot', asset: 'UI/通用/reddot.png', rect: [124, 180, 34, 34], hidden: true },
        { id: 'task_reddot', asset: 'UI/通用/reddot.png', rect: [124, 349, 34, 34], hidden: true },
    ],
    // Every stage row gets all three states: claimed/locked tag with mark, or the claim button.
    S19: layout => [
        ...[0, 2, 3].flatMap(i => [onRow(layout, 'stage_1_claim', `stage_${i}_claim`, 1, i), onRow(layout, 'stage_1_claim_label', `stage_${i}_claim_label`, 1, i)]),
        onRow(layout, 'stage_2_status', 'stage_1_status', 2, 1), onRow(layout, 'mark_lock', 'stage_1_mark', 2, 1), onRow(layout, 'stage_2_status_text', 'stage_1_status_text', 2, 1),
    ],
};
/** S16 map cards: the layout's three cards become one MapCard Prefab, listed by data. */
const MAP_CARD = /^(m0\d_|map_tag_current$|current_tag$|map_progress|enter)/;
const MOUNTS = [
    { name: 'MapList', test: (e, page) => page === 'S16' && MAP_CARD.test(e.id), rect: layout => layout.scrollArea },
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
/** Overrides used while building start-scene prefabs: their images live in the main package, not a bundle. */
let frameOverride = null;
function frame(asset) {
    const uuid = frameOverride?.(asset) ?? frameBySource.get(asset.replace(/^\.\.\//, ''));
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
    for (const e of [...layout.elements, ...(EXTRAS[page]?.(layout) ?? [])]) {
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
        const node = b.node(e.id, b.root, box(layout, e.rect), !e.hidden);
        nodes.push(ref(node)); nodeIds.push(e.id);
        if (e.type === 'label') { labels.push(ref(addLabel(b, node, e))); labelIds.push(e.id); }
        else addSprite(b, node, e);
        if (buttons.has(e.id)) { b.button(node, b.root, 'LayoutView', 'onAction', e.id); buttons.delete(e.id); }
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
    b.component(b.root, VIEW, { pageId: page, nodes, nodeIds, labels, labelIds });
    if (PUZZLE_PAGES.has(page)) puzzleRig(b, layout, mounts.get('BoardMount').id, mounts.get('TrayMount').id);
    if (page === 'S16') listRig(b, layout, mounts.get('MapList').id);
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

/** One S16 card in every state: drawn as the current card, plus the locked row of the next card. */
function buildMapCard() {
    const layout = JSON.parse(fs.readFileSync(path.join(LAYOUTS, 'S16.json'), 'utf8')), el = id => layout.elements.find(e => e.id === id);
    const card = el('m01_card').rect, cx = card[0] + card[2] / 2, cy = card[1] + card[3] / 2;
    const nameShift = el('m01_name').rect[1] - el('m02_name').rect[1];
    const parts = [['m01_card', 'card'], ['m01_thumbnail', 'thumbnail'], ['m01_name', 'name'], ['map_tag_current', 'tag'], ['current_tag', 'tag_text'],
        ['map_progress_bg', 'progress_bg'], ['map_progress_fill', 'progress_fill'], ['map_progress', 'progress'], ['enter', 'enter'], ['enter_text', 'enter_text'],
        ['m02_lock', 'lock', nameShift], ['m02_condition', 'condition', nameShift]];
    const b = new Builder('MapCard', [card[2], card[3]]), nodes = [], nodeIds = [], labels = [], labelIds = [];
    for (const [from, id, dy = 0] of parts) {
        const e = el(from), [x, y, w, h] = e.rect;
        const node = b.node(id, b.root, { x: x + w / 2 - cx, y: cy - (y + dy + h / 2), width: w, height: h });
        nodes.push(ref(node)); nodeIds.push(id);
        if (e.type === 'label') { labels.push(ref(addLabel(b, node, e))); labelIds.push(id); }
        else addSprite(b, node, e);
        if (id === 'enter') b.button(node, b.root, 'LayoutView', 'onAction', 'enter');
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
    const layout = JSON.parse(fs.readFileSync(path.join(LAYOUTS, 'S22.json'), 'utf8')), el = id => layout.elements.find(e => e.id === id);
    const art = 'UI/无尽/endless_help_axes.png', hasArt = frameBySource.has(art);
    const elements = [el('mask_black'), el('panel_dialog'), el('ribbon_title_blue'), { ...el('title'), text: '玩法说明' }, el('btn_close_dialog'),
        ...(hasArt ? [{ id: 'help_art', asset: art, rect: [147, 640, 560, 380] }] : []),
        { id: 'help_text', type: 'label', text: '', fontSize: 30, color: '#5B3A16', rect: hasArt ? [110, 1030, 634, 130] : [110, 680, 634, 420], wrap: true },
        { ...el('save_leave'), id: 'confirm', rect: [143, 1180, 568, 105] }, { ...el('save_leave_label'), id: 'confirm_label', text: '知道了', rect: [155, 1186, 544, 93] }];
    const b = new Builder('HelpDialog', DESIGN), nodes = [], nodeIds = [], labels = [], labelIds = [];
    for (const e of elements) {
        const node = b.node(e.id, b.root, box(layout, e.rect));
        nodes.push(ref(node)); nodeIds.push(e.id);
        if (e.type === 'label') {
            const id = addLabel(b, node, e);
            if (e.wrap) Object.assign(b.objects[id], { _enableWrapText: true, _overflow: 1, _horizontalAlign: 0, _verticalAlign: hasArt ? 0 : 1, _lineHeight: hasArt ? 44 : 54, _fontSize: hasArt ? 30 : 36, _actualFontSize: hasArt ? 30 : 36 });
            labels.push(ref(id)); labelIds.push(e.id);
        } else addSprite(b, node, e);
        if (e.id === 'confirm' || e.id === 'btn_close_dialog') b.button(node, b.root, 'LayoutView', 'onAction', e.id);
    }
    b.component(b.root, VIEW, { pageId: 'HelpDialog', nodes, nodeIds, labels, labelIds });
    return { name: 'HelpDialog', objects: b.finish() };
}

const BOOT = 'assets/boot';
const GAME_BOOT = scriptType('assets/scripts/app/GameBoot.ts');
const manifestSlices = new Map(JSON.parse(fs.readFileSync(path.join(PROJECT, 'docs/v2/美术交付清单.json'), 'utf8')).uiAssets
    .flatMap(a => Object.values(a.states ?? {}).concat(a.frames ?? []).map(file => [file, a.slice ?? null])));

/**
 * S01 loading as a start-scene prefab: it and its images sit in the main package and are
 * referenced by Main.scene, so they load with the scene and the first frame is never black.
 */
function buildLoading() {
    const layout = JSON.parse(fs.readFileSync(path.join(LAYOUTS, 'S01.json'), 'utf8'));
    const copies = new Map(layout.elements.filter(e => e.asset).map(e => {
        const file = e.asset.replace(/^\.\.\//, '');
        return [e.asset, importImageTo(`素材/${file}`, `${BOOT}/textures/${path.basename(file)}`, manifestSlices.get(file) ?? null)];
    }));
    frameOverride = asset => copies.get(asset);
    try {
        const b = new Builder('Loading', DESIGN), nodes = [], nodeIds = [], labels = [], labelIds = [];
        for (const e of layout.elements) {
            const node = b.node(e.id, b.root, box(layout, e.rect));
            nodes.push(ref(node)); nodeIds.push(e.id);
            if (e.type === 'label') { labels.push(ref(addLabel(b, node, e))); labelIds.push(e.id); }
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
    const all = [...pages, buildAnchor(), buildMapCard(), buildReplayRow(), buildHelpDialog()];
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
