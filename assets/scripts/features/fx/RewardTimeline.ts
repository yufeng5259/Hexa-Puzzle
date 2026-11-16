import type { Reward, Rules } from '../../core/Rules';

/**
 * Pure timing of one reward show (docs/v2/09 §4, §6): cards pop one after another, particles
 * scatter and fly to the visible HUD target of their kind, the target pulses once and its value
 * rolls. Only presents a saved result; nothing here grants or charges. No 'cc'.
 */
export type RewardKind = 'coins' | 'energy' | 'hints';
/** Display order of a mixed reward. */
export const REWARD_KINDS: readonly RewardKind[] = ['coins', 'energy', 'hints'];
export type RewardTimings = Rules['anim'];

export interface RewardItem { readonly kind: RewardKind; readonly amount: number }
export interface CardPlan { readonly item: RewardItem; readonly start: number; readonly flies: boolean }
export interface ParticlePlan { readonly card: number; readonly born: number; readonly land: number }
export interface ArrivalPlan { readonly kind: RewardKind; readonly first: number; readonly last: number }
export interface RewardPlan {
    readonly cards: readonly CardPlan[];
    readonly particles: readonly ParticlePlan[];
    /** Per flying kind: first arrival pulses the target, the value rolls until the last one. */
    readonly arrivals: readonly ArrivalPlan[];
    /** Chest shake/open time before the first card; 0 without a chest. */
    readonly intro: number;
    /** Everything has landed: the stable state a fast-forward jumps to. */
    readonly settled: number;
    /** Cards (incl. the ones without a target) faded out. */
    readonly end: number;
}

const PARTICLE_GAP = 0.025;
/** All flying of one show stays within about this long. */
const FLIGHT_BUDGET = 0.9;
/** Cards without a target stay readable this long after the show settles. */
const HOLD = 0.6;
/** Last part of a show: the cards fade out. */
export const REWARD_FADE = 0.15;
/** Energy and hint particles per card. */
const SMALL_PARTICLES = 4;

/** Non-zero parts of a reward in display order; an empty list means nothing to show. */
export function rewardItems(reward: Reward): RewardItem[] {
    return REWARD_KINDS.filter(kind => reward[kind] > 0).map(kind => ({ kind, amount: reward[kind] }));
}

/** Visual budget only; it never splits the real amount. */
export function particleCount(item: RewardItem, coinMax: number): number {
    if (item.kind === 'coins') return Math.max(1, Math.min(coinMax, Math.max(3, Math.ceil(item.amount / 20))));
    return Math.min(SMALL_PARTICLES, Math.max(1, item.amount));
}

export function chestIntro(t: RewardTimings): number { return t.chestShakeSeconds + t.chestOpenSeconds; }

/** flies(kind): a visible target exists for that kind; otherwise its card stays as the record. */
export function planReward(items: readonly RewardItem[], flies: (kind: RewardKind) => boolean, t: RewardTimings, intro = 0): RewardPlan {
    const cards = items.map((item, i): CardPlan => ({ item, start: intro + i * t.cardStaggerSeconds, flies: flies(item.kind) }));
    const particles: ParticlePlan[] = [];
    const travel = t.scatterSeconds + t.flySeconds;
    cards.forEach((card, i) => {
        if (!card.flies) return;
        const n = particleCount(card.item, t.coinParticlesMax);
        const gap = n > 1 ? Math.max(0, Math.min(PARTICLE_GAP, (FLIGHT_BUDGET - travel) / (n - 1))) : 0;
        const launch = card.start + t.cardSeconds;
        for (let j = 0; j < n; j++) particles.push({ card: i, born: launch + j * gap, land: launch + j * gap + travel });
    });
    const arrivals: ArrivalPlan[] = [];
    for (const kind of REWARD_KINDS) {
        const lands = particles.filter(p => cards[p.card].item.kind === kind).map(p => p.land);
        if (lands.length) arrivals.push({ kind, first: Math.min(...lands), last: Math.max(...lands) });
    }
    const shown = cards.length ? cards[cards.length - 1].start + t.cardSeconds : intro;
    const landed = arrivals.length ? Math.max(...arrivals.map(a => Math.max(a.last, a.first + t.pulseSeconds))) : 0;
    const settled = Math.max(shown, landed);
    const end = cards.length ? settled + (cards.some(c => !c.flies) ? HOLD : 0) + REWARD_FADE : settled;
    return { cards, particles, arrivals, intro, settled, end };
}

/** HUD value shown at time `at`: the pre-reward value until the first arrival, the real one after the last. */
export function rolledValue(from: number, to: number, arrival: ArrivalPlan, at: number): number {
    if (at <= arrival.first) return from;
    if (at >= arrival.last) return to;
    return Math.round(from + (to - from) * (at - arrival.first) / Math.max(1e-6, arrival.last - arrival.first));
}

/** Card pop 0.85 → 1.06 → 1 over cardSeconds; 0 before its start (not shown yet). */
export function cardScale(card: CardPlan, t: RewardTimings, at: number): number {
    const k = (at - card.start) / Math.max(1e-6, t.cardSeconds);
    if (k < 0) return 0;
    if (k >= 1) return 1;
    return k < 0.6 ? 0.85 + 0.21 * (k / 0.6) : 1.06 - 0.06 * ((k - 0.6) / 0.4);
}

/** Target pulse 1 → 1.10 → 1 once, from the first arrival of its kind. */
export function pulseScale(arrival: ArrivalPlan, t: RewardTimings, at: number): number {
    const k = (at - arrival.first) / Math.max(1e-6, t.pulseSeconds);
    return k <= 0 || k >= 1 ? 1 : 1 + 0.1 * Math.sin(Math.PI * k);
}

export type EndReason = 'done' | 'skip' | 'timeout' | 'cancel';

/**
 * Clock of one show. It ends exactly once: at plan end, on a tap after skipAfter (fast-forward),
 * at the timeout guard, or when cancelled (page gone, app hidden, another show).
 */
export class RewardRun {
    private time = 0;
    private ended: EndReason | null = null;
    public constructor(public readonly plan: RewardPlan, private readonly t: RewardTimings, private readonly onEnd: (reason: EndReason) => void) {
        if (!plan.cards.length && !plan.intro) this.end('done');
    }
    public get elapsed(): number { return this.time; }
    public get finished(): boolean { return this.ended !== null; }
    public get reason(): EndReason | null { return this.ended; }
    public get canSkip(): boolean { return !this.ended && this.time >= this.t.skipAfterSeconds; }

    public step(dt: number): void {
        if (this.ended) return;
        this.time += Math.max(0, dt);
        if (this.time >= this.plan.end) this.end('done');
        else if (this.time >= this.t.rewardTimeoutSeconds) this.end('timeout');
    }
    /** A tap on the show; ignored before skipAfter. */
    public skip(): boolean {
        if (!this.canSkip) return false;
        this.end('skip');
        return true;
    }
    public cancel(): void { this.end('cancel'); }
    private end(reason: EndReason): void {
        if (this.ended) return;
        this.ended = reason;
        this.onEnd(reason);
    }
}
