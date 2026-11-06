import { EconomyConfig } from '../config/EconomyConfig';
import { SaveData } from '../save/SaveData';
import { SaveService } from '../save/SaveService';
import { recordActivity } from './Activity';
import { addHints, addHoney, spendHoney } from './Wallet';

type Garden = EconomyConfig['garden'];

/** Cost of the next upgrade, or null at max level (F023). */
export function nextPrice(cfg: Garden, chapter: number, level: number): number | null {
    return level >= cfg.maxLevel ? null : cfg.prices[chapter][level];
}

/** Honey still missing for the next upgrade (F025). */
export function shortage(save: Readonly<SaveData>, cfg: Garden, buildingId: number): number {
    const price = nextPrice(cfg, save.garden.chapter, save.garden.buildings[buildingId]);
    return price === null ? 0 : Math.max(0, price - save.wallet.honey);
}

export function gardenProgress(save: Readonly<SaveData>): number {
    return save.garden.buildings.reduce((sum, level) => sum + level, 0);
}

export function isChapterBuilt(save: Readonly<SaveData>, cfg: Garden): boolean {
    return save.garden.buildings.every(level => level >= cfg.maxLevel);
}

export function isChapterClaimed(save: Readonly<SaveData>, chapter: number): boolean {
    return save.claims['chapter:' + chapter] !== undefined;
}

export function isLastChapter(save: Readonly<SaveData>, cfg: Garden): boolean {
    return save.garden.chapter >= cfg.themes.length - 1;
}

/** All three gardens built (F028); the last chapter reward may still be unclaimed. */
export function isJourneyComplete(save: Readonly<SaveData>, cfg: Garden): boolean {
    return isLastChapter(save, cfg) && isChapterBuilt(save, cfg);
}

export interface UpgradeResult { buildingId: number; from: number; to: number; cost: number; }

/** One upgrade; `expectedLevel` rejects stale or repeated commands (F023). */
export function upgrade(draft: SaveData, cfg: Garden, buildingId: number, expectedLevel: number, today: string): UpgradeResult {
    const from = draft.garden.buildings[buildingId];
    if (from !== expectedLevel) throw new Error(`Building ${buildingId} is level ${from}, expected ${expectedLevel}`);
    const cost = nextPrice(cfg, draft.garden.chapter, from);
    if (cost === null) throw new Error(`Building ${buildingId} is already max level`);
    spendHoney(draft, cost);
    draft.garden.buildings[buildingId] = from + 1;
    recordActivity(draft, { kind: 'build', chapter: draft.garden.chapter, buildingId, level: from + 1 }, today);
    return { buildingId, from, to: from + 1, cost };
}

export interface ChapterReceipt { chapter: number; honey: number; hints: number; photoId: number; }

/** Garden completion reward, once per chapter (F026). Photo id = chapter × 6 + 5. */
export function claimChapter(save: SaveService, cfg: Garden): ChapterReceipt {
    const chapter = save.data.garden.chapter;
    if (!isChapterBuilt(save.data, cfg)) throw new Error('Garden not complete');
    return save.claim<ChapterReceipt>('chapter:' + chapter, draft => {
        addHoney(draft, cfg.chapterReward.honey);
        addHints(draft, cfg.chapterReward.hints);
        return { chapter, honey: cfg.chapterReward.honey, hints: cfg.chapterReward.hints, photoId: chapter * 6 + 5 };
    });
}

/** Move to the next garden (F027): free, requires the chapter reward, new buildings start at 0. */
export function depart(draft: SaveData, cfg: Garden, expectedChapter: number, today: string): number {
    const chapter = draft.garden.chapter;
    if (chapter !== expectedChapter) throw new Error(`Chapter is ${chapter}, expected ${expectedChapter}`);
    if (chapter >= cfg.themes.length - 1) throw new Error('No next garden');
    if (draft.claims['chapter:' + chapter] === undefined) throw new Error('Chapter reward not claimed');
    draft.garden.chapter = chapter + 1;
    draft.garden.buildings = new Array(cfg.buildingCount).fill(0);
    recordActivity(draft, { kind: 'gardenEntered', chapter: chapter + 1 }, today);
    return chapter + 1;
}

/** What the completed garden leads to (F025–F028); null while the garden is still being built. */
export type ChapterStep = 'claim' | 'next' | 'journey' | null;

export function chapterStep(save: Readonly<SaveData>, cfg: Garden): ChapterStep {
    if (!isChapterBuilt(save, cfg)) return null;
    if (!isChapterClaimed(save, save.garden.chapter)) return 'claim';
    return isLastChapter(save, cfg) ? 'journey' : 'next';
}

/** Progress shown for a garden on the world map: past gardens are complete, future ones empty (F027). */
export function chapterProgress(save: Readonly<SaveData>, cfg: Garden, chapter: number): number {
    if (chapter < save.garden.chapter) return cfg.maxLevel * cfg.buildingCount;
    if (chapter > save.garden.chapter) return 0;
    return gardenProgress(save);
}

/** One stage canvas (512×512 art) placement in design coordinates, top-left origin. */
export interface BuildingPlacement { center: [number, number]; width: number; z: number; }

/** bundles/garden/config/layout.json: placements per theme, in building id order. */
export type GardenLayout = Record<string, BuildingPlacement[]>;
