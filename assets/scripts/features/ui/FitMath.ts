/**
 * Screen fitting maths (no 'cc'), shared by the runtime and node tests.
 *
 * Phones always fill the screen. The 853x1844 design area is scaled to fit inside the
 * safe area (notch, punch hole, Dynamic Island, rounded corners, home indicator), the
 * "frame" is the whole safe area, and backgrounds bleed to the screen edges.
 * Tablets and unfolded foldables keep the design proportions: the frame is exactly the
 * design area, height-filling and centred in the safe area; the sides are left black.
 */
export const DESIGN = { width: 853, height: 1844 } as const;
/** Android's own phone/tablet boundary (smallest width in dp). */
export const TABLET_MIN_DP = 600;
/** Browser preview has no device class; wider than this counts as a tablet there. */
export const TABLET_ASPECT = 0.6;

export interface Insets { top: number; bottom: number; left: number; right: number }
export interface Rect { x: number; y: number; width: number; height: number }
export interface Fit {
    tablet: boolean;
    /** Screen pixels per design unit. */
    scale: number;
    /** Whole screen in design units; the engine's visible area. */
    visible: { width: number; height: number };
    /** Area the game lays out in, centre-relative design units (x/y = centre offset from screen centre). */
    frame: Rect;
}

/** screen and insets in any one pixel unit (device or CSS); tablet from the device class. */
export function computeFit(screen: { width: number; height: number }, insets: Insets, tablet: boolean): Fit {
    const safeW = Math.max(1, screen.width - insets.left - insets.right), safeH = Math.max(1, screen.height - insets.top - insets.bottom);
    const scale = Math.min(safeW / DESIGN.width, safeH / DESIGN.height);
    const visible = { width: screen.width / scale, height: screen.height / scale };
    // Safe-area centre relative to the screen centre (y up).
    const x = (insets.left - insets.right) / 2 / scale, y = (insets.bottom - insets.top) / 2 / scale;
    const frame = tablet ? { x, y, width: DESIGN.width, height: DESIGN.height } : { x, y, width: safeW / scale, height: safeH / scale };
    return { tablet, scale, visible, frame };
}

/** Device class from the platform's smallest-width (dp), or the browser fallback by aspect. */
export function isTablet(smallestWidthDp: number | null, screen: { width: number; height: number }): boolean {
    return smallestWidthDp !== null ? smallestWidthDp >= TABLET_MIN_DP : screen.width / screen.height > TABLET_ASPECT;
}

/** UI bands over the map: HUD bottom and bottom-bar top, in design units from the frame top. */
export const MAP_BANDS = { hudBottom: 160, barTop: 1550 } as const;
export interface MapPlacement {
    scale: number;
    /** Map centre relative to the frame centre, y up (Cocos). */
    offsetY: number;
    /** Uncovered strips between the map picture and the frame edges (design units). */
    gaps: { left: number; right: number; top: number; bottom: number };
}

/**
 * Enlarges the map (background + buildings together) to cover the frame, but only as far as
 * every building stays clear of the HUD and the bottom bar (where the design already overlaps
 * them it may keep doing so); the map may move vertically to make room.
 * buildings: opaque extent relative to the background centre (y down). bg: background size.
 * cover: area the picture (with fillers) must cover, centre relative to the frame centre (y up);
 * defaults to the frame. Pass the screen so notches and rounded edges get filled too.
 */
export function placeMap(frame: { width: number; height: number }, buildings: { top: number; bottom: number }, bg: { width: number; height: number },
    cover: Rect = { x: 0, y: 0, width: frame.width, height: frame.height }): MapPlacement {
    const F = frame.height, fill = Math.max(frame.width / bg.width, frame.height / bg.height);
    // Allowed band in frame coordinates (y down from the frame top).
    const allowTop = Math.min(MAP_BANDS.hudBottom, DESIGN.height / 2 + buildings.top);
    const allowBottom = F - (DESIGN.height - Math.max(MAP_BANDS.barTop, DESIGN.height / 2 + buildings.bottom));
    const fit = (allowBottom - allowTop) / (buildings.bottom - buildings.top);
    const scale = Math.min(fill, Math.max(1, fit));
    // Building y = F/2 + d + y * scale (d = downward shift); keep it inside [allowTop, allowBottom].
    const dMin = allowTop - F / 2 - buildings.top * scale, dMax = allowBottom - F / 2 - buildings.bottom * scale;
    const d = dMin > dMax ? (dMin + dMax) / 2 : Math.min(Math.max(0, dMin), dMax);
    const halfW = bg.width * scale / 2, halfH = bg.height * scale / 2, cw = cover.width / 2, ch = cover.height / 2;
    return {
        scale, offsetY: -d,
        gaps: {
            left: Math.max(0, cw - cover.x - halfW), right: Math.max(0, cw + cover.x - halfW),
            top: Math.max(0, ch + cover.y + d - halfH), bottom: Math.max(0, ch - cover.y - d - halfH),
        },
    };
}
