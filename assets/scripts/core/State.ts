import type { DailyTaskType, Reward, Rules } from './Rules';

export const SAVE_KEY = 'honey-town.v2';
export const SCHEMA_VERSION = 2;

export interface Attempt {
    readonly attemptId: string;
    readonly levelNo: number;
    readonly mode: 'main' | 'replay';
    /** Opaque puzzle board snapshot owned by the puzzle feature. */
    board: unknown;
}

export interface PendingBuild {
    readonly buildId: string;
    readonly mapId: string;
    readonly buildingId: string;
    readonly fromLevel: number;
    readonly toLevel: number;
    readonly paidCost: number;
}

/** A reward or milestone that was already granted and still waits to be shown. */
export interface DisplayEvent {
    readonly id: string;
    readonly type: 'firstClear' | 'replay' | 'levelUp' | 'buildingMax' | 'mapComplete' | 'welcome' | 'signIn' | 'dailyTask' | 'dailyChest' | 'endlessStage' | 'league';
    readonly reward: Reward;
    readonly detail?: Readonly<Record<string, string | number>>;
}

export interface DailyTask { readonly id: string; readonly type: DailyTaskType; readonly target: number; progress: number; claimed: boolean }

export interface EndlessGame {
    readonly gameId: string;
    /** "q,r" -> colour of a filled cell. */
    board: Record<string, number>;
    /** Shape ids still in the tray; null marks a used slot. */
    tray: (string | null)[];
    score: number;
    /** Deterministic deal seed, advanced on every refill. */
    seed: number;
    /** Points this game added to the week it is in now; restarts at 0 when a running game crosses into a new week. */
    weekId?: string | null;
    weekGain?: number;
    /** Best score before this game started; only a final score strictly above it is a new record. Missing (older save) = the best when read. */
    bestAtStart?: number;
    /** Tool uses left in this game (saved with the board, never refilled on resume). Missing = the configured default. */
    tools?: { swap: number; hammer: number };
}

/** One opponent of a league group; its score over time is rebuilt from the seed (core/League.ts). */
export interface LeagueEntry { readonly botId: string; readonly target: number; readonly seed: number }
/** A daily or weekly group, fixed when created (docs/v2/16 §5.2). */
export interface LeagueGroup {
    readonly periodId: string;
    readonly start: number; readonly end: number;
    readonly tier: number; readonly base: number;
    readonly bots: LeagueEntry[];
}
/** A finished period waiting on S27: rank and reward are fixed at settlement time. */
export interface LeagueSettlement {
    readonly id: string;
    readonly board: 'daily' | 'weekly';
    readonly periodId: string;
    readonly rank: number; readonly size: number; readonly score: number;
    readonly tier: number;
}
export interface LeagueState {
    /** Random id made on the first league use; seeds every group. */
    playerId: string;
    tier: number; stars: number; firstPlaceCount: number;
    /** Points of the current local day / week, added on every endless placement. */
    day: { id: string | null; score: number };
    week: { id: string | null; score: number };
    daily: LeagueGroup | null;
    weekly: LeagueGroup | null;
    /** All-time board: bots drawn once, their bests grow a little each week after createdWeek. */
    allTime: { createdWeek: string; seed: number } | null;
    /** Recent finished day / week scores (> 0), newest last; they set the next group's base score. */
    history: { daily: number[]; weekly: number[] };
    pending: LeagueSettlement[];
}

export interface GameState {
    schemaVersion: number;
    revision: number;
    wallet: { coins: number; hints: number };
    energy: { value: number; anchor: number | null };
    player: { level: number; exp: number };
    mainline: { nextLevelNo: number; cleared: Record<number, true>; attempt: Attempt | null };
    maps: { currentMapId: string; levels: Record<string, Record<string, number>>; completed: Record<string, true> };
    pendingBuild: PendingBuild | null;
    displayQueue: DisplayEvent[];
    signIn: { claimedCount: number; lastClaimDay: string | null };
    daily: { day: string | null; tasks: DailyTask[]; chestClaimed: boolean };
    endless: { best: number; weekId: string | null; weekScore: number; claimedStages: number[]; game: EndlessGame | null };
    league: LeagueState;
    guide: { stepId: string | null; completed: boolean };
    settings: { music: boolean; sound: boolean; vibration: boolean };
    receipts: Record<string, true>;
}

export function createState(rules: Rules): GameState {
    return {
        schemaVersion: SCHEMA_VERSION,
        revision: 0,
        wallet: { coins: rules.initialCoins, hints: rules.initialHints },
        energy: { value: rules.energy.initial, anchor: null },
        player: { level: 1, exp: 0 },
        mainline: { nextLevelNo: 1, cleared: {}, attempt: null },
        maps: { currentMapId: rules.firstMapId, levels: {}, completed: {} },
        pendingBuild: null,
        displayQueue: [],
        signIn: { claimedCount: 0, lastClaimDay: null },
        daily: { day: null, tasks: [], chestClaimed: false },
        endless: { best: 0, weekId: null, weekScore: 0, claimedStages: [], game: null },
        league: createLeague(),
        guide: { stepId: null, completed: false },
        settings: { music: true, sound: true, vibration: true },
        receipts: {},
    };
}

export function createLeague(): LeagueState {
    return {
        playerId: '', tier: 1, stars: 0, firstPlaceCount: 0,
        day: { id: null, score: 0 }, week: { id: null, score: 0 },
        daily: null, weekly: null, allTime: null, history: { daily: [], weekly: [] }, pending: [],
    };
}

export function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }

export function buildingLevel(state: GameState, mapId: string, buildingId: string): number {
    return state.maps.levels[mapId]?.[buildingId] ?? 0;
}

/** Grants a reward exactly once per receipt id. Returns false if already granted. */
export function grant(state: GameState, receiptId: string, value: Reward): boolean {
    if (state.receipts[receiptId]) return false;
    state.receipts[receiptId] = true;
    state.wallet.coins += value.coins;
    state.wallet.hints += value.hints;
    state.energy.value += value.energy;
    return true;
}

export function grantAndShow(state: GameState, event: DisplayEvent): boolean {
    if (!grant(state, event.id, event.reward)) return false;
    state.displayQueue.push(clone(event));
    return true;
}

/** Shape check for a loaded save; anything unexpected starts a fresh game. */
export function isValidState(value: unknown): value is GameState {
    const s = value as GameState;
    return !!s && typeof s === 'object' && s.schemaVersion === SCHEMA_VERSION
        && Number.isSafeInteger(s.revision) && !!s.wallet && Number.isSafeInteger(s.wallet.coins) && Number.isSafeInteger(s.wallet.hints)
        && !!s.energy && Number.isSafeInteger(s.energy.value) && !!s.player && !!s.mainline && Number.isSafeInteger(s.mainline.nextLevelNo)
        && !!s.maps && typeof s.maps.currentMapId === 'string' && Array.isArray(s.displayQueue) && !!s.signIn && !!s.daily
        && !!s.endless && !!s.guide && !!s.settings && !!s.receipts && typeof s.receipts === 'object';
}
