import type { Rules } from '../../core/Rules';

/**
 * Pure timing and layout of the "bee building crew" construction (docs/v2/13 §2). No 'cc'.
 * Time t is seconds since the build started; T is the configured construction time and every
 * phase boundary is a fraction of it (Constants buildFx*). Positions are design units in the
 * effect's space: origin at the building's feet anchor, y up; W is the building's display width.
 * The building picture, scaffold, dust and sparkle share one 576 canvas with the feet at y 544.
 */
export type BuildFxTiming = Rules['build']['fx'];

export interface FxSprite {
    readonly visible: boolean;
    readonly x: number; readonly y: number;
    /** Display size in design units: height for bees, width for everything else. */
    readonly size: number;
    readonly angle: number;
    readonly opacity: number;
    /** Frame index into the sprite's sequence (chips: which of the 3 shapes). */
    readonly frame: number;
    /** Mirrored horizontally (bees face right in the art). */
    readonly flip: boolean;
}
export interface BuildPose {
    readonly dust: FxSprite; readonly scaffold: FxSprite; readonly sparkle: FxSprite; readonly glow: FxSprite;
    /** Plank (0) and brick (1) carriers and what they carry. */
    readonly carriers: readonly FxSprite[]; readonly materials: readonly FxSprite[];
    readonly builders: readonly FxSprite[]; readonly sparks: readonly FxSprite[];
    /** CHIPS_PER_BUILDER per builder, builder-major. */
    readonly chips: readonly FxSprite[];
    readonly puffs: readonly FxSprite[];
    /** Horizontal jolt of the old building from the hammer strikes. */
    readonly shake: number;
}

export const CANVAS = 576, FEET = 544;
/** Bee canvas (bee_builder, bee_fly, bee_carrier): 384×400; builders stand on y 380 (anchor 0.95). */
export const BEE_CANVAS: readonly [number, number] = [384, 400];
export const BUILDER_FPS = 8, CARRIER_FPS = 12, DUST_FPS = 12;
/** Hammer head when it lands (bee_builder_03), bee canvas pixels relative to the feet, y up. */
export const HIT: readonly [number, number] = [96, 76];
/**
 * Where the carried material sits on the carrier, bee canvas pixels (left-top origin). Placeholder
 * for bee_fly; set to the manifest's bee_carrier attach.carry when P2-8 is imported.
 */
export const CARRY: readonly [number, number] = [292, 300];
export const CHIPS_PER_BUILDER = 3;
/** Display sizes as fractions of W (docs/v2/13 §3: plank 120, brick 64, chip 24 at W ≈ 420). */
export const SIZE = { plank: 0.29, brick: 0.15, chip: 0.06, spark: 0.13, puff: 0.42 } as const;
const SHAKE = 0.006;

/** Builders on the scaffold's middle and top boards (canvas px), the right one facing left. */
const BUILDERS = [{ cx: 172, cy: 372, flip: false }, { cx: 404, cy: 242, flip: true }];
/** Carriers come in from the left (plank) and the right (brick): drop point above the scaffold, landing board. */
const CARRIERS = [{ side: -1, cx: 196, cy: 150, landY: 360 }, { side: 1, cx: 384, cy: 136, landY: 232 }];
/** Dust-cloud puffs covering the building body (canvas px), bottom row first. */
const PUFFS = [[140, 505, 0], [250, 520, 0], [360, 515, 0], [462, 500, 0], [190, 412, 1], [310, 422, 1], [420, 402, 1], [250, 322, 2], [362, 312, 2]];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** 0 before a, 1 after b, linear between. */
export const span = (u: number, a: number, b: number) => b > a ? clamp01((u - a) / (b - a)) : u >= b ? 1 : 0;
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const easeIn = (k: number) => k * k;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Deterministic 0..1 noise. */
const hash = (n: number) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };
const HIDDEN: FxSprite = { visible: false, x: 0, y: 0, size: 0, angle: 0, opacity: 0, frame: 0, flip: false };
const sprite = (o: Partial<FxSprite>): FxSprite => ({ ...HIDDEN, visible: true, opacity: 1, ...o });

/** A point on the 576 building canvas in effect space. */
export function canvasPoint(cx: number, cy: number, W: number): { x: number; y: number } {
    const k = W / CANVAS;
    return { x: (cx - CANVAS / 2) * k, y: (FEET - cy) * k };
}
export function beeHeight(W: number, timing: BuildFxTiming): number { return timing.beeFraction * W; }

/** Seconds at which the level is committed and the new picture may appear (under the dust cloud). */
export function revealSeconds(T: number, timing: BuildFxTiming): number { return timing.revealAt * T; }
/** The effect removes itself after the sparkle tail. */
export function endSeconds(T: number, timing: BuildFxTiming): number { return T + timing.sparkleSeconds; }
/** A build resumed after a restart skips to the end of the hammering (short finish, no second charge). */
export function startSeconds(T: number, timing: BuildFxTiming, resumed: boolean): number { return resumed ? Math.min(timing.resumeFrom, timing.revealAt) * T : 0; }
/** Cloud dispersal and glow run from the reveal to half-way through the sparkle. */
function burstEnd(T: number, timing: BuildFxTiming): number { return 1 + 0.5 * timing.sparkleSeconds / T; }

/** Moment the builder's hammering starts (after flying in); the two builders are half a swing apart. */
function hammerFrom(i: number, T: number, timing: BuildFxTiming): number { return (timing.hammerStart + ENTER) * T + i * 1.5 / BUILDER_FPS; }
/** Fraction of T a builder takes to fly in, and to fly away when the cloud rises. */
const ENTER = 0.06, LEAVE = 0.08;

/** Strike times of builder i: hammer lands on frame 3 of each 3-frame swing, while hammering lasts. */
export function strikes(i: number, T: number, timing: BuildFxTiming): number[] {
    const out: number[] = [], h0 = hammerFrom(i, T, timing), stop = timing.cloudStart * T;
    for (let m = 0; ; m++) { const s = h0 + (3 * m + 2) / BUILDER_FPS; if (s >= stop) return out; out.push(s); }
}
/** Latest strike at or before t: its index and age, or null. */
function lastStrike(i: number, t: number, T: number, timing: BuildFxTiming): { m: number; age: number } | null {
    const list = strikes(i, T, timing);
    for (let m = list.length - 1; m >= 0; m--) if (list[m] <= t) return { m, age: t - list[m] };
    return null;
}

export function buildPose(t: number, T: number, timing: BuildFxTiming, W: number): BuildPose {
    const u = t / T, tm = timing, bh = beeHeight(W, tm), px = bh / BEE_CANVAS[1];
    const cloudMid = (tm.cloudStart + tm.revealAt) / 2;

    const dustOut = span(u, tm.scaffoldEnd, tm.scaffoldEnd + 0.1);
    const dust = dustOut < 1 ? sprite({ size: W, frame: Math.floor(t * DUST_FPS) % 5, opacity: 1 - dustOut }) : HIDDEN;
    const grow = span(u, 0, tm.scaffoldEnd), scaffoldOut = span(u, cloudMid, tm.revealAt);
    const scaffold = scaffoldOut < 1 ? sprite({ size: W, frame: Math.min(2, Math.floor(grow * 3)), opacity: Math.min(1, 0.2 + grow * 3) * (1 - scaffoldOut) }) : HIDDEN;

    // Carriers: fly in from the side, let go above the scaffold, turn round and leave; materials stay on the boards.
    const k = span(u, tm.carryStart, tm.carryEnd), materialOut = span(u, cloudMid, tm.revealAt);
    const carriers: FxSprite[] = [], materials: FxSprite[] = [];
    CARRIERS.forEach((c, i) => {
        const inStart = i * 0.15, arrive = inStart + 0.5, fallEnd = arrive + 0.2, gone = arrive + 0.35;
        const drop = canvasPoint(c.cx, c.cy, W), land = canvasPoint(c.cx, c.landY, W);
        const start = { x: c.side * 0.95 * W, y: drop.y + 0.25 * W }, bob = 0.02 * W * Math.sin(t * Math.PI * 6 + i);
        const started = u >= tm.carryStart && k > inStart;
        const a = easeOut(span(k, inStart, arrive)), l = easeIn(span(k, arrive, gone));
        const leaving = k >= arrive, flip = leaving ? c.side < 0 : c.side > 0;
        const x = leaving ? drop.x + c.side * 0.9 * W * l : lerp(start.x, drop.x, a), y = (leaving ? drop.y + 0.35 * W * l : lerp(start.y, drop.y, a)) + bob;
        carriers.push(started && k < gone ? sprite({ x, y, size: bh, frame: Math.floor(t * CARRIER_FPS) % 2, flip, opacity: Math.min(span(k, inStart, inStart + 0.08), 1 - span(k, gone - 0.1, gone)) }) : HIDDEN);
        // Held at the carry point until let go, then dropped onto its board with a little turn.
        const hold = { x: lerp(start.x, drop.x, a) - c.side * (CARRY[0] - BEE_CANVAS[0] / 2) * px, y: lerp(start.y, drop.y, a) + bob + (BEE_CANVAS[1] / 2 - CARRY[1]) * px };
        const f = easeIn(span(k, arrive, fallEnd)), size = (i === 0 ? SIZE.plank : SIZE.brick) * W;
        const m = { x: lerp(hold.x, land.x, f), y: lerp(hold.y, land.y + size * 0.12, f) };
        materials.push(started && materialOut < 1 ? sprite({ ...m, size, angle: c.side * 8 * f, opacity: 1 - materialOut }) : HIDDEN);
    });

    // Builders: drop in onto the boards, swing 3-frame hammers, fly off as the cloud rises.
    const builders: FxSprite[] = [], sparks: FxSprite[] = [], chips: FxSprite[] = [];
    let shake = 0;
    BUILDERS.forEach((b, i) => {
        const spot = canvasPoint(b.cx, b.cy, W), dir = b.flip ? -1 : 1, side = b.flip ? 1 : -1;
        const e = easeOut(span(u, tm.hammerStart, tm.hammerStart + ENTER)), l = easeIn(span(u, tm.cloudStart, tm.cloudStart + LEAVE));
        const h0 = hammerFrom(i, T, tm), swinging = t >= h0 && u < tm.cloudStart;
        builders.push(u >= tm.hammerStart && l < 1 ? sprite({
            x: spot.x + side * 0.2 * W * (1 - e) + side * 0.4 * W * l, y: spot.y + 0.35 * W * (1 - e) + 0.5 * W * l,
            size: bh, flip: b.flip, opacity: Math.min(e * 2, 1) * (1 - l), frame: swinging ? Math.floor((t - h0) * BUILDER_FPS) % 3 : 0,
        }) : HIDDEN);
        const hit = lastStrike(i, t, T, tm), at = { x: spot.x + dir * HIT[0] * px, y: spot.y + HIT[1] * px };
        const sparkK = hit ? hit.age / 0.2 : 1;
        sparks.push(sparkK < 1 ? sprite({ ...at, size: SIZE.spark * W * (0.5 + 0.7 * sparkK), angle: 45 * sparkK, opacity: 1 - sparkK * sparkK }) : HIDDEN);
        for (let j = 0; j < CHIPS_PER_BUILDER; j++) {
            if (!hit || hit.age >= 0.4 || j >= 2 + (hit.m % 2)) { chips.push(HIDDEN); continue; }
            const seed = hit.m * 7 + j * 13 + i * 31, h1 = hash(seed), h2 = hash(seed + 0.5), h3 = hash(seed + 0.25), s = hit.age;
            const theta = (-70 + 140 * h1) * Math.PI / 180, v = W * (0.5 + 0.4 * h2), g = 3 * W;
            chips.push(sprite({
                x: at.x + v * Math.sin(theta) * s, y: at.y + v * Math.cos(theta) * s - g * s * s / 2,
                size: SIZE.chip * W * (0.8 + 0.4 * h3), angle: (h3 - 0.5) * 720 * s, frame: (hit.m + j) % 3, opacity: 1 - span(s, 0.25, 0.4),
            }));
        }
        if (hit && hit.age < 0.25) shake += SHAKE * W * Math.exp(-hit.age * 14) * Math.sin(hit.age * 55);
    });

    // Dust cloud: rows rise from the ground in turn and cover the building; after the reveal they spread and fade.
    const end = burstEnd(T, tm), d = span(u, tm.revealAt, end), centre = canvasPoint(CANVAS / 2, 400, W);
    const puffs = PUFFS.map(([cx, cy, row], n) => {
        const k = span(u, tm.cloudStart + row * 0.25 * (tm.revealAt - tm.cloudStart), tm.revealAt);
        if (k <= 0 || d >= 1) return HIDDEN;
        const p = canvasPoint(cx, cy, W), r = easeOut(k), out = easeOut(d);
        const dx = p.x - centre.x, dy = p.y - centre.y, len = Math.hypot(dx, dy) || 1;
        return sprite({
            x: p.x + dx / len * 0.3 * W * out, y: lerp(0, p.y, r) + dy / len * 0.3 * W * out,
            size: SIZE.puff * W * (0.3 + 0.7 * r) * (1 + 0.3 * d), angle: (hash(n) - 0.5) * 60 + 20 * d, opacity: Math.min(1, k * 3) * (1 - d),
        });
    });
    const g = span(u, tm.revealAt, end), light = canvasPoint(CANVAS / 2, 390, W);
    const glow = g > 0 && g < 1 ? sprite({ ...light, size: W * (0.5 + 0.8 * easeOut(g)), angle: 30 * g, opacity: Math.sin(Math.PI * g) }) : HIDDEN;
    const sp = tm.sparkleSeconds > 0 ? (t - T) / tm.sparkleSeconds : 1;
    const sparkle = sp >= 0 && sp < 1 ? sprite({ size: W, frame: Math.min(4, Math.floor(sp * 5)), opacity: 1 - span(sp, 0.7, 1) }) : HIDDEN;

    return { dust, scaffold, sparkle, glow, carriers, materials, builders, sparks, chips, puffs, shake };
}
