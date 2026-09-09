import type { LevelCatalog, LevelData, LevelMapDefinition, LevelMetadata } from './LevelTypes';
import { assertValidLevels, validateCatalog, validateLevelMetadata } from './LevelValidator';

export type JsonLoader = (resource: string) => Promise<unknown>;

export class LevelRepository {
  private catalog: LevelCatalog | null = null;
  private readonly cache = new Map<string, LevelData[]>();
  private readonly metadataCache = new Map<string, LevelMetadata[]>();

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

  public async getMetadata(mapId: string): Promise<LevelMetadata[]> {
    const cached = this.metadataCache.get(mapId);
    if (cached) return cached;
    const map = await this.getMap(mapId);
    if (!map.metadataResource) throw new Error(`Missing metadata resource: ${mapId}`);
    const levels = await this.getLevels(mapId);
    const value = await this.loadJson(map.metadataResource);
    const issues = validateLevelMetadata(value, map, levels);
    if (issues.length) throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
    const metadata = value as LevelMetadata[];
    this.metadataCache.set(mapId, metadata);
    return metadata;
  }

  public async getLevelMetadata(mapId: string, levelIndex: number): Promise<LevelMetadata> {
    const metadata = await this.getMetadata(mapId);
    if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= metadata.length) throw new RangeError(`Invalid level index: ${levelIndex}`);
    return metadata[levelIndex];
  }
}
