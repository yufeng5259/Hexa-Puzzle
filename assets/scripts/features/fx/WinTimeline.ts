import type { Rules } from '../../core/Rules';

/**
 * Pure timing of the puzzle board finishes (docs/v2/09 §5): the win wave that spreads from the
 * last placed piece by hex distance, and the failure dim with one small shake. No 'cc'.
 */
export type BoardTimings = Rules['anim'];
export interface Axial { readonly q: number; readonly r: number }
export interface WaveCell { readonly cell: Axial; readonly start: number }
export interface WavePlan {
    readonly cells: readonly WaveCell[];
    /** Each cell's bounce and glow take this long. */
    readonly cellSeconds: number;
    /** Board celebration over: the result dialog comes in. */
    readonly end: number;
}

/** Largest delay between the first and the last cell of the wave. */
export const WAVE_STAGGER = 0.18;
/** Visual bounce of placed cells: 1 → 1.04 → 1. */
export const BOUNCE = 0.04;
/** Failure: the board sways once by at most this many design units. */
export const SHAKE = 6;

export function hexDistance(a: Axial, b: Axial): number {
    const dq = a.q - b.q, dr = a.r - b.r;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** origin: the cells of the last placed piece (distance 0); empty origin starts every cell at once. */
export function planWave(cells: readonly Axial[], origin: readonly Axial[], t: BoardTimings): WavePlan {
    const dist = cells.map(c => origin.length ? Math.min(...origin.map(o => hexDistance(c, o))) : 0);
    const max = Math.max(0, ...dist), stagger = Math.min(WAVE_STAGGER, t.winWaveSeconds / 2);
    const cellSeconds = Math.max(1e-3, t.winWaveSeconds - stagger);
    return {
        cells: cells.map((cell, i) => ({ cell, start: t.winHoldSeconds + (max ? dist[i] / max : 0) * stagger })),
        cellSeconds,
        end: t.winHoldSeconds + t.winWaveSeconds,
    };
}

/** 0 before a cell's turn, 0..1 while it plays, 1 after. */
export function cellProgress(cell: WaveCell, plan: WavePlan, at: number): number {
    return Math.max(0, Math.min(1, (at - cell.start) / plan.cellSeconds));
}
export function bounceScale(k: number): number { return k <= 0 || k >= 1 ? 1 : 1 + BOUNCE * Math.sin(Math.PI * k); }
/** Glow strength 0..1, peaking a little before the middle of the bounce. */
export function glowAlpha(k: number): number { return k <= 0 || k >= 1 ? 0 : Math.sin(Math.PI * Math.pow(k, 0.8)); }

/** Failure dim 0..1 (eased in, then held) over failSeconds. */
export function failDim(at: number, t: BoardTimings): number {
    const k = Math.max(0, Math.min(1, at / Math.max(1e-6, t.failSeconds)));
    return 1 - (1 - k) * (1 - k);
}
/** Failure sway: one full sine period, never beyond ±SHAKE. */
export function failShake(at: number, t: BoardTimings): number {
    const k = at / Math.max(1e-6, t.failSeconds);
    return k <= 0 || k >= 1 ? 0 : SHAKE * Math.sin(2 * Math.PI * k);
}

// ---- Win celebration (docs/v2/10 §4.1) ----------------------------------------------------------

/** Board punch on the final move: 1 → 1.03 → 1 over winHoldSeconds. */
export const PUNCH = 0.03;
/** Strongest white of the full-screen flash. */
export const FLASH_ALPHA = 0.7;
/** The outer ring lights up over this share of the wave; each rim fades in over RIM_IN. */
export const RIM_SPAN = 0.7, RIM_IN = 0.12;
/** Ribbon pop and bee flight after celebrateAt. */
export const RIBBON_POP = 0.3, BEE_FLY = 0.45;
/** Firework flipbook: 6 frames at 12 fps; start offsets of the bursts after celebrateAt. */
export const FIREWORK_FPS = 12, FIREWORK_FRAMES = 6;
export const FIREWORK_STARTS = [0, 0.12, 0.3, 0.42];
/** Confetti: up to this long in the air, fading over the last part; launched within CONFETTI_SPREAD. */
export const CONFETTI_LIFE = 1.4, CONFETTI_FADE = 0.35, CONFETTI_SPREAD = 0.25, GRAVITY = 1700;

export interface WinMarks {
    /** Ribbon, confetti, fireworks, bee and the glow start. */
    readonly celebrate: number;
    /** Coins fly to the HUD. */
    readonly coins: number;
    /** The bar starts sliding in, and is settled (buttons work) at barDone. */
    readonly bar: number; readonly barDone: number;
    /** Last decoration gone: the effect ends. */
    readonly end: number;
}
export function winMarks(t: BoardTimings): WinMarks {
    const barDone = t.winBarAt + t.winBarSeconds;
    const last = t.winCelebrateAt + CONFETTI_SPREAD + CONFETTI_LIFE;
    return { celebrate: t.winCelebrateAt, coins: t.winCoinsAt, bar: t.winBarAt, barDone, end: Math.max(barDone, last) };
}

const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const easeOut = (k: number) => 1 - Math.pow(1 - clamp01(k), 3);

export function punchScale(at: number, t: BoardTimings): number {
    const k = at / Math.max(1e-6, t.winHoldSeconds);
    return k <= 0 || k >= 1 ? 1 : 1 + PUNCH * Math.sin(Math.PI * k);
}
/** White flash 0..FLASH_ALPHA, gone after winFlashSeconds. */
export function flashAlpha(at: number, t: BoardTimings): number {
    const k = at / Math.max(1e-6, t.winFlashSeconds);
    return k < 0 || k >= 1 ? 0 : FLASH_ALPHA * (1 - k);
}

const NEIGHBOURS: readonly Axial[] = [{ q: 1, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 1 }, { q: 0, r: -1 }, { q: 1, r: -1 }, { q: -1, r: 1 }];
/**
 * Cells on the outside of a shape (missing at least one neighbour), in order around its centre
 * (clockwise from the top, flat-top axial layout), so lighting them one by one runs round the shape.
 */
export function outerRing(cells: readonly Axial[]): Axial[] {
    const key = (c: Axial) => `${c.q},${c.r}`, all = new Set(cells.map(key));
    const ring = cells.filter(c => NEIGHBOURS.some(n => !all.has(key({ q: c.q + n.q, r: c.r + n.r }))));
    const xy = (c: Axial) => ({ x: 1.5 * c.q, y: Math.sqrt(3) * (c.r + c.q / 2) });
    const cx = cells.reduce((s, c) => s + xy(c).x, 0) / Math.max(1, cells.length), cy = cells.reduce((s, c) => s + xy(c).y, 0) / Math.max(1, cells.length);
    // Axial r grows downwards on screen: the angle from "up" turning clockwise.
    const angle = (c: Axial) => { const p = xy(c), a = Math.atan2(p.x - cx, -(p.y - cy)); return a < 0 ? a + 2 * Math.PI : a; };
    return ring.sort((a, b) => angle(a) - angle(b));
}
/** Opacity 0..1 of rim i of n: lit one after another during the wave, faded out while the bar comes in. */
export function rimAlpha(i: number, n: number, at: number, t: BoardTimings): number {
    const start = t.winHoldSeconds + (n > 1 ? i / (n - 1) : 0) * t.winWaveSeconds * RIM_SPAN;
    const on = clamp01((at - start) / RIM_IN), off = clamp01((at - t.winBarAt) / Math.max(1e-6, t.winBarSeconds));
    return on * (1 - off);
}
/** Shine sweep 0..1 across the shape during the wave; -1 when not showing. */
export function shineProgress(at: number, t: BoardTimings): number {
    const k = (at - t.winHoldSeconds) / Math.max(1e-6, t.winWaveSeconds);
    return k < 0 || k > 1 ? -1 : k;
}
/** Ribbon pop 0 → 1.15 → 1 from celebrateAt; 1 afterwards (the ribbon stays). */
export function ribbonScale(at: number, t: BoardTimings): number {
    const k = (at - t.winCelebrateAt) / RIBBON_POP;
    if (k <= 0) return 0;
    if (k >= 1) return 1;
    return k < 0.6 ? 1.15 * easeOut(k / 0.6) : 1.15 - 0.15 * ((k - 0.6) / 0.4);
}
/** Rotating glow behind the board: scale, angle (degrees) and opacity 0..1. */
export function glowPose(at: number, t: BoardTimings): { scale: number; angle: number; alpha: number } {
    const k = (at - t.winCelebrateAt) / Math.max(1e-6, t.winCelebrateSeconds);
    if (k <= 0) return { scale: 0.6, angle: 0, alpha: 0 };
    const off = clamp01((at - t.winBarAt) / Math.max(1e-6, t.winBarSeconds));
    return { scale: 0.6 + 0.6 * easeOut(k), angle: -40 * (at - t.winCelebrateAt), alpha: 0.85 * clamp01(k * 3) * (1 - off) };
}
/** Flipbook frame of a firework started at `start`; -1 before and after. */
export function fireworkFrame(at: number, start: number): number {
    const i = Math.floor((at - start) * FIREWORK_FPS);
    return i < 0 || i >= FIREWORK_FRAMES ? -1 : i;
}
/** Bee flying in from the side (offset fraction 1 → 0), then bobbing; opacity fades while the bar comes in. */
export function beePose(at: number, t: BoardTimings): { offset: number; bob: number; alpha: number } {
    const since = at - t.winCelebrateAt;
    if (since <= 0) return { offset: 1, bob: 0, alpha: 0 };
    const off = clamp01((at - t.winBarAt) / Math.max(1e-6, t.winBarSeconds));
    return { offset: 1 - easeOut(since / BEE_FLY), bob: Math.sin(since * 9), alpha: 1 - off };
}
/** Bar slide: 1 (below the screen) → 0 (in place) from winBarAt over winBarSeconds. */
export function barOffset(at: number, t: BoardTimings): number {
    return 1 - easeOut((at - t.winBarAt) / Math.max(1e-6, t.winBarSeconds));
}

/** One confetto: side -1 left / 1 right corner; launch delay; velocity (units/s); spin (deg/s); art index. */
export interface Confetto { readonly side: -1 | 1; readonly delay: number; readonly vx: number; readonly vy: number; readonly spin: number; readonly frame: number; readonly size: number }
/** n pieces, half from each lower corner, thrown up and inwards. rand: 0..1 source (Math.random in game, seeded in tests). */
export function confettiPieces(n: number, rand: () => number): Confetto[] {
    return Array.from({ length: Math.max(0, Math.floor(n)) }, (_, i) => {
        const side = (i % 2 ? 1 : -1) as -1 | 1;
        return {
            side, delay: rand() * CONFETTI_SPREAD, vx: -side * (180 + rand() * 420), vy: 1050 + rand() * 650,
            spin: (rand() - 0.5) * 900, frame: Math.floor(rand() * 4), size: 26 + rand() * 18,
        };
    });
}
/** Offset from its corner, angle and opacity of a confetto at `at` (launched at celebrateAt + delay); null when not in the air. */
export function confettoPose(c: Confetto, at: number, t: BoardTimings): { x: number; y: number; angle: number; alpha: number } | null {
    const s = at - t.winCelebrateAt - c.delay;
    if (s < 0 || s >= CONFETTI_LIFE) return null;
    // Air drag on x keeps the pieces from crossing the whole screen.
    const x = c.vx * (1 - Math.exp(-2 * s)) / 2, y = c.vy * s - GRAVITY * s * s / 2;
    return { x, y, angle: c.spin * s, alpha: clamp01((CONFETTI_LIFE - s) / CONFETTI_FADE) };
}
