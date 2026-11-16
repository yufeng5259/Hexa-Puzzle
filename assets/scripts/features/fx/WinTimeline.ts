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
