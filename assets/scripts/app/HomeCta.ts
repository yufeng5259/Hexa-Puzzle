import type { LevelCatalog, LevelMapDefinition } from '../data/LevelTypes';
import type { SaveData } from '../data/SaveService';

export type HomeCtaKind = 'play' | 'continue';

export interface HomeCtaResolution {
  kind: HomeCtaKind;
  labelKey: 'home.play' | 'home.continue';
  subtitleKey: 'home.levelPrefix' | null;
  subtitleParams: { level: number } | null;
  progressLevel: number | null;
  mapId: string | null;
  route: { name: 'maps' } | { name: 'gameplay'; mapId: string; levelIndex: number };
}

function catalogMaps(catalog: LevelCatalog): LevelMapDefinition[] {
  const maps: LevelMapDefinition[] = [];
  for (const category of catalog.categories) maps.push(...category.maps);
  return maps;
}

export function resolveHomeCta(save: SaveData, catalog: LevelCatalog): HomeCtaResolution {
  const maps = catalogMaps(catalog);
  const attempt = save.currentAttempt;
  if (attempt) {
    const map = maps.find((value) => value.id === attempt.mapId);
    const index = map?.levelIds?.indexOf(attempt.levelId) ?? -1;
    if (map && index >= 0 && (save.maps[map.id]?.unlockedLevelIds.indexOf(attempt.levelId) ?? -1) >= 0) return continueAt(map, index);
  }
  let best: { map: LevelMapDefinition; index: number; completed: number } | null = null;
  for (const map of maps) {
    const progress = save.maps[map.id];
    if (!progress || !map.levelIds) continue;
    const completed = map.levelIds.filter((id) => progress.levels[id]?.completed).length;
    if (completed === 0 && progress.unlockedLevelIds.length <= 1) continue;
    const index = map.levelIds.findIndex((id) => !progress.levels[id]?.completed && progress.unlockedLevelIds.indexOf(id) >= 0);
    if (index >= 0 && (!best || completed > best.completed)) {
      best = { map, index, completed };
    }
  }

  if (!best) {
    return { kind: 'play', labelKey: 'home.play', subtitleKey: null, subtitleParams: null, progressLevel: null, mapId: null, route: { name: 'maps' } };
  }

  return continueAt(best.map, best.index);
}

function continueAt(map: LevelMapDefinition, index: number): HomeCtaResolution {
  return {
    kind: 'continue',
    labelKey: 'home.continue',
    subtitleKey: 'home.levelPrefix',
    subtitleParams: { level: index + 1 },
    progressLevel: index + 1,
    mapId: map.id,
    route: { name: 'gameplay', mapId: map.id, levelIndex: index },
  };
}
