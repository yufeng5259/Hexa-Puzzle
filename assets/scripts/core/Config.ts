import type { DailyTaskRule, EndlessShape, MapRule, Reward, Rules } from './Rules';

/** How a building sits on its map; numbers come straight from the art layout JSON. */
export interface BuildingLayout {
    readonly id: string;
    readonly mapId: string;
    readonly slot: number;
    readonly name: string;
    /** Feet position in 0..1 of the background image, y measured from the top. */
    readonly feetX: number;
    readonly feetY: number;
    readonly anchorX: number;
    readonly anchorY: number;
    /** Rendered sprite width as a fraction of the background width. */
    readonly widthFraction: number;
    readonly flipX: boolean;
    readonly zIndex: number;
    /** assetIds[level] for level 0..max. */
    readonly assetIds: readonly string[];
}
export interface MapView { readonly id: string; readonly name: string; readonly backgroundAssetId: string; readonly buildings: readonly BuildingLayout[] }
export interface GuideStepRow { readonly id: string; readonly order: number; readonly step: string; readonly pageId: string; readonly targetId: string | null; readonly textKey: string | null; readonly params: Readonly<Record<string, unknown>> }

/** Everything loaded from game-config.json: pure rules for core plus display data for views. */
export interface GameConfig {
    readonly rules: Rules;
    readonly maps: readonly MapView[];
    readonly guide: readonly GuideStepRow[];
}

type Row = Record<string, unknown>;
const RESERVED = ['__proto__', 'constructor', 'prototype'];

function fail(message: string): never { throw new Error(`game-config: ${message}`); }
function tableRows(raw: Row, name: string): Row[] {
    const table = raw[name] as Row | undefined;
    if (!table || typeof table !== 'object' || !Array.isArray(table.keys)) fail(`${name} missing`);
    const keys = table.keys as string[];
    const rows: Row[] = [];
    for (const id of Object.keys(table)) {
        if (id === 'keys') continue;
        const values = table[id];
        if (RESERVED.includes(id) || !Array.isArray(values) || values.length !== keys.length || values[0] !== id) fail(`${name}:${id} malformed`);
        const row: Row = Object.create(null);
        keys.forEach((key, i) => { row[key] = values[i]; });
        rows.push(row);
    }
    if (!rows.length) fail(`${name} empty`);
    return rows;
}
const num = (row: Row, key: string): number => { const v = row[key]; if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${String(row.id)}.${key} not a number`); return v; };
const str = (row: Row, key: string): string => { const v = row[key]; if (typeof v !== 'string' || !v) fail(`${String(row.id)}.${key} not a string`); return v; };
const optStr = (row: Row, key: string): string | null => row[key] === null ? null : str(row, key);
const by = (key: string) => (a: Row, b: Row) => num(a, key) - num(b, key);

/** Parses and freezes the exported config. Cross-table checks already ran in tools/meta. */
export function parseGameConfig(json: unknown): GameConfig {
    const root = json as Row;
    if (!root || root.schemaVersion !== 2 || !root.tables) fail('unsupported schema');
    const t = root.tables as Row;
    const constants: Row = Object.create(null);
    for (const row of tableRows(t, 'Constants')) constants[str(row, 'id')] = row.value;
    const k = <T>(id: string, type: 'number' | 'string' | 'boolean'): T => { const v = constants[id]; if (typeof v !== type) fail(`constant ${id} must be ${type}`); return v as T; };

    const rewards: Record<string, Reward> = Object.create(null);
    for (const row of tableRows(t, 'Rewards')) rewards[str(row, 'id')] = { coins: num(row, 'coins'), energy: num(row, 'energy'), hints: num(row, 'hints') };
    const rewardRef = (id: string | null): string | null => { if (id !== null && !rewards[id]) fail(`unknown reward ${id}`); return id; };

    const stages = tableRows(t, 'BuildingStages').sort(by('level'));
    const buildings = tableRows(t, 'MapBuildings').sort(by('slot'));
    const mapRows = tableRows(t, 'Maps').sort(by('order'));
    const maps: MapRule[] = [], views: MapView[] = [];
    for (const m of mapRows) {
        const id = str(m, 'id'), own = buildings.filter(b => b.mapId === id);
        const layouts = own.map((b): BuildingLayout => {
            const levels = stages.filter(s => s.buildingId === b.id);
            if (levels.length < 2 || levels.some((s, i) => s.level !== i)) fail(`${String(b.id)} stages`);
            return {
                id: str(b, 'id'), mapId: id, slot: num(b, 'slot'), name: str(b, 'name'),
                feetX: num(b, 'feetX'), feetY: num(b, 'feetY'), anchorX: num(b, 'anchorX'), anchorY: num(b, 'anchorY'),
                widthFraction: num(b, 'widthFraction'), flipX: b.flipX === true, zIndex: num(b, 'zIndex'),
                assetIds: levels.map(s => str(s, 'assetId')),
            };
        });
        maps.push({
            id, nextMapId: optStr(m, 'nextMapId'), completionRewardId: rewardRef(optStr(m, 'completionRewardId')),
            buildings: own.map(b => ({ id: str(b, 'id'), costs: stages.filter(s => s.buildingId === b.id && num(s, 'level') > 0).map(s => num(s, 'cost')), maxRewardId: rewardRef(optStr(b, 'maxRewardId')) })),
        });
        views.push({ id, name: str(m, 'name'), backgroundAssetId: str(m, 'backgroundAssetId'), buildings: layouts });
    }

    const mainline = tableRows(t, 'Mainline').sort(by('levelNo')).map((row, i) => {
        if (num(row, 'levelNo') !== i + 1) fail('mainline numbers must be continuous');
        const kind = str(row, 'kind');
        if (kind !== 'normal' && kind !== 'challenge') fail(`mainline ${i + 1} kind`);
        return { levelNo: i + 1, puzzleId: str(row, 'puzzleId'), kind, firstClearRewardId: rewardRef(str(row, 'firstClearRewardId'))!, replayRewardId: rewardRef(str(row, 'replayRewardId'))! } as const;
    });
    const levels = tableRows(t, 'PlayerLevels').sort(by('level')).map(row => ({ expToNext: num(row, 'expToNext'), rewardId: rewardRef(optStr(row, 'rewardId')) }));
    const signIn = tableRows(t, 'SignIn').sort(by('day')).map(row => rewardRef(str(row, 'rewardId'))!);
    const tasks = tableRows(t, 'DailyTasks').sort(by('order')).map((row): DailyTaskRule => ({
        id: str(row, 'id'), type: str(row, 'type') as DailyTaskRule['type'], target: num(row, 'target'),
        rewardId: rewardRef(str(row, 'rewardId'))!, slot: str(row, 'slot') as DailyTaskRule['slot'], weight: num(row, 'weight'),
    }));
    const shapes = tableRows(t, 'EndlessShapes').sort(by('order')).map((row): EndlessShape => {
        const cells = row.cells;
        if (!Array.isArray(cells) || !cells.length || cells.some(c => !Array.isArray(c) || c.length !== 2 || !c.every(Number.isSafeInteger))) fail(`shape ${String(row.id)} cells`);
        return { id: str(row, 'id'), cells: cells as [number, number][], weight: num(row, 'weight'), color: num(row, 'color') };
    });
    const endlessStages = tableRows(t, 'EndlessStages').sort(by('score')).map(row => ({ score: num(row, 'score'), rewardId: rewardRef(str(row, 'rewardId'))! }));
    const guide = tableRows(t, 'GuideSteps').sort(by('order')).map((row): GuideStepRow => ({
        id: str(row, 'id'), order: num(row, 'order'), step: str(row, 'step'), pageId: str(row, 'pageId'),
        targetId: optStr(row, 'targetId'), textKey: optStr(row, 'textKey'), params: (row.params ?? {}) as Row,
    }));

    const rules: Rules = {
        initialCoins: k('initialCoins', 'number'), initialHints: k('initialHints', 'number'),
        energy: { max: k('energyMax', 'number'), initial: k('energyInitial', 'number'), recoverSeconds: k('energyRecoverSeconds', 'number'), startCost: k('energyStartCost', 'number'), firstLevelFree: k('energyFirstLevelFree', 'boolean') },
        rewards, welcomeRewardId: rewardRef(k('welcomeRewardId', 'string'))!,
        guideBuildingId: k('guideBuildingId', 'string'),
        mainline, maps, firstMapId: k('firstMapId', 'string'),
        build: { expPerUpgrade: k('buildExpPerUpgrade', 'number'), constructionSeconds: k('buildConstructionSeconds', 'number') },
        levels, signIn,
        daily: { tasks, chestRewardId: rewardRef(k('dailyChestRewardId', 'string'))!, count: k('dailyTaskCount', 'number') },
        endless: {
            unlockAfterLevelNo: k('endlessUnlockAfterLevelNo', 'number'), radius: k('endlessRadius', 'number'), traySize: k('endlessTraySize', 'number'), shapes,
            score: { perPlaced: k('endlessScorePerPlaced', 'number'), perCleared: k('endlessScorePerCleared', 'number'), perLine: k('endlessScorePerLine', 'number'), multiLine: k('endlessScoreMultiLine', 'number') },
            stages: endlessStages,
        },
    };
    if (!maps.some(m => m.id === rules.firstMapId)) fail('firstMapId');
    return deepFreeze({ rules, maps: views, guide });
}

function deepFreeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value as Row).forEach(deepFreeze); }
    return value;
}
