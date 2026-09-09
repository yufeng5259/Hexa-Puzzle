import type { LevelCatalog, LevelMapDefinition } from './LevelTypes';
import { SaveDataError, SAVE_VERSION, type AttemptSave, type LegacyLevelMap, type LegacyLevelProgress, type LevelProgress, type MapProgress, type SaveData, type StarCount } from './SaveTypes';
import { normalizeRewards } from './RewardTransactions';

export function record(value: unknown): Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}
export function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
export function metric(value: unknown): number | null { return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null; }
export function betterMetric(a: number | null, b: number | null): number | null { return a === null ? b : b === null ? a : Math.min(a, b); }
export function emptyLevel(): LevelProgress { return { completed: false, unassisted: false, bestStars: 0, bestMoves: null, bestErrors: null, bestHintsUsed: null }; }
export function progressCursor(progress: MapProgress, ids: string[]): number {
  const next = ids.findIndex((id) => progress.unlockedLevelIds.indexOf(id) >= 0 && !progress.levels[id]?.completed);
  if (next >= 0) return next;
  if (ids.every((id) => progress.levels[id]?.completed)) return ids.length;
  return Math.max(0, ids.findIndex((id) => progress.unlockedLevelIds.indexOf(id) >= 0));
}
function bounded(value: unknown, limit: number, fallback = 0): number { return Number.isInteger(value) ? Math.max(0, Math.min(limit, value as number)) : fallback; }
function stars(value: unknown): StarCount { return bounded(value, 3) as StarCount; }
function strings(value: unknown): string[] { return Array.isArray(value) ? Array.from(new Set(value.filter((v): v is string => typeof v === 'string' && v.length > 0))) : []; }
function installationId(): string {
  let value = '';
  for (let index = 0; index < 4; index += 1) value += `00000000${Math.floor(Math.random() * 0x100000000).toString(16)}`.slice(-8);
  return value;
}
export function catalogMaps(catalog: LevelCatalog): LevelMapDefinition[] {
  const maps: LevelMapDefinition[] = [];
  const ids = new Set<string>();
  const levelIds = new Set<string>();
  if (!catalog || !Array.isArray(catalog.categories)) throw new SaveDataError('invalid_catalog');
  for (const category of catalog.categories) for (const map of category.maps) {
    if (!map.id || map.id === '__proto__' || map.id === 'constructor' || ids.has(map.id) || !map.levelIds || map.levelIds.length !== map.levelCount || !map.levelCount || (map.mode !== 'relaxed' && map.mode !== 'challenge')) throw new SaveDataError('invalid_catalog');
    ids.add(map.id);
    for (const id of map.levelIds) {
      if (!id || id === '__proto__' || id === 'constructor' || levelIds.has(id)) throw new SaveDataError('invalid_catalog');
      levelIds.add(id);
    }
    maps.push(map);
  }
  return maps;
}
export function validLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
export function defaultSave(catalog: LevelCatalog): SaveData {
  const result: SaveData = {
    version: SAVE_VERSION, hints: 5, daily: { lastClaimDate: null, watermark: null }, maps: {},
    legacy: { originalData: null, maps: {}, mergedLevels: {}, rewardedTransactions: [] },
    migration: { sourceVersion: null, convertedHints: 0, complete: true }, identity: { installationId: installationId(), nextSequence: 1 },
    currentAttempt: null, abandonedAttempts: [], rewards: { pending: {}, terminal: {}, quarantinedReceipts: [] },
  };
  for (const map of catalogMaps(catalog)) result.maps[map.id] = { maxCompleted: 0, unlockedLevelIds: [map.levelIds![0]], levels: {} };
  return result;
}
function legacyLevel(value: unknown): LegacyLevelProgress {
  const source = record(value);
  return { completed: Boolean(source.completed), bestStars: stars(source.bestStars), bestMoves: metric(source.bestMoves), bestErrors: metric(source.bestErrors), bestHintsUsed: metric(source.bestHintsUsed), rewardStarsClaimed: stars(source.rewardStarsClaimed) };
}
function mergeLegacy(a: LegacyLevelProgress, b: LegacyLevelProgress): LegacyLevelProgress {
  return { completed: a.completed || b.completed, bestStars: Math.max(a.bestStars, b.bestStars) as StarCount,
    bestMoves: betterMetric(a.bestMoves, b.bestMoves), bestErrors: betterMetric(a.bestErrors, b.bestErrors),
    bestHintsUsed: betterMetric(a.bestHintsUsed, b.bestHintsUsed), rewardStarsClaimed: Math.max(a.rewardStarsClaimed, b.rewardStarsClaimed) as StarCount };
}
function requireSafe(value: unknown): number {
  const result = metric(value);
  if (result === null) throw new SaveDataError('invalid_v3_integer');
  return result;
}
export function validateAttempt(value: unknown, catalog: LevelCatalog, allowUnavailable = false): AttemptSave {
  const attempt = record(value);
  const map = catalogMaps(catalog).find((entry) => entry.id === attempt.mapId);
  const unavailable = !map || map.levelIds!.indexOf(attempt.levelId) < 0 || attempt.mode !== map.mode;
  if ((!allowUnavailable && unavailable) || typeof attempt.mapId !== 'string' || !attempt.mapId
    || typeof attempt.levelId !== 'string' || !attempt.levelId || ['relaxed', 'challenge'].indexOf(attempt.mode) < 0
    || typeof attempt.attemptId !== 'string' || !attempt.attemptId || attempt.attemptId === '__proto__'
    || !Number.isSafeInteger(attempt.contentVersion) || attempt.contentVersion < 1
    || ['active', 'failed'].indexOf(attempt.status) < 0) throw new SaveDataError('invalid_attempt');
  for (const key of ['moves', 'errors', 'hintsUsed', 'continuesUsed', 'bonusMoves', 'hintRefills']) requireSafe(attempt[key]);
  if (attempt.continuesUsed > 1 || attempt.hintRefills > 2 || attempt.bonusMoves !== attempt.continuesUsed * 3 || (attempt.activeHintPieceId !== null && typeof attempt.activeHintPieceId !== 'string')) throw new SaveDataError('invalid_attempt');
  const puzzle = record(attempt.puzzle);
  if (!Array.isArray(puzzle.pieces) || !Array.isArray(puzzle.remainingHints) || typeof puzzle.won !== 'boolean' || puzzle.occupied === null || typeof puzzle.occupied !== 'object' || Array.isArray(puzzle.occupied)) throw new SaveDataError('invalid_puzzle_snapshot');
  const pieceIds = new Set<string>();
  const occupied: Record<string, string> = {};
  for (const value of puzzle.pieces) {
    const piece = record(value);
    if (typeof piece.id !== 'string' || !piece.id || pieceIds.has(piece.id) || typeof piece.textureName !== 'string' || typeof piece.placed !== 'boolean' || typeof piece.correctlyMatched !== 'boolean' || !Array.isArray(piece.cells)) throw new SaveDataError('invalid_puzzle_snapshot');
    pieceIds.add(piece.id);
    for (const cellValue of piece.cells) {
      const cell = record(cellValue);
      if (!Number.isSafeInteger(cell.tx) || !Number.isSafeInteger(cell.ty)) throw new SaveDataError('invalid_puzzle_snapshot');
      if (piece.placed) {
        const key = `${cell.tx},${cell.ty}`;
        if (occupied[key]) throw new SaveDataError('invalid_puzzle_snapshot');
        occupied[key] = piece.id;
      }
    }
  }
  if (Object.keys(occupied).length !== Object.keys(puzzle.occupied).length || Object.keys(occupied).some((key) => occupied[key] !== puzzle.occupied[key]) || puzzle.remainingHints.some((id: unknown) => typeof id !== 'string') || (attempt.activeHintPieceId !== null && !pieceIds.has(attempt.activeHintPieceId))) throw new SaveDataError('invalid_puzzle_snapshot');
  return {
    attemptId: attempt.attemptId, mapId: attempt.mapId, levelId: attempt.levelId, mode: attempt.mode,
    contentVersion: attempt.contentVersion, status: attempt.status, moves: attempt.moves, errors: attempt.errors,
    hintsUsed: attempt.hintsUsed, continuesUsed: attempt.continuesUsed, bonusMoves: attempt.bonusMoves,
    hintRefills: attempt.hintRefills, activeHintPieceId: attempt.activeHintPieceId,
    puzzle: { pieces: puzzle.pieces.map((piece: any) => ({ id: piece.id, textureName: piece.textureName, placed: piece.placed, correctlyMatched: piece.correctlyMatched, cells: piece.cells.map((cell: any) => ({ tx: cell.tx, ty: cell.ty })) })), occupied: clone(occupied), remainingHints: [...puzzle.remainingHints], won: puzzle.won },
  };
}
function normalizeV3(source: Record<string, any>, catalog: LevelCatalog): SaveData {
  const result = defaultSave(catalog);
  result.hints = requireSafe(source.hints);
  const daily = record(source.daily);
  for (const key of ['lastClaimDate', 'watermark']) if (daily[key] !== null && !validLocalDate(daily[key])) throw new SaveDataError('invalid_daily_state');
  if (daily.lastClaimDate !== null && (daily.watermark === null || daily.lastClaimDate > daily.watermark)) throw new SaveDataError('invalid_daily_state');
  result.daily = { lastClaimDate: daily.lastClaimDate, watermark: daily.watermark };
  const savedMaps = record(source.maps);
  if (source.maps === null || typeof source.maps !== 'object' || Array.isArray(source.maps)) throw new SaveDataError('invalid_v3_maps');
  for (const map of catalogMaps(catalog)) {
    const saved = record(savedMaps[map.id]);
    const progress = result.maps[map.id];
    if (savedMaps[map.id] !== undefined && (!Array.isArray(saved.unlockedLevelIds) || !saved.levels || typeof saved.levels !== 'object' || Array.isArray(saved.levels))) throw new SaveDataError('invalid_v3_maps');
    progress.unlockedLevelIds = savedMaps[map.id] === undefined ? [map.levelIds![0]] : strings(saved.unlockedLevelIds).filter((id) => map.levelIds!.indexOf(id) >= 0);
    for (const id of map.levelIds!) {
      const raw = record(record(saved.levels)[id]);
      if (record(saved.levels)[id] !== undefined) {
        if (typeof raw.completed !== 'boolean' || typeof raw.unassisted !== 'boolean' || !Number.isInteger(raw.bestStars) || raw.bestStars < 0 || raw.bestStars > 3) throw new SaveDataError('invalid_v3_progress');
        for (const key of ['bestMoves', 'bestErrors', 'bestHintsUsed']) if (raw[key] !== null) requireSafe(raw[key]);
        progress.levels[id] = { completed: raw.completed, unassisted: raw.completed && raw.unassisted, bestStars: raw.bestStars, bestMoves: raw.bestMoves, bestErrors: raw.bestErrors, bestHintsUsed: raw.bestHintsUsed };
      }
    }
    progress.maxCompleted = progressCursor(progress, map.levelIds!);
  }
  const legacy = record(source.legacy);
  if (!('originalData' in legacy) || !legacy.maps || typeof legacy.maps !== 'object' || Array.isArray(legacy.maps)
    || !legacy.mergedLevels || typeof legacy.mergedLevels !== 'object' || Array.isArray(legacy.mergedLevels)
    || !Array.isArray(legacy.rewardedTransactions)) throw new SaveDataError('invalid_legacy_archive');
  for (const id of Object.keys(legacy.maps)) {
    const archiveMap = record(legacy.maps[id]);
    requireSafe(archiveMap.maxCompleted);
    if (!archiveMap.levels || typeof archiveMap.levels !== 'object' || Array.isArray(archiveMap.levels)) throw new SaveDataError('invalid_legacy_archive');
  }
  result.legacy = clone(legacy) as SaveData['legacy'];
  const migration = record(source.migration);
  if (migration.complete !== true || (migration.sourceVersion !== null && [0, 1, 2].indexOf(migration.sourceVersion) < 0)) throw new SaveDataError('invalid_migration_state');
  result.migration = { sourceVersion: migration.sourceVersion, convertedHints: requireSafe(migration.convertedHints), complete: true };
  result.identity.nextSequence = requireSafe(record(source.identity).nextSequence);
  const nonce = record(source.identity).installationId;
  if (typeof nonce !== 'string' || !/^[0-9a-f]{32}$/.test(nonce)) throw new SaveDataError('invalid_identity');
  result.identity.installationId = nonce;
  if (!result.identity.nextSequence) throw new SaveDataError('invalid_identity');
  result.abandonedAttempts = strings(source.abandonedAttempts);
  result.currentAttempt = source.currentAttempt === null ? null : validateAttempt(source.currentAttempt, catalog, true);
  if (result.currentAttempt) {
    const attempt = result.currentAttempt;
    const map = catalogMaps(catalog).find((entry) => entry.id === attempt.mapId);
    if (!map || map.mode !== attempt.mode || map.levelIds!.indexOf(attempt.levelId) < 0) {
      if (result.abandonedAttempts.indexOf(attempt.attemptId) < 0) result.abandonedAttempts.push(attempt.attemptId);
      result.currentAttempt = null;
    }
  }
  result.rewards = normalizeRewards(source.rewards);
  return result;
}
export function normalizeSave(value: unknown, catalog: LevelCatalog, mapping: LegacyLevelMap): SaveData {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new SaveDataError('invalid_save');
  const source = record(value);
  if (typeof source.version === 'number' && source.version > SAVE_VERSION) throw new SaveDataError('future_save_version');
  if (source.version === SAVE_VERSION) return normalizeV3(source, catalog);
  if (source.version !== undefined && source.version !== 1 && source.version !== 2) throw new SaveDataError('unsupported_save_version');
  if (!mapping || mapping.version !== 1 || !Array.isArray(record(mapping.maps).classic) || !Array.isArray(record(mapping.maps).novice)) throw new SaveDataError('invalid_legacy_mapping');
  const result = defaultSave(catalog);
  const money = bounded(source.money, Number.MAX_SAFE_INTEGER);
  const convertedHints = money > 0 ? Math.ceil(money / 300) : 0;
  const hints = bounded(source.hints ?? source.tipCount, Number.MAX_SAFE_INTEGER, 5);
  if (convertedHints > Number.MAX_SAFE_INTEGER - hints) throw new SaveDataError('inventory_overflow');
  result.hints = hints + convertedHints;
  result.migration = { sourceVersion: source.version ?? 0, convertedHints, complete: true };
  result.legacy.originalData = clone(source);
  result.legacy.rewardedTransactions = strings(source.rewardedTransactions);
  const classic = catalogMaps(catalog).find((map) => map.id === 'classic');
  if (!classic) throw new SaveDataError('missing_classic_catalog');
  for (const mapId of ['classic', 'novice']) {
    const entries = mapping.maps[mapId];
    const alias = source[mapId === 'classic' ? 'Basic_Classic' : 'Basic_Novice'];
    // Historical aliases override the versioned map, including its precise levels.
    const saved = alias ? record(alias) : source.version === 1 || source.version === 2 ? record(record(source.maps)[mapId]) : {};
    const maximum = bounded(alias ? saved.maxLevel : saved.maxCompleted, entries.length);
    const levels: Record<string, LegacyLevelProgress> = {};
    const contiguous = Boolean(alias) || source.version === 1;
    for (const entry of entries) {
      const key = String(entry.legacyIndex);
      const raw = record(saved.levels)[key];
      // V1 was also persisted as V2 with empty levels after unrelated inventory writes.
      if ((contiguous || (source.version === 2 && raw === undefined)) && entry.legacyIndex < maximum) levels[key] = { ...legacyLevel(null), completed: true };
      else if (!alias && source.version === 2 && raw !== undefined) levels[key] = legacyLevel(raw);
      if (!levels[key] || !entry.levelId || classic.levelIds!.indexOf(entry.levelId) < 0) continue;
      const previous = result.legacy.mergedLevels[entry.levelId];
      const merged = previous ? mergeLegacy(previous, levels[key]) : clone(levels[key]);
      result.legacy.mergedLevels[entry.levelId] = merged;
      if (merged.completed) result.maps.classic.levels[entry.levelId] = { ...emptyLevel(), completed: true };
    }
    result.legacy.maps[mapId] = { maxCompleted: maximum, levels };
    result.maps.classic.maxCompleted = Math.max(result.maps.classic.maxCompleted, Math.min(maximum, classic.levelCount));
  }
  const progress = result.maps.classic;
  // Map old unlock entitlement via the fixed original order, independently of completion.
  for (const entry of mapping.maps.classic) {
    if (entry.legacyIndex <= progress.maxCompleted && entry.levelId
      && classic.levelIds!.indexOf(entry.levelId) >= 0
      && progress.unlockedLevelIds.indexOf(entry.levelId) < 0) progress.unlockedLevelIds.push(entry.levelId);
  }
  progress.maxCompleted = progressCursor(progress, classic.levelIds!);
  return result;
}
