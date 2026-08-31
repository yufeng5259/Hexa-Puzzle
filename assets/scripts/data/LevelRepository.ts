import type { LevelCatalog, LevelData, LevelMapDefinition } from './LevelTypes';
import { assertValidLevels, validateCatalog } from './LevelValidator';

export type JsonLoader = (resource: string) => Promise<unknown>;

export class LevelRepository {
  private catalog: LevelCatalog | null = null;
  private readonly cache = new Map<string, LevelData[]>();

  public constructor(private readonly loadJson: JsonLoader) {}

  public async getCatalog(): Promise<LevelCatalog> {
    if (this.catalog) return this.catalog;
    const value = await this.loadJson('data/catalog');
    const issues = validateCatalog(value);
    if (issues.length) throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
    this.catalog = value as LevelCatalog;
    return this.catalog;
  }

  public async getMap(mapId: string): Promise<LevelMapDefinition> {
    const catalog = await this.getCatalog();
    let map: LevelMapDefinition | undefined;
    for (const category of catalog.categories) {
      map = category.maps.find((item) => item.id === mapId);
      if (map) break;
    }
    if (!map) throw new Error(`未知地图: ${mapId}`);
    return map;
  }

  public async getLevels(mapId: string): Promise<LevelData[]> {
    const cached = this.cache.get(mapId);
    if (cached) return cached;
    const definition = await this.getMap(mapId);
    const levels = assertValidLevels(await this.loadJson(definition.resource), definition);
    this.cache.set(mapId, levels);
    return levels;
  }

  public async getLevel(mapId: string, levelIndex: number): Promise<LevelData> {
    const levels = await this.getLevels(mapId);
    if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= levels.length) throw new RangeError(`关卡索引越界: ${levelIndex}`);
    return levels[levelIndex];
  }
}
