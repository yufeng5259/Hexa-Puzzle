import { clone, GameStateStore, initialiseMap, numberConstant, type GameState, type PersistentAttempt, type ProgressionMeta, type SavedPuzzleSnapshot } from './GameStateStore';

export interface ProgressionEvent {
    type: string; stateRevision: number; commandId?: string; attemptId?: string;
    mapId?: string; slotId?: number; stage?: number; pieceId?: string;
}
export type GuidePhase = 'puzzle' | 'build' | 'welcome' | 'complete';
export type ProgressionErrorCode = 'energy' | 'hints';
/** Recoverable player-facing refusals; views branch on code, never on message text. */
export class ProgressionError extends Error {
    constructor(public readonly code: ProgressionErrorCode, message: string) { super(message); this.name = 'ProgressionError'; }
}
/** Commands combine resource changes and receipts in the same durable write. No Cocos dependency. */
export class GameServices {
    private readonly listeners = new Set<(event: ProgressionEvent) => void>();
    constructor(public readonly store: GameStateStore, private readonly meta: ProgressionMeta,
        private readonly clock: () => number = Date.now,
        private readonly validateSnapshot?: (snapshot: SavedPuzzleSnapshot) => void) {}
    get state(): Readonly<GameState> { return this.store.read(); }
    subscribe(listener: (event: ProgressionEvent) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    private emit(type: string, data: Omit<ProgressionEvent, 'type' | 'stateRevision'> = {}): void {
        const event = { type, stateRevision: this.state.revision, ...data };
        for (const listener of this.listeners) { try { listener(event); } catch { /* Durable commands remain successful. */ } }
    }
    private now(state: GameState | Readonly<GameState>): number { return Math.max(this.clock(), state.lastSeenAt); }
    private recover(state: GameState): void {
        const now = this.now(state), max = numberConstant(this.meta, 'energyMax', 1);
        const interval = numberConstant(this.meta, 'energyRecoverSeconds', 1) * 1000;
        if (state.energy >= max) { state.nextEnergyAt = null; return; }
        if (state.nextEnergyAt === null) state.nextEnergyAt = now + interval;
        if (state.nextEnergyAt <= now) {
            const recovered = Math.floor((now - state.nextEnergyAt) / interval) + 1;
            state.energy = Math.min(max, state.energy + recovered);
            state.nextEnergyAt = state.energy === max ? null : state.nextEnergyAt + recovered * interval;
        }
    }
    refresh(): boolean {
        const current = this.state;
        if (current.nextEnergyAt === null || this.now(current) < current.nextEnergyAt) return false;
        const applied = this.store.transact(null, state => this.recover(state));
        if (applied) this.emit('energy.recovered'); return applied;
    }
    secondsToEnergy(): number { return this.state.nextEnergyAt === null ? 0 : Math.max(0, Math.ceil((this.state.nextEnergyAt - this.now(this.state)) / 1000)); }
    getGuidePhase(): GuidePhase {
        // Completed pre-welcome saves keep their progress and do not receive a retroactive gift.
        if (this.state.guide.completed) return 'complete';
        const first = this.meta.getMainline(1), mapId = this.meta.getConstant<string>('firstMapId');
        if (!this.state.receipts['level-first-win:' + first.puzzleId]) return 'puzzle';
        if (!(this.state.buildings[mapId]?.['1'] >= 1 && this.state.receipts['upgrade:' + mapId + ':1:1'])) return 'build';
        return this.state.receipts['welcome-reward:first-session'] ? 'complete' : 'welcome';
    }
    private syncGuide(state: GameState): void {
        const first = this.meta.getMainline(1), map = this.meta.getConstant<string>('firstMapId');
        state.guide.completed = state.guide.completed || (!!state.receipts['level-first-win:' + first.puzzleId]
            && state.buildings[map]?.['1'] >= 1 && !!state.receipts['upgrade:' + map + ':1:1']
            && !!state.receipts['welcome-reward:first-session']);
        if (state.guide.completed) state.guide.stepId = null;
    }
    reconcileGuide(): boolean {
        const completed = this.getGuidePhase() === 'complete';
        if (this.state.guide.completed === completed) return false;
        return this.store.transact(null, state => this.syncGuide(state));
    }
    setGuideStep(stepId: string | null): boolean {
        if (this.state.guide.stepId === stepId) return false;
        return this.store.transact(null, state => { state.guide.stepId = stepId; this.syncGuide(state); });
    }
    claimWelcome(): boolean {
        const key = 'welcome-reward:first-session';
        if (this.state.guide.completed || this.state.receipts[key]) return false;
        if (this.getGuidePhase() !== 'welcome') throw new Error('请先完成拼图与首次建造');
        const applied = this.store.transact(key, state => {
            this.grant(state, this.meta.getConstant<string>('welcomeRewardId'));
            state.receipts[key] = true; this.syncGuide(state);
        });
        if (applied) this.emit('welcome.rewardCommitted', { commandId: key, mapId: this.state.currentMapId });
        return applied;
    }
    startOrResume(): Readonly<PersistentAttempt> {
        if (this.state.activeAttempt?.status === 'active') return this.state.activeAttempt;
        this.refresh();
        if (this.state.currentLevelNo > this.meta.getMainlineCount()) throw new Error('当前内容已完成');
        const row = this.meta.getMainline(this.state.currentLevelNo);
        const tutorial = row.levelNo === 1 && this.getGuidePhase() === 'puzzle';
        if (!tutorial && this.state.energy <= 0) throw new ProgressionError('energy', '体力不足');
        this.store.transact(null, state => {
            state.attemptSequence++;
            state.activeAttempt = { attemptId: 'attempt-' + state.attemptSequence + '-' + this.now(state), puzzleId: row.puzzleId,
                levelNo: row.levelNo, snapshot: null, status: 'active', tutorial };
        });
        return this.state.activeAttempt!;
    }
    saveAttempt(snapshot: SavedPuzzleSnapshot): boolean {
        const attempt = this.state.activeAttempt;
        if (!attempt || attempt.attemptId !== snapshot.attemptId || attempt.puzzleId !== snapshot.levelId) throw new Error('当前关卡身份不匹配');
        if (attempt.snapshot?.revision === snapshot.revision && JSON.stringify(attempt.snapshot) === JSON.stringify(snapshot)) return false;
        if (attempt.status !== 'active') throw new Error('本局已结束');
        if (attempt.snapshot && snapshot.revision <= attempt.snapshot.revision) throw new Error('过期的拼图快照');
        if (this.validateSnapshot) this.validateSnapshot(snapshot);
        else if (snapshot.status !== 'active') throw new Error('缺少拼图规则验证，不能结算');
        const newlyHinted = !!snapshot.activeHintPieceId && snapshot.activeHintPieceId !== attempt.snapshot?.activeHintPieceId;
        const applied = this.store.transact(null, state => {
            if (newlyHinted) { if (state.hints <= 0) throw new ProgressionError('hints', '提示不足'); state.hints--; }
            state.activeAttempt!.snapshot = clone(snapshot);
            // The validator above already proved this exact snapshot.
            if (snapshot.status === 'completed') this.win(state, true);
            else if (snapshot.status === 'failed') this.end(state, 'failed');
        });
        if (newlyHinted) this.emit('puzzle.hintCommitted', { attemptId: snapshot.attemptId, pieceId: snapshot.activeHintPieceId! });
        const pieceId = Object.keys(snapshot.placements).find(id => JSON.stringify(snapshot.placements[id]) !== JSON.stringify(attempt.snapshot?.placements[id]));
        if (pieceId) this.emit('puzzle.placementCommitted', { attemptId: snapshot.attemptId, pieceId });
        if (snapshot.status === 'completed') this.emit('puzzle.winCommitted', { attemptId: snapshot.attemptId });
        else if (snapshot.status === 'failed') this.emit('puzzle.failCommitted', { attemptId: snapshot.attemptId });
        else if (!pieceId) this.emit('puzzle.snapshotCommitted', { attemptId: snapshot.attemptId });
        return applied;
    }
    private grant(state: GameState, rewardId: string): void {
        const reward = this.meta.getReward(rewardId); this.recover(state);
        state.coins += reward.coins; state.hints += reward.hints;
        state.energy = Math.min(numberConstant(this.meta, 'energyMax', 1), state.energy + reward.energy);
        if (state.energy === numberConstant(this.meta, 'energyMax', 1)) state.nextEnergyAt = null;
    }
    private win(state: GameState, validated = false): void {
        const attempt = state.activeAttempt!;
        if (attempt.snapshot?.status !== 'completed') throw new Error('关卡尚未完成');
        if (!this.validateSnapshot) throw new Error('缺少拼图规则验证，不能结算');
        if (!validated) this.validateSnapshot(attempt.snapshot);
        const key = 'level-first-win:' + attempt.puzzleId;
        if (!state.receipts[key]) {
            this.grant(state, this.meta.getMainline(attempt.levelNo).rewardId); state.receipts[key] = true;
        }
        attempt.status = 'completed'; state.currentLevelNo = Math.max(state.currentLevelNo, attempt.levelNo + 1); this.syncGuide(state);
    }
    completeAttempt(attemptId: string): boolean {
        const attempt = this.state.activeAttempt;
        if (!attempt || attempt.attemptId !== attemptId) throw new Error('当前关卡身份不匹配');
        if (attempt.status === 'completed') return false;
        const applied = this.store.transact(null, state => this.win(state));
        if (applied) this.emit('puzzle.winCommitted', { attemptId }); return applied;
    }
    private end(state: GameState, reason: 'failed' | 'abandoned' | 'restart'): void {
        const attempt = state.activeAttempt!, key = 'attempt-end:' + attempt.attemptId;
        if (state.receipts[key]) return;
        this.recover(state);
        if (!attempt.tutorial) {
            const wasFull = state.energy === numberConstant(this.meta, 'energyMax', 1);
            state.energy = Math.max(0, state.energy - numberConstant(this.meta, 'energyFailureCost'));
            if (wasFull && state.energy < numberConstant(this.meta, 'energyMax', 1)) state.nextEnergyAt = this.now(state) + numberConstant(this.meta, 'energyRecoverSeconds', 1) * 1000;
        }
        state.receipts[key] = true; attempt.status = reason === 'failed' ? 'failed' : 'abandoned';
    }
    endAttempt(attemptId: string, reason: 'failed' | 'abandoned' | 'restart' = 'abandoned'): boolean {
        const attempt = this.state.activeAttempt;
        if (!attempt || attempt.attemptId !== attemptId) throw new Error('当前关卡身份不匹配');
        if (attempt.status !== 'active' || this.state.receipts['attempt-end:' + attemptId]) return false;
        const applied = this.store.transact(null, state => this.end(state, reason));
        if (applied) this.emit('puzzle.endCommitted', { attemptId }); return applied;
    }
    upgrade(mapId: string, slotId: number, expectedStage: number): boolean {
        const key = 'upgrade:' + mapId + ':' + slotId + ':' + (expectedStage + 1);
        if (this.state.receipts[key]) return false;
        const applied = this.store.transact(key, state => {
            if (mapId !== state.currentMapId) throw new Error('只能建设当前地图');
            const slot = this.meta.getMapBuildings(mapId).find(row => row.slotId === slotId);
            if (!slot) throw new Error('建筑位置不存在');
            if (state.buildings[mapId][String(slotId)] !== expectedStage) throw new Error('建筑等级已变化');
            const next = this.meta.getBuildingStage(slot.buildingId, expectedStage + 1);
            if (state.coins < next.cost) throw new Error('蜜蜂币不足');
            state.coins -= next.cost; state.buildings[mapId][String(slotId)]++;
            // transact appends the receipt after the callback; make it visible for the same guide transaction.
            state.receipts[key] = true; this.syncGuide(state);
        });
        if (applied) this.emit('building.upgradeCommitted', { commandId: key, mapId, slotId, stage: expectedStage + 1 });
        return applied;
    }
    mapProgress(mapId = this.state.currentMapId): { current: number; total: number; complete: boolean } {
        let current = 0, total = 0;
        for (const slot of this.meta.getMapBuildings(mapId)) {
            current += this.state.buildings[mapId]?.[String(slot.slotId)] || 0;
            total += Math.max(...this.meta.getBuildingStages(slot.buildingId).map(row => row.stage));
        }
        return { current, total, complete: current === total };
    }
    claimMap(mapId = this.state.currentMapId): boolean {
        const key = 'map-reward:' + mapId;
        if (this.state.receipts[key]) return false;
        if (mapId !== this.state.currentMapId || !this.mapProgress(mapId).complete) throw new Error('地图尚未完成');
        const applied = this.store.transact(key, state => {
            const map = this.meta.getMap(mapId); this.grant(state, map.completionRewardId);
            if (map.nextMapId) { initialiseMap(state, this.meta, map.nextMapId); state.currentMapId = map.nextMapId; }
        });
        if (applied) this.emit('map.rewardCommitted', { commandId: key, mapId }); return applied;
    }
    updateSettings(patch: Partial<GameState['settings']>): boolean {
        return this.store.transact(null, state => { Object.assign(state.settings, patch); });
    }
}
