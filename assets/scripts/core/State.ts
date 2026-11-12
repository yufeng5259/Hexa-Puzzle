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
    readonly type: 'firstClear' | 'replay' | 'levelUp' | 'buildingMax' | 'mapComplete' | 'welcome' | 'signIn' | 'dailyTask' | 'dailyChest' | 'endlessStage';
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
        guide: { stepId: null, completed: false },
        settings: { music: true, sound: true, vibration: true },
        receipts: {},
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
