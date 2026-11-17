/**
 * All tunable v2 numbers in one plain-data shape. Built from game-config.json
 * (Excel) at boot; core logic never reads constants from anywhere else.
 */
export interface Reward { readonly coins: number; readonly energy: number; readonly hints: number }

export interface MainlineLevel {
    readonly levelNo: number;
    readonly puzzleId: string;
    readonly kind: 'normal' | 'challenge';
    readonly firstClearRewardId: string;
    readonly replayRewardId: string;
}

export interface BuildingRule {
    readonly id: string;
    /** costs[i] is the price of upgrading to level i+1. */
    readonly costs: readonly number[];
    readonly maxRewardId: string | null;
}

export interface MapRule {
    readonly id: string;
    readonly nextMapId: string | null;
    readonly completionRewardId: string | null;
    readonly buildings: readonly BuildingRule[];
}

export type DailyTaskType = 'win' | 'build' | 'endlessLines' | 'endlessScore' | 'placePiece';
export interface DailyTaskRule {
    readonly id: string;
    readonly type: DailyTaskType;
    readonly target: number;
    readonly rewardId: string;
    /** fixed tasks always appear; rotate tasks fill the last slot. */
    readonly slot: 'fixed' | 'rotate' | 'fallback';
    readonly weight: number;
}

export interface EndlessShape { readonly id: string; readonly cells: readonly (readonly [number, number])[]; readonly weight: number; readonly color: number }

export interface Rules {
    readonly initialCoins: number;
    readonly initialHints: number;
    readonly energy: { readonly max: number; readonly initial: number; readonly recoverSeconds: number; readonly startCost: number; readonly firstLevelFree: boolean };
    readonly rewards: Readonly<Record<string, Reward>>;
    readonly welcomeRewardId: string;
    /** Building on the first map the first-run guide asks the player to upgrade. */
    readonly guideBuildingId: string;
    readonly mainline: readonly MainlineLevel[];
    readonly maps: readonly MapRule[];
    readonly firstMapId: string;
    readonly build: {
        readonly expPerUpgrade: number; readonly constructionSeconds: number;
        /**
         * Construction animation (features/fx/BuildTimeline): phase boundaries as fractions of
         * constructionSeconds, the sparkle tail in seconds, bee height as a fraction of the building width.
         */
        readonly fx: {
            readonly scaffoldEnd: number; readonly carryStart: number; readonly carryEnd: number; readonly hammerStart: number;
            readonly cloudStart: number; readonly revealAt: number; readonly sparkleSeconds: number; readonly beeFraction: number;
            /** A build resumed after a restart starts here (short finish). */
            readonly resumeFrom: number;
        };
    };
    /** Presentation timings in seconds and the coin particle cap (Constants anim*). Shows saved results only. */
    readonly anim: {
        readonly progressSeconds: number;
        /** Reward card pop and the gap between cards. */
        readonly cardSeconds: number; readonly cardStaggerSeconds: number;
        /** Particles scatter around the card, then fly to the HUD target, which pulses once. */
        readonly scatterSeconds: number; readonly flySeconds: number; readonly pulseSeconds: number;
        /** A tap fast-forwards after skipAfter; a show never runs past rewardTimeout. */
        readonly skipAfterSeconds: number; readonly rewardTimeoutSeconds: number;
        readonly chestShakeSeconds: number; readonly chestOpenSeconds: number;
        readonly coinParticlesMax: number;
        /**
         * Puzzle win (docs/v2/10 §4.1): the board punches and the screen flashes (hold, flash), the outer
         * ring lights up and a shine sweeps the shape (wave), the celebration (ribbon, confetti, fireworks,
         * bee) starts at celebrateAt, coins fly at coinsAt, the bottom bar slides in at barAt over barSeconds.
         */
        readonly winHoldSeconds: number; readonly winWaveSeconds: number; readonly winFlashSeconds: number;
        readonly winCelebrateAt: number; readonly winCelebrateSeconds: number; readonly winCoinsAt: number;
        readonly winBarAt: number; readonly winBarSeconds: number; readonly winConfettiCount: number;
        /** Result dialog pop-in before its reward show; failure dim and sway; board fade on leave/restart. */
        readonly resultEnterSeconds: number; readonly failSeconds: number; readonly boardFadeSeconds: number;
        /** First guided win plays in full, but never longer than this before its buttons work. */
        readonly firstWinLimitSeconds: number;
        /** Endless placement: piece settles, full lines light up, then clear along their axis; "+score" floats; new tray slides in. */
        readonly endlessSettleSeconds: number; readonly endlessHighlightSeconds: number; readonly endlessClearSeconds: number;
        readonly endlessScoreSeconds: number; readonly endlessRefillSeconds: number;
        /** Endless end: the board dims, S21 rolls the score up, a new record badge pops with a little confetti. */
        readonly endlessDimSeconds: number; readonly scoreRollSeconds: number; readonly recordSeconds: number;
        /** Endless tools: old tray shrinks out, the new one pops in staggered; the hammer drops on a cell, which shatters. */
        readonly endlessSwapOutSeconds: number; readonly endlessSwapInSeconds: number;
        readonly endlessHammerSeconds: number; readonly endlessShatterSeconds: number;
    };
    /** expToNext[i] is the exp needed to go from level i+1 to i+2; the last entry repeats. */
    readonly levels: readonly { readonly expToNext: number; readonly rewardId: string | null }[];
    readonly signIn: readonly string[];
    readonly daily: { readonly tasks: readonly DailyTaskRule[]; readonly chestRewardId: string; readonly count: number };
    readonly endless: {
        readonly unlockAfterLevelNo: number;
        readonly radius: number;
        readonly traySize: number;
        readonly shapes: readonly EndlessShape[];
        readonly score: { readonly perPlaced: number; readonly perCleared: number; readonly perLine: number; readonly multiLine: number };
        readonly stages: readonly { readonly score: number; readonly rewardId: string }[];
        /** Free uses per new game of "换一手" and "单格锤" (0 hides the tool) and the bounded redraws of one swap. */
        readonly tools: { readonly swap: number; readonly hammer: number; readonly swapRetries: number };
    };
}

export function reward(rules: Rules, id: string): Reward {
    const value = rules.rewards[id];
    if (!value) throw new Error(`Unknown reward ${id}`);
    return value;
}

export function mapRule(rules: Rules, id: string): MapRule {
    const value = rules.maps.find(map => map.id === id);
    if (!value) throw new Error(`Unknown map ${id}`);
    return value;
}

export function mainlineLevel(rules: Rules, levelNo: number): MainlineLevel {
    const value = rules.mainline[levelNo - 1];
    if (!value || value.levelNo !== levelNo) throw new Error(`Unknown mainline level ${levelNo}`);
    return value;
}

/** Thrown when a player action is not allowed; the state is left untouched. */
export class RuleError extends Error {
    public constructor(public readonly code: 'energy' | 'coins' | 'pending' | 'locked' | 'maxed' | 'claimed' | 'invalid', message: string) {
        super(message);
        this.name = 'RuleError';
    }
}
