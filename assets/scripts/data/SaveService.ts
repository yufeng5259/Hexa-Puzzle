export const SAVE_KEY = 'hexa-puzzle.save';
export const SAVE_VERSION = 1;

export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface MapProgress { maxCompleted: number }
export interface SaveData { version: 1; money: number; hints: number; maps: Record<string, MapProgress> }

const mapAliases: Record<string, string> = { Basic_Classic: 'classic', Basic_Novice: 'novice' };
const levelLimits: Record<string, number> = { classic: 80, novice: 80 };

function boundedInteger(value: unknown, min: number, max: number, fallback: number): number {
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value as number)) : fallback;
}

export function defaultSave(): SaveData { return { version: 1, money: 0, hints: 5, maps: {} }; }

export function normalizeSave(value: unknown): SaveData {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const result = defaultSave();
  result.money = boundedInteger(source.money, 0, Number.MAX_SAFE_INTEGER, 0);
  result.hints = boundedInteger(source.hints ?? source.tipCount, 0, 9999, 5);
  if (source.version === 1 && source.maps && typeof source.maps === 'object') {
    for (const mapId of Object.keys(source.maps as Record<string, Record<string, unknown>>)) {
      const progress = (source.maps as Record<string, Record<string, unknown>>)[mapId];
      if (levelLimits[mapId]) result.maps[mapId] = { maxCompleted: boundedInteger(progress.maxCompleted, 0, levelLimits[mapId], 0) };
    }
  }
  for (const legacyKey of Object.keys(mapAliases)) {
    const mapId = mapAliases[legacyKey];
    const progress = source[legacyKey] as Record<string, unknown> | undefined;
    if (progress) result.maps[mapId] = { maxCompleted: boundedInteger(progress.maxLevel, 0, levelLimits[mapId], 0) };
  }
  return result;
}

export class SaveService {
  private data: SaveData;
  public constructor(private readonly storage: StorageLike) { this.data = this.load(); }
  private load(): SaveData {
    const raw = this.storage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    try { return normalizeSave(JSON.parse(raw)); } catch { return defaultSave(); }
  }
  public snapshot(): SaveData { return JSON.parse(JSON.stringify(this.data)) as SaveData; }
  public reload(): SaveData { this.data = this.load(); return this.snapshot(); }
  public persist(): void { this.storage.setItem(SAVE_KEY, JSON.stringify(this.data)); }
  public getMaxCompleted(mapId: string): number { return this.data.maps[mapId]?.maxCompleted ?? 0; }
  public canPlay(mapId: string, levelIndex: number): boolean { return levelIndex <= this.getMaxCompleted(mapId); }
  public completeLevel(mapId: string, levelIndex: number): { firstCompletion: boolean; save: SaveData } {
    const limit = levelLimits[mapId];
    if (!limit || !Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= limit) throw new RangeError('地图或关卡索引无效');
    const completedCount = levelIndex + 1;
    const previous = this.getMaxCompleted(mapId);
    const firstCompletion = completedCount > previous;
    this.data.money += 100;
    if (firstCompletion) {
      this.data.hints += 1;
      this.data.maps[mapId] = { maxCompleted: completedCount };
    }
    this.persist();
    return { firstCompletion, save: this.snapshot() };
  }
  public consumeHint(): boolean {
    if (this.data.hints <= 0) return false;
    this.data.hints -= 1;
    this.persist();
    return true;
  }
  public importLegacy(raw: string): SaveData {
    try { this.data = normalizeSave(JSON.parse(raw)); } catch { this.data = defaultSave(); }
    this.persist();
    return this.snapshot();
  }
}
