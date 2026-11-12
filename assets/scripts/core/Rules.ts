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
    readonly build: { readonly expPerUpgrade: number; readonly constructionSeconds: number };
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
