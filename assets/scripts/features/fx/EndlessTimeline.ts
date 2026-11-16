import type { Rules } from '../../core/Rules';

/**
 * Pure timing of the endless board (docs/v2/09 §7.1, §8): one saved placement plays as
 * settle → full lines light up → lines clear along their axis (a crossing cell clears once) →
 * "+score" floats to the score bar while a new tray slides in; the end of a game plays as
 * board dim → S21 → score roll → record badge. No 'cc'.
 */
export type EndlessTimings = Rules['anim'];

/** Longest delay between the first and the last cell of a clearing line (the light flows along it). */
export const SWEEP = 0.08;
/** Gap between the tray slots sliding in. */
export const REFILL_STAGGER = 0.06;
/** Score bar pulse after the "+score" arrives, and the S21 notice pulse. */
export const PULSE = 0.16;
/** Design units the "+score" rises, and the drop of a new tray piece before it lands. */
export const RISE = 90, SLIDE = 60;
/** Frames of fx_line_clear. */
export const BURST_FRAMES = 6;

export interface Phase { readonly start: number; readonly end: number }
export interface ClearCell { readonly key: string; readonly start: number }
export interface PlacePlan {
    /** The dropped piece has landed. */
    readonly settleEnd: number;
    /** Full lines light up (null: nothing cleared). */
    readonly highlight: Phase | null;
    /** Every cleared cell once, starting when the light flow along its earliest line reaches it. */
    readonly cells: readonly ClearCell[];
    readonly cellSeconds: number;
    /** The saved board (cleared cells empty) shows from here. */
    readonly clearEnd: number;
    /** "+score" float; it reaches the score bar at its end (null: nothing scored). */
    readonly score: Phase | null;
    readonly refill: readonly { readonly slot: number; readonly start: number }[];
    readonly refillSeconds: number;
    /** Dragging works again (the score float may still be finishing). */
    readonly inputEnd: number;
    readonly end: number;
}

export interface PlaceInput {
    /** Full lines, cells in axis order ("q,r"). */
    readonly lines: readonly (readonly string[])[];
    readonly score: number;
    /** Tray slots dealt by this placement (empty unless the tray was refilled). */
    readonly refillSlots: readonly number[];
}

export function planPlace(input: PlaceInput, t: EndlessTimings): PlacePlan {
    const settleEnd = Math.max(0, t.endlessSettleSeconds), cleared = input.lines.length > 0;
    let highlight: Phase | null = null, clearEnd = settleEnd, cellSeconds = 0;
    const first = new Map<string, number>();
    if (cleared) {
        highlight = { start: settleEnd, end: settleEnd + Math.max(0, t.endlessHighlightSeconds) };
        const clear = Math.max(1e-3, t.endlessClearSeconds), sweep = Math.min(SWEEP, clear / 2);
        cellSeconds = Math.max(1e-3, clear - sweep);
        for (const line of input.lines) line.forEach((k, i) => {
            const start = highlight!.end + (line.length > 1 ? i / (line.length - 1) : 0) * sweep;
            first.set(k, Math.min(first.get(k) ?? Infinity, start));
        });
        clearEnd = highlight.end + clear;
    }
    const score = input.score > 0
        ? (s => ({ start: s, end: s + Math.max(1e-3, t.endlessScoreSeconds) }))(cleared ? highlight!.end + (clearEnd - highlight!.end) / 2 : settleEnd)
        : null;
    const refillSeconds = Math.max(1e-3, t.endlessRefillSeconds);
    const refill = input.refillSlots.map((slot, i) => ({ slot, start: clearEnd + i * REFILL_STAGGER }));
    const inputEnd = Math.max(clearEnd, ...refill.map(r => r.start + refillSeconds));
    return {
        settleEnd, highlight, cells: [...first].map(([key, start]) => ({ key, start })), cellSeconds, clearEnd,
        score, refill, refillSeconds, inputEnd, end: Math.max(inputEnd, score ? score.end + PULSE : 0),
    };
}

const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);

/** Dropped cells: 1.08 → 1 over the settle phase. */
export function settleScale(plan: PlacePlan, at: number): number {
    if (at >= plan.settleEnd || plan.settleEnd <= 0) return 1;
    const k = clamp01(at / plan.settleEnd);
    return 1 + 0.08 * (1 - k) * (1 - k);
}
/** 0..1 progress of one cleared cell (0 before its turn, 1 after). */
export function clearProgress(cell: ClearCell, plan: PlacePlan, at: number): number {
    return clamp01((at - cell.start) / Math.max(1e-6, plan.cellSeconds));
}
/** Line highlight of a clearing cell, never above 1 (a crossing cell does not get brighter). */
export function lineGlow(cell: ClearCell, plan: PlacePlan, at: number): number {
    const h = plan.highlight;
    if (!h || at < h.start) return 0;
    if (at < cell.start) return h.end > h.start ? clamp01((at - h.start) / (h.end - h.start)) : 1;
    return 1 - clearProgress(cell, plan, at);
}
/** The old cell art shrinks to 0.75 and fades while it clears. */
export function ghostScale(k: number): number { return 1 - 0.25 * clamp01(k); }
export function ghostAlpha(k: number): number { return 1 - easeOut(clamp01(k)); }
/** fx_line_clear frame for a clearing cell; -1 hides the burst. */
export function burstFrame(k: number): number { return k <= 0 || k >= 1 ? -1 : Math.min(BURST_FRAMES - 1, Math.floor(k * BURST_FRAMES)); }

/** "+score" float: rises RISE, fades in fast and out at the end; null when not on screen. */
export function floatPose(plan: PlacePlan, at: number): { readonly dy: number; readonly alpha: number } | null {
    const s = plan.score;
    if (!s || at < s.start || at >= s.end) return null;
    const k = (at - s.start) / (s.end - s.start);
    return { dy: RISE * easeOut(k), alpha: k < 0.2 ? k / 0.2 : k > 0.7 ? (1 - k) / 0.3 : 1 };
}
/** True once the "+score" has reached the score bar (it then shows the saved score). */
export function scoreArrived(plan: PlacePlan, at: number): boolean { return !plan.score || at >= plan.score.end; }
/** Score bar pulse 1 → 1.1 → 1 after the float arrives. */
export function scorePulse(plan: PlacePlan, at: number): number { return plan.score ? pulse(at - plan.score.end) : 1; }
/** Float text: multi-line clears name the line count. */
export function floatText(score: number, lines: number): string { return lines >= 2 ? `${lines}线消除 +${score}` : `+${score}`; }

/** A new tray piece: hidden before its turn, then slides up SLIDE and fades in. */
export function slideIn(start: number, plan: PlacePlan, at: number): { readonly dy: number; readonly alpha: number } {
    const k = clamp01((at - start) / plan.refillSeconds), e = easeOut(k);
    return { dy: e >= 1 ? 0 : -SLIDE * (1 - e), alpha: at < start ? 0 : e };
}

export function pulse(since: number): number { const k = since / PULSE; return k <= 0 || k >= 1 ? 1 : 1 + 0.1 * Math.sin(Math.PI * k); }

// ---- end of game (S21) -----------------------------------------------------

export interface ResultPlan {
    /** Before S21: an ended game dims, an abandoned one fades out. */
    readonly board: number;
    /** S21 pops in over this time (from 0 of the dialog's own clock). */
    readonly enter: number;
    /** Score rolls 0 → score (null: shown at once — abandoned or zero). */
    readonly roll: Phase | null;
    /** New record badge pop and confetti (null: no record). */
    readonly badge: Phase | null;
    /** "Stage reward waiting" notice pulse (null: nothing to claim). */
    readonly notice: Phase | null;
    /** S21 buttons work from here. */
    readonly end: number;
}

export interface ResultInput { readonly score: number; readonly record: boolean; readonly abandoned: boolean; readonly claimable: boolean }

export function planResult(input: ResultInput, t: EndlessTimings): ResultPlan {
    const enter = Math.max(0, t.resultEnterSeconds);
    const roll = !input.abandoned && input.score > 0 ? { start: enter, end: enter + Math.max(1e-3, t.scoreRollSeconds) } : null;
    const after = roll?.end ?? enter;
    const badge = input.record && !input.abandoned ? { start: after, end: after + Math.max(1e-3, t.recordSeconds) } : null;
    const noticeAt = badge?.end ?? after;
    const notice = input.claimable ? { start: noticeAt, end: noticeAt + PULSE } : null;
    return {
        board: input.abandoned ? Math.max(0, t.boardFadeSeconds) : Math.max(0, t.endlessDimSeconds),
        enter, roll, badge, notice, end: Math.max(noticeAt, notice?.end ?? 0),
    };
}
/** Score shown at `at`: eased roll up to the saved score, never past it. */
export function rolledScore(plan: ResultPlan, score: number, at: number): number {
    const r = plan.roll;
    if (!r || at >= r.end) return score;
    if (at <= r.start) return 0;
    return Math.min(score, Math.round(score * easeOut((at - r.start) / (r.end - r.start))));
}
/** Badge: hidden (0) before its turn, 0 → 1.2 → 1, then 1. */
export function badgeScale(plan: ResultPlan, at: number): number {
    const b = plan.badge;
    if (!b || at < b.start) return 0;
    const k = clamp01((at - b.start) / (b.end - b.start));
    return k < 0.5 ? 1.2 * easeOut(k / 0.5) : 1.2 - 0.2 * ((k - 0.5) / 0.5);
}
/** Board dim 0..1 before S21 (eased in, held at 1). */
export function boardDim(plan: ResultPlan, at: number): number { return plan.board <= 0 ? 1 : easeOut(clamp01(at / plan.board)); }

export interface Confetto { readonly dx: number; readonly dy: number; readonly spin: number; readonly frame: number }
/** Deterministic burst of n pieces (golden angle spread); positions are offsets at full distance. */
export function confetti(n: number, distance = 150): Confetto[] {
    return Array.from({ length: Math.max(0, n) }, (_, i) => {
        const a = i * 2.39996323 + 0.3, d = distance * (0.6 + 0.4 * ((i * 7) % 5) / 4);
        return { dx: Math.cos(a) * d, dy: Math.abs(Math.sin(a)) * d * 0.8 + 20, spin: (i % 2 ? 1 : -1) * (180 + 60 * (i % 3)), frame: i % 4 };
    });
}
/** One confetto at progress k: flies out, falls a little and fades. */
export function confettoPose(c: Confetto, k: number): { readonly x: number; readonly y: number; readonly angle: number; readonly alpha: number } {
    const e = easeOut(clamp01(k));
    if (k <= 0) return { x: 0, y: 0, angle: 0, alpha: 1 };
    return { x: c.dx * e, y: c.dy * e - 60 * k * k, angle: c.spin * k, alpha: k >= 1 ? 0 : 1 - clamp01((k - 0.5) / 0.5) };
}

// ---- tools (docs/v2/09 §7.2) ------------------------------------------------

/** "换一手": the old pieces shrink out together, then the new ones pop in, staggered. Input waits for the end. */
export interface SwapPlan {
    readonly outEnd: number;
    readonly slots: readonly { readonly slot: number; readonly start: number }[];
    readonly inSeconds: number;
    readonly end: number;
}
export function planSwap(slots: readonly number[], t: EndlessTimings): SwapPlan {
    const outEnd = Math.max(0, t.endlessSwapOutSeconds), inSeconds = Math.max(1e-3, t.endlessSwapInSeconds);
    const list = slots.map((slot, i) => ({ slot, start: outEnd + i * REFILL_STAGGER }));
    return { outEnd, slots: list, inSeconds, end: list.length ? list[list.length - 1].start + inSeconds : outEnd };
}
/** An old piece leaving: scale and alpha 1 → 0.6 / 0 by outEnd. */
export function swapOut(plan: SwapPlan, at: number): { readonly scale: number; readonly alpha: number } {
    const k = plan.outEnd <= 0 ? 1 : clamp01(at / plan.outEnd);
    return { scale: 1 - 0.4 * easeOut(k), alpha: 1 - k };
}
/** A new piece: hidden (0) before its turn, 0 → 1.15 → 1, then 1. */
export function popIn(start: number, seconds: number, at: number): number {
    if (at < start) return 0;
    const k = clamp01((at - start) / seconds);
    return k >= 1 ? 1 : k < 0.6 ? 1.15 * easeOut(k / 0.6) : 1.15 - 0.15 * ((k - 0.6) / 0.4);
}

/** "单格锤": the hammer drops onto the cell, then the cell shatters; the saved (empty) cell shows from the hit. */
export interface HammerPlan { readonly hit: number; readonly end: number }
/** Design units above the cell the hammer starts from. */
export const HAMMER_DROP = 140;
export function planHammer(t: EndlessTimings): HammerPlan {
    const hit = Math.max(0, t.endlessHammerSeconds);
    return { hit, end: hit + Math.max(1e-3, t.endlessShatterSeconds) };
}
/** Hammer above the cell: falls (ease-in) and swings level by the hit, then fades while the cell shatters. */
export function hammerPose(plan: HammerPlan, at: number): { readonly dy: number; readonly angle: number; readonly alpha: number } {
    if (at < plan.hit) {
        const k = plan.hit <= 0 ? 1 : clamp01(at / plan.hit);
        return { dy: HAMMER_DROP * (1 - k * k), angle: 40 * (1 - k), alpha: 1 };
    }
    return { dy: 0, angle: 0, alpha: 1 - clamp01((at - plan.hit) / (plan.end - plan.hit)) };
}
/** Shatter progress of the hit cell, 0 before the hit and 1 at the end. */
export function shatter(plan: HammerPlan, at: number): number { return at < plan.hit ? 0 : clamp01((at - plan.hit) / (plan.end - plan.hit)); }
