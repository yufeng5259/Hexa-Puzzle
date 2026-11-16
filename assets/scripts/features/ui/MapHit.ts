/**
 * Tap targets for buildings on the home map (S02/S03). Pure math, no engine types, so it is unit tested.
 * Coordinates are map-mount design space: origin at the design centre, y up (as HomeController places sprites).
 */
export interface HitLayout {
    readonly id: string;
    readonly feetX: number;
    readonly feetY: number;
    readonly anchorX: number;
    readonly anchorY: number;
    readonly widthFraction: number;
    readonly flipX: boolean;
    readonly zIndex: number;
}
export interface HitRect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

/** Share of the square picture that counts as the building: transparent margins around it do not. */
export const BUILDING_HIT_SHRINK = 0.7;
/** A finger moving further than this (design units) between press and release is a drag, not a tap. */
export const TAP_SLOP = 24;

/**
 * The building picture's rectangle (bottom-left x/y), shrunk around its centre.
 * The sprite is a widthFraction×W square anchored at (anchorX, 1 - anchorY) on its feet; flipX mirrors it about the anchor.
 */
export function buildingRect(b: HitLayout, design: { width: number; height: number }, shrink = BUILDING_HIT_SHRINK): HitRect {
    const size = b.widthFraction * design.width;
    const px = (b.feetX - 0.5) * design.width, py = (0.5 - b.feetY) * design.height;
    const left = px - (b.flipX ? 1 - b.anchorX : b.anchorX) * size;
    const bottom = py - (1 - b.anchorY) * size;
    const w = size * shrink;
    return { x: left + (size - w) / 2, y: bottom + (size - w) / 2, width: w, height: w };
}

/** The building under a point; where shrunk rectangles overlap the one drawn on top (largest zIndex) wins. */
export function hitBuilding(buildings: readonly HitLayout[], x: number, y: number, design: { width: number; height: number }, shrink = BUILDING_HIT_SHRINK): string | null {
    let best: HitLayout | null = null;
    for (const b of buildings) {
        const r = buildingRect(b, design, shrink);
        if (x < r.x || x > r.x + r.width || y < r.y || y > r.y + r.height) continue;
        if (!best || b.zIndex > best.zIndex) best = b;
    }
    return best?.id ?? null;
}

/** Press and release close enough together to count as a tap. */
export function isTap(start: { x: number; y: number }, end: { x: number; y: number }, slop = TAP_SLOP): boolean {
    return Math.hypot(end.x - start.x, end.y - start.y) <= slop;
}
