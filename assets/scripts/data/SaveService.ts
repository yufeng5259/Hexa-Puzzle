import type { LevelCatalog, LevelMapDefinition } from './LevelTypes';
import { isRewardRequest, type NativeRewardReceipt, type RewardAcknowledgement } from '../ads/AdProtocol';
import { acknowledgeReceipt, closeUnshown, outstandingAcknowledgements, placementAvailability, settleReceipt } from './RewardTransactions';
import { betterMetric, catalogMaps, clone, defaultSave, emptyLevel, metric, normalizeSave, progressCursor, validLocalDate, validateAttempt } from './SaveMigration';
import { SAVE_BACKUP_KEY, SAVE_KEY, SAVE_VERSION, SaveDataError, type AttemptInput, type AttemptSave, type CompletionInput, type CompletionMutationKind, type CompletionResult, type LegacyLevelMap, type PendingReward, type PlacementAvailability, type RewardRequest, type RewardSettlementResult, type SaveData, type StarCount, type StorageLike } from './SaveTypes';
export * from './SaveTypes';
export { defaultSave, normalizeSave, validLocalDate } from './SaveMigration';

export class SaveService {
  private data: SaveData;
  private readonly maps: LevelMapDefinition[];
  public constructor(private readonly storage: StorageLike, private readonly catalog: LevelCatalog, private readonly legacyMap: LegacyLevelMap) {
    this.maps = catalogMaps(catalog);
    this.data = this.load();
  }
  private backup(raw: string): void {
    const existing = this.storage.getItem(SAVE_BACKUP_KEY);
    if (existing === null) this.storage.setItem(SAVE_BACKUP_KEY, raw);
    else if (existing !== raw) {
      // Preserve the original migration backup when a later save is damaged.
      let suffix = 1;
      while (true) {
        const key = `${SAVE_BACKUP_KEY}.${suffix}`;
        const saved = this.storage.getItem(key);
        if (saved === raw) return;
        if (saved === null) { this.storage.setItem(key, raw); return; }
        suffix += 1;
      }
    }
  }
  private load(): SaveData {
    const raw = this.storage.getItem(SAVE_KEY);
    if (raw === null) {
      const initial = defaultSave(this.catalog);
      this.storage.setItem(SAVE_KEY, JSON.stringify(initial));
      return initial;
    }
    let source: unknown;
    try { source = JSON.parse(raw); }
    catch { this.backup(raw); throw new SaveDataError('malformed_save_json'); }
    if (source && typeof source === 'object' && typeof (source as { version?: unknown }).version === 'number' && (source as { version: number }).version > SAVE_VERSION) throw new SaveDataError('future_save_version');
    const isV3 = source !== null && typeof source === 'object' && (source as { version?: number }).version === SAVE_VERSION;
    if (!isV3) this.backup(raw);
    let normalized: SaveData;
    try { normalized = normalizeSave(source, this.catalog, this.legacyMap); }
    catch (error) { this.backup(raw); throw error; }
    if (!isV3) {
      this.storage.setItem(SAVE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  }
  private commit(next: SaveData): void {
    this.storage.setItem(SAVE_KEY, JSON.stringify(next));
    this.data = next;
  }
  private map(mapId: string): LevelMapDefinition {
    const map = this.maps.find((value) => value.id === mapId);
    if (!map) throw new RangeError('Invalid map ID');
    return map;
  }
  private newIdentity(next: SaveData, kind: 'attempt' | 'reward' = 'attempt'): string {
    const sequence = next.identity.nextSequence;
    if (!Number.isSafeInteger(sequence + 1)) throw new SaveDataError('identity_exhausted');
    next.identity.nextSequence += 1;
    return `${next.identity.installationId}:${kind}:${sequence}`;
  }
  public nextRewardRequestId(): string {
    const next = this.snapshot();
    const identity = this.newIdentity(next, 'reward');
    this.commit(next);
    return identity;
  }
  public getPlacementAvailability(placementId: RewardRequest['placementId'], attemptId: string): PlacementAvailability {
    return placementAvailability(this.data, placementId, attemptId);
  }
  public registerRewardRequest(placementId: RewardRequest['placementId'], attemptId: string): RewardRequest {
    const availability = this.getPlacementAvailability(placementId, attemptId);
    if (!availability.available) throw new SaveDataError(availability.reason);
    const next = this.snapshot();
    const current = next.currentAttempt!;
    const request: RewardRequest = {
      requestId: this.newIdentity(next, 'reward'), placementId, attemptId,
      mapId: current.mapId, levelId: current.levelId, contentVersion: current.contentVersion,
      rewardSpec: placementId === 'hint_refill' ? { kind: 'hints', amount: 1 } : { kind: 'continue', bonusMoves: 3 },
    };
    if (!isRewardRequest(request)) throw new SaveDataError('invalid_reward_request');
    if (Object.prototype.hasOwnProperty.call(next.rewards.pending, request.requestId)
      || Object.prototype.hasOwnProperty.call(next.rewards.terminal, request.requestId)) throw new SaveDataError('duplicate_reward_identity');
    next.rewards.pending[request.requestId] = { ...request, state: 'registered' };
    this.commit(next);
    return clone(request);
  }
  public markAwaiting(requestId: string): void {
    if (!Object.prototype.hasOwnProperty.call(this.data.rewards.pending, requestId)) {
      if (Object.prototype.hasOwnProperty.call(this.data.rewards.terminal, requestId)) return;
      throw new SaveDataError('unknown_reward_request');
    }
    if (this.data.rewards.pending[requestId].state === 'awaiting_evidence') return;
    const next = this.snapshot();
    next.rewards.pending[requestId].state = 'awaiting_evidence';
    this.commit(next);
  }
  public pendingRequestSnapshots(): PendingReward[] {
    return Object.keys(this.data.rewards.pending).map((id) => clone(this.data.rewards.pending[id]));
  }
  public settleRewardReceipt(receipt: NativeRewardReceipt, resumableAttemptId: string | null = null): RewardSettlementResult {
    const next = this.snapshot();
    const decision = settleReceipt(next, receipt, resumableAttemptId);
    if (decision.changed) this.commit(next);
    return { status: decision.status, settlement: decision.settlement, ack: decision.ack, save: this.snapshot() };
  }
  public markNativeAcknowledged(requestId: string, receiptId: string, disposition: RewardAcknowledgement['disposition']): void {
    const next = this.snapshot();
    if (acknowledgeReceipt(next, { requestId, receiptId, disposition })) this.commit(next);
  }
  public unacknowledgedRewardAcks(): RewardAcknowledgement[] { return outstandingAcknowledgements(this.data); }
  public closeUnshownRequest(requestId: string, reason: string): void {
    const next = this.snapshot();
    if (closeUnshown(next, requestId, reason)) this.commit(next);
  }
  public pruneRewardHistory(keepSettled = 100): number {
    if (!Number.isSafeInteger(keepSettled) || keepSettled < 0) throw new SaveDataError('invalid_reward_history_limit');
    const eligible = Object.keys(this.data.rewards.terminal).filter((id) => {
      const request = this.data.rewards.terminal[id];
      return request.state === 'settled' && request.nativeAcknowledged
        && request.attemptId !== this.data.currentAttempt?.attemptId;
    });
    const removed = eligible.slice(0, Math.max(0, eligible.length - keepSettled));
    if (removed.length) {
      const next = this.snapshot();
      for (const id of removed) delete next.rewards.terminal[id];
      this.commit(next);
    }
    return removed.length;
  }
  public snapshot(): SaveData { return clone(this.data); }
  public reload(): SaveData { const loaded = this.load(); this.data = loaded; return this.snapshot(); }
  public persist(): void { this.commit(clone(this.data)); }
  public getMaxCompleted(mapId: string): number { return this.data.maps[mapId]?.maxCompleted ?? 0; }
  public canPlay(mapId: string, levelIndex: number): boolean {
    const map = this.maps.find((value) => value.id === mapId);
    return Boolean(map && Number.isInteger(levelIndex) && levelIndex >= 0 && levelIndex < map.levelCount
      && this.data.maps[mapId].unlockedLevelIds.indexOf(map.levelIds![levelIndex]) >= 0);
  }
  public completeLevel(mapIdOrInput: string | CompletionInput, maybeLevelIndex?: number): CompletionResult {
    const input: CompletionInput = typeof mapIdOrInput === 'string' ? { mapId: mapIdOrInput, levelIndex: maybeLevelIndex as number } : mapIdOrInput;
    if (!input) throw new RangeError('Invalid completion');
    const mapDefinition = this.map(input.mapId);
    if (!Number.isInteger(input.levelIndex) || input.levelIndex < 0 || input.levelIndex >= mapDefinition.levelCount) throw new RangeError('Invalid level index');
    if (!this.canPlay(input.mapId, input.levelIndex)) throw new SaveDataError('level_locked');
    const levelId = mapDefinition.levelIds![input.levelIndex];
    if (input.attemptId && (this.data.currentAttempt?.attemptId !== input.attemptId || this.data.currentAttempt.levelId !== levelId)) throw new SaveDataError('stale_attempt');
    const next = this.snapshot();
    const map = next.maps[input.mapId];
    const previous = map.levels[levelId] ? clone(map.levels[levelId]) : null;
    const current = previous ? clone(previous) : emptyLevel();
    const firstCompletion = !current.completed;
    const stars = Number.isInteger(input.stars) && input.stars! >= 0 && input.stars! <= 3 ? input.stars! : 1;
    current.completed = true;
    current.unassisted = current.unassisted || (input.hintsUsed === 0 && input.continuesUsed === 0);
    current.bestStars = Math.max(current.bestStars, stars) as StarCount;
    current.bestMoves = betterMetric(current.bestMoves, metric(input.moves));
    current.bestErrors = betterMetric(current.bestErrors, metric(input.errors));
    current.bestHintsUsed = betterMetric(current.bestHintsUsed, metric(input.hintsUsed));
    map.levels[levelId] = current;
    const nextId = mapDefinition.levelIds![input.levelIndex + 1];
    if (nextId && map.unlockedLevelIds.indexOf(nextId) < 0) map.unlockedLevelIds.push(nextId);
    map.maxCompleted = progressCursor(map, mapDefinition.levelIds!);
    if (next.currentAttempt?.mapId === input.mapId && next.currentAttempt.levelId === levelId) next.currentAttempt = null;
    const improvedStars = previous !== null && current.bestStars > previous.bestStars;
    const improvedMetrics = previous !== null && (current.bestMoves !== previous.bestMoves || current.bestErrors !== previous.bestErrors || current.bestHintsUsed !== previous.bestHintsUsed || current.unassisted !== previous.unassisted);
    const mutationKind: CompletionMutationKind = firstCompletion ? 'first-completion' : improvedStars ? 'improved-stars' : improvedMetrics ? 'improved-metrics' : 'duplicate';
    this.commit(next);
    return { firstCompletion, mutationKind, previous, current: clone(current), save: this.snapshot() };
  }
  public consumeHint(): boolean {
    if (this.data.hints === 0) return false;
    const next = this.snapshot();
    next.hints -= 1;
    this.commit(next);
    return true;
  }
  public consumeHintForAttempt(attempt: AttemptSave): boolean {
    const validated = validateAttempt(attempt, this.catalog);
    const current = this.requireCurrentAttempt(validated);
    if (current.status !== 'active' || validated.status !== 'active' || current.puzzle.won || validated.puzzle.won) throw new SaveDataError('attempt_not_active');
    if (validated.moves !== current.moves || validated.errors !== current.errors
      || validated.continuesUsed !== current.continuesUsed || validated.bonusMoves !== current.bonusMoves
      || validated.hintRefills !== current.hintRefills || JSON.stringify(validated.puzzle) !== JSON.stringify(current.puzzle)) throw new SaveDataError('invalid_hint_mutation');
    if (validated.activeHintPieceId === null) throw new SaveDataError('invalid_hint_mutation');
    if (current.activeHintPieceId !== null) {
      if (validated.activeHintPieceId !== current.activeHintPieceId
        || (validated.hintsUsed !== current.hintsUsed && validated.hintsUsed !== current.hintsUsed + 1)) throw new SaveDataError('invalid_hint_mutation');
      return false;
    }
    if (validated.hintsUsed !== current.hintsUsed + 1) throw new SaveDataError('invalid_hint_mutation');
    if (this.data.hints === 0) return false;
    const next = this.snapshot();
    next.hints -= 1;
    next.currentAttempt = validated;
    this.commit(next);
    return true;
  }
  public canClaimDailyHint(localDate: string): boolean {
    if (!validLocalDate(localDate)) throw new SaveDataError('invalid_local_date');
    return this.data.daily.watermark === null || localDate > this.data.daily.watermark;
  }
  public claimDailyHint(localDate: string): boolean {
    if (!this.canClaimDailyHint(localDate)) return false;
    if (this.data.hints === Number.MAX_SAFE_INTEGER) throw new SaveDataError('inventory_overflow');
    const next = this.snapshot();
    next.hints += 1;
    next.daily = { lastClaimDate: localDate, watermark: localDate };
    this.commit(next);
    return true;
  }
  public getCurrentAttempt(): AttemptSave | null { return clone(this.data.currentAttempt); }
  public startAttempt(input: AttemptInput): AttemptSave {
    if (!input) throw new SaveDataError('invalid_attempt');
    const map = this.map(input.mapId);
    const index = map.levelIds!.indexOf(input.levelId);
    if (!this.canPlay(input.mapId, index)) throw new SaveDataError('level_locked');
    const next = this.snapshot();
    if (next.currentAttempt) next.abandonedAttempts.push(next.currentAttempt.attemptId);
    const attempt: AttemptSave = { ...input, attemptId: this.newIdentity(next), mode: map.mode!, status: 'active', moves: 0, errors: 0, hintsUsed: 0, continuesUsed: 0, bonusMoves: 0, hintRefills: 0, activeHintPieceId: null };
    next.currentAttempt = validateAttempt(attempt, this.catalog);
    this.commit(next);
    return clone(attempt);
  }
  public saveAttempt(attempt: AttemptSave): void {
    const validated = validateAttempt(attempt, this.catalog);
    const current = this.requireCurrentAttempt(validated);
    if (validated.moves < current.moves || validated.errors < current.errors || validated.hintsUsed < current.hintsUsed || validated.continuesUsed < current.continuesUsed || validated.hintRefills < current.hintRefills) throw new SaveDataError('attempt_counter_rollback');
    if (validated.hintsUsed !== current.hintsUsed || validated.continuesUsed !== current.continuesUsed
      || validated.bonusMoves !== current.bonusMoves || validated.hintRefills !== current.hintRefills) throw new SaveDataError('protected_attempt_counters');
    if (validated.activeHintPieceId !== null && validated.activeHintPieceId !== current.activeHintPieceId) throw new SaveDataError('hint_requires_inventory_commit');
    if (current.status === 'failed' && (validated.status !== 'failed' || validated.moves !== current.moves
      || validated.errors !== current.errors || JSON.stringify(validated.puzzle) !== JSON.stringify(current.puzzle))) throw new SaveDataError('attempt_not_active');
    if (current.puzzle.won && JSON.stringify(validated.puzzle) !== JSON.stringify(current.puzzle)) throw new SaveDataError('attempt_already_won');
    const next = this.snapshot();
    next.currentAttempt = validated;
    this.commit(next);
  }
  private requireCurrentAttempt(attempt: AttemptSave): AttemptSave {
    const current = this.data.currentAttempt;
    if (!current || current.attemptId !== attempt.attemptId || current.mapId !== attempt.mapId
      || current.levelId !== attempt.levelId || current.contentVersion !== attempt.contentVersion
      || current.mode !== attempt.mode) throw new SaveDataError('stale_attempt');
    return current;
  }
  public abandonAttempt(): boolean {
    if (!this.data.currentAttempt) return false;
    const next = this.snapshot();
    next.abandonedAttempts.push(next.currentAttempt!.attemptId);
    next.currentAttempt = null;
    this.commit(next);
    return true;
  }
}
