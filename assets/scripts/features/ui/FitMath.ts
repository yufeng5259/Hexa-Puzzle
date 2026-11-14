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

/** Largest growth of the HUD / bottom bands (LayoutView) on phones wider than the design (16:9 ≈ 1.22). */
export const BAND_SCALE_MAX = 1.2;
/** Band growth: the frame width over the design width, 1 on long phones and tablets. */
export function bandScale(fit: { tablet: boolean; frame: { width: number } }): number {
    return fit.tablet ? 1 : Math.min(BAND_SCALE_MAX, Math.max(1, fit.frame.width / DESIGN.width));
}

/** UI bands over the map: HUD bottom and bottom-bar top, in design units from the frame top. */
export const MAP_BANDS = { hudBottom: 160, barTop: 1550 } as const;
/** A picture's extent relative to a reference centre: centre offset (y up) and size, design units. */
export interface Picture { x: number; y: number; width: number; height: number }

/**
 * Smallest scale (at least min) at which the picture, scaled about `about` (its centre lands at
 * about + picture offset * scale), covers the cover rect. All in one coordinate space, y up.
 */
export function coverScale(about: { x: number; y: number }, picture: Picture, cover: Rect, min = 1): number {
    const axis = (u: number, half: number, off: number, size: number) => Math.max((half + u) / (size / 2 - off), (half - u) / (size / 2 + off));
    return Math.max(min, axis(about.x - cover.x, cover.width / 2, picture.x, picture.width), axis(about.y - cover.y, cover.height / 2, picture.y, picture.height));
}

export interface MapPlacement {
    scale: number;
    /** Map centre relative to the frame centre, y up (Cocos). */
    offsetY: number;
}

/**
 * Enlarges the map (background + buildings together) to cover the frame, but only as far as
 * every building stays clear of the HUD and the bottom bar (where the design already overlaps
 * them it may keep doing so); the map may move vertically to make room.
 * buildings: opaque extent relative to the background centre (y down). bg: design background size.
 * picture: the drawn background (the outpainted one is larger than bg), relative to the bg centre.
 * cover: area the picture must cover, centre relative to the frame centre (y up); defaults to the
 * frame. Pass the screen so notches and rounded edges get filled too. Only if the picture still
 * falls short there (screens beyond the outpainting) is the map enlarged further.
 */
export function placeMap(frame: { width: number; height: number }, buildings: { top: number; bottom: number }, bg: { width: number; height: number },
    cover: Rect = { x: 0, y: 0, width: frame.width, height: frame.height }, picture: Picture = { x: 0, y: 0, ...bg }): MapPlacement {
    const F = frame.height, fill = Math.max(frame.width / bg.width, frame.height / bg.height);
    // Allowed band in frame coordinates (y down from the frame top).
    const allowTop = Math.min(MAP_BANDS.hudBottom, DESIGN.height / 2 + buildings.top);
    const allowBottom = F - (DESIGN.height - Math.max(MAP_BANDS.barTop, DESIGN.height / 2 + buildings.bottom));
    const fit = (allowBottom - allowTop) / (buildings.bottom - buildings.top);
    const scale = Math.min(fill, Math.max(1, fit));
    // Building y = F/2 + d + y * scale (d = downward shift); keep it inside [allowTop, allowBottom].
    const dMin = allowTop - F / 2 - buildings.top * scale, dMax = allowBottom - F / 2 - buildings.bottom * scale;
    const d = dMin > dMax ? (dMin + dMax) / 2 : Math.min(Math.max(0, dMin), dMax);
    return { scale: coverScale({ x: 0, y: -d }, picture, cover, scale), offsetY: -d };
}
