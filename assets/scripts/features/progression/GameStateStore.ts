export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface SavedPuzzleSnapshot {
    readonly attemptId: string; readonly levelId: string; readonly moves: number;
    readonly status: 'active' | 'completed' | 'failed'; readonly revision: number;
    readonly placements: Readonly<Record<string, { readonly q: number; readonly r: number }>>;
    readonly selectedPieceId: string | null; readonly placementOrder?: readonly string[];
    readonly activeHintPieceId?: string | null;
}
export interface PersistentAttempt {
    attemptId: string; puzzleId: string; levelNo: number; snapshot: SavedPuzzleSnapshot | null;
    status: 'active' | 'completed' | 'failed' | 'abandoned'; tutorial: boolean;
}
export interface GameState {
    schemaVersion: 1; revision: number; attemptSequence: number;
    coins: number; hints: number; energy: number; nextEnergyAt: number | null; lastSeenAt: number;
    currentLevelNo: number; currentMapId: string; buildings: Record<string, Record<string, number>>;
    receipts: Record<string, true>; activeAttempt: PersistentAttempt | null;
    guide: { groupId: string; stepId: string | null; completed: boolean };
    settings: { music: boolean; sound: boolean; vibration: boolean; language: string };
}
export interface ProgressionMeta {
    getConstant<T = unknown>(id: string): T;
    getMap(id: string): { id: string; nextMapId: string | null; completionRewardId: string };
    getMapBuildings(mapId: string): readonly { slotId: number; buildingId: string }[];
    getBuildingStage(buildingId: string, stage: number): { stage: number; cost: number };
    getBuildingStages(buildingId: string): readonly { stage: number; cost: number }[];
    getMainline(levelNo: number): { levelNo: number; puzzleId: string; rewardId: string };
    getMainlineCount(): number;
    getReward(id: string): { coins: number; energy: number; hints: number };
}
export const GAME_SAVE_KEY = 'honey-garden.first-release.v1';
export function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function freeze<T>(value: T): T {
    if (value && typeof value === 'object') {
        Object.values(value as object).forEach(freeze); Object.freeze(value);
    }
    return value;
}
function natural(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 0; }
export function numberConstant(meta: ProgressionMeta, id: string, minimum = 0): number {
    const value = meta.getConstant<number>(id);
    if (!natural(value) || value < minimum) throw new Error('Invalid constant: ' + id);
    return value;
}
export function initialiseMap(state: GameState, meta: ProgressionMeta, mapId: string): void {
    meta.getMap(mapId);
    if (!state.buildings[mapId]) state.buildings[mapId] = {};
    for (const slot of meta.getMapBuildings(mapId)) {
        if (state.buildings[mapId][String(slot.slotId)] === undefined) state.buildings[mapId][String(slot.slotId)] = 0;
    }
}
/** Only authority for durable state. The synchronous storage adapter must throw on write failure. */
export class GameStateStore {
    private state: GameState;
    private readonly listeners = new Set<(state: Readonly<GameState>) => void>();
    private committing = false;
    constructor(private readonly storage: StoragePort, private readonly meta: ProgressionMeta,
        private readonly clock: () => number = Date.now, public readonly key = GAME_SAVE_KEY) {
        const raw = storage.getItem(key);
        if (raw !== null) {
            try { this.state = freeze(this.validate(JSON.parse(raw))); }
            catch (error) {
                // Preserve both the original key and a recovery copy. Never silently replace a player's save.
                storage.setItem(key + '.corrupt.' + Math.floor(clock()), raw);
                throw new Error('存档无法读取，原始数据已保留：' + String(error));
            }
        } else {
            const now = this.now(); const max = numberConstant(meta, 'energyMax', 1);
            const energy = numberConstant(meta, 'energyInitial');
            if (energy > max) throw new Error('Initial energy exceeds maximum');
            const firstMap = meta.getConstant<string>('firstMapId');
            const initial: GameState = { schemaVersion: 1, revision: 0, attemptSequence: 0,
                coins: numberConstant(meta, 'initialCoins'), hints: numberConstant(meta, 'initialHints'), energy,
                nextEnergyAt: energy < max ? now + numberConstant(meta, 'energyRecoverSeconds', 1) * 1000 : null,
                lastSeenAt: now, currentLevelNo: 1, currentMapId: firstMap, buildings: {}, receipts: {}, activeAttempt: null,
                guide: { groupId: meta.getConstant<string>('firstGuideGroupId'), stepId: null, completed: false },
                settings: { music: true, sound: true, vibration: true, language: 'zh-CN' } };
            initialiseMap(initial, meta, firstMap);
            this.validate(initial); storage.setItem(key, JSON.stringify(initial)); this.state = freeze(initial);
        }
    }
    private now(): number { const now = this.clock(); if (!natural(now)) throw new Error('Invalid clock'); return now; }
    read(): Readonly<GameState> { return this.state; }
    subscribe(listener: (state: Readonly<GameState>) => void): () => void {
        this.listeners.add(listener); return () => this.listeners.delete(listener);
    }
    transact(commandId: string | null, update: (draft: GameState) => void): boolean {
        if (this.committing) throw new Error('Reentrant state transaction');
        if (commandId && this.state.receipts[commandId]) return false;
        this.committing = true;
        try {
            const draft = clone(this.state); update(draft);
            if (commandId) draft.receipts[commandId] = true;
            draft.lastSeenAt = Math.max(draft.lastSeenAt, this.now()); draft.revision = this.state.revision + 1;
            this.validate(draft);
            this.storage.setItem(this.key, JSON.stringify(draft));
            this.state = freeze(draft);
        } finally { this.committing = false; }
        for (const listener of this.listeners) { try { listener(this.state); } catch { /* A view cannot undo a committed save. */ } }
        return true;
    }
    private validate(input: unknown): GameState {
        const state = input as GameState;
        if (!state || state.schemaVersion !== 1) throw new Error('Unsupported save version');
        for (const name of ['revision', 'attemptSequence', 'coins', 'hints', 'energy', 'lastSeenAt'] as const)
            if (!natural(state[name])) throw new Error('Invalid save field ' + name);
        if (state.energy > numberConstant(this.meta, 'energyMax', 1)) throw new Error('Energy exceeds maximum');
        if (state.nextEnergyAt !== null && !natural(state.nextEnergyAt)) throw new Error('Invalid recovery time');
        if (state.energy < numberConstant(this.meta, 'energyMax', 1) && state.nextEnergyAt === null) throw new Error('Missing recovery time');
        if (!Number.isInteger(state.currentLevelNo) || state.currentLevelNo < 1 || state.currentLevelNo > this.meta.getMainlineCount() + 1) throw new Error('Saved level unavailable');
        this.meta.getMap(state.currentMapId);
        if (!state.buildings || !state.receipts || !state.guide || typeof state.guide.completed !== 'boolean'
            || typeof state.guide.groupId !== 'string' || (state.guide.stepId !== null && typeof state.guide.stepId !== 'string')) throw new Error('Missing save state');
        if (Object.values(state.receipts).some(value => value !== true)) throw new Error('Invalid receipt');
        for (const [mapId, levels] of Object.entries(state.buildings)) {
            this.meta.getMap(mapId);
            for (const slot of this.meta.getMapBuildings(mapId)) {
                const stage = levels[String(slot.slotId)];
                if (!natural(stage)) throw new Error('Invalid building stage');
                this.meta.getBuildingStage(slot.buildingId, stage);
            }
        }
        if (!state.buildings[state.currentMapId]) throw new Error('Current map missing buildings');
        if (!state.settings || ['music', 'sound', 'vibration'].some(k => typeof state.settings[k as 'music'] !== 'boolean') || typeof state.settings.language !== 'string') throw new Error('Invalid settings');
        const attempt = state.activeAttempt;
        if (attempt) {
            if (!attempt.attemptId || typeof attempt.tutorial !== 'boolean' || !['active','completed','failed','abandoned'].includes(attempt.status)) throw new Error('Invalid attempt');
            if (this.meta.getMainline(attempt.levelNo).puzzleId !== attempt.puzzleId) throw new Error('Attempt content unavailable');
            if (attempt.snapshot) {
                const snapshot = attempt.snapshot;
                if (snapshot.attemptId !== attempt.attemptId || snapshot.levelId !== attempt.puzzleId || !natural(snapshot.moves)
                    || !natural(snapshot.revision) || !['active','completed','failed'].includes(snapshot.status)
                    || !snapshot.placements || Object.values(snapshot.placements).some(cell => !cell || !Number.isSafeInteger(cell.q) || !Number.isSafeInteger(cell.r))
                    || (snapshot.selectedPieceId !== null && typeof snapshot.selectedPieceId !== 'string')
                    || (snapshot.activeHintPieceId != null && typeof snapshot.activeHintPieceId !== 'string')
                    || (snapshot.placementOrder && (!Array.isArray(snapshot.placementOrder) || snapshot.placementOrder.some(id => typeof id !== 'string')))) throw new Error('Invalid attempt snapshot');
            }
        }
        return state;
    }
}
