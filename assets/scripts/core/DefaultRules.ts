import type { BuildingRule, DailyTaskRule, EndlessShape, MainlineLevel, MapRule, Reward, Rules } from './Rules';

/**
 * Suggested numbers from docs/v2/01_游戏策划案.md §5–§12. Used by tests and as
 * the source for the v2 Excel tables; tune values there, not here, once the
 * tables exist.
 */
const r = (coins: number, energy = 0, hints = 0): Reward => ({ coins, energy, hints });

const rewards: Record<string, Reward> = {
    welcome: r(100, 0, 1),
    clear_normal: r(100), clear_challenge: r(150),
    replay_normal: r(20), replay_challenge: r(30),
    building_max: r(30),
    m01_done: r(200), m02_done: r(300), m03_done: r(500),
    level_up: r(0, 1), level_up_5: r(0, 1, 1),
    sign_1: r(50), sign_2: r(0, 1), sign_3: r(100), sign_4: r(0, 0, 1), sign_5: r(150), sign_6: r(0, 2), sign_7: r(200, 0, 1),
    task_30: r(30), task_50: r(50),
    endless_1: r(50), endless_2: r(100), endless_3: r(0, 0, 1), endless_4: r(150, 1),
};

/**
 * Levels 1–96 follow the catalog's mainlineNumber (every sixth is a challenge);
 * 97–110 continue with the remaining challenges 017–030. 80 normal + 30 challenge.
 */
export function puzzleIdFor(levelNo: number): string {
    const pad = (n: number) => String(n).padStart(3, '0');
    if (levelNo > 96) return `challenge-${pad(levelNo - 80)}`;
    if (levelNo % 6 === 0) return `challenge-${pad(levelNo / 6)}`;
    return `classic-${pad(Math.floor(levelNo / 6) * 5 + levelNo % 6)}`;
}
function mainline(count: number): MainlineLevel[] {
    return Array.from({ length: count }, (_, i) => {
        const levelNo = i + 1, puzzleId = puzzleIdFor(levelNo), kind = puzzleId.startsWith('challenge') ? 'challenge' : 'normal';
        return { levelNo, puzzleId, kind, firstClearRewardId: `clear_${kind}`, replayRewardId: `replay_${kind}` };
    });
}

const MAPS: readonly [string, number, readonly string[]][] = [
    ['M01', 1, ['B01', 'B02', 'B03', 'B04', 'B05']],
    ['M02', 1.6, ['B06', 'B07', 'B08', 'B09', 'B10']],
    ['M03', 2.4, ['B11', 'B12', 'B13', 'B14', 'B15']],
];
const maps: MapRule[] = MAPS.map(([id, factor, ids], i) => ({
    id,
    nextMapId: MAPS[i + 1]?.[0] ?? null,
    completionRewardId: `${id.toLowerCase()}_done`,
    buildings: ids.map((b): BuildingRule => ({ id: b, costs: [40, 60, 80, 100, 120].map(c => Math.round(c * factor)), maxRewardId: 'building_max' })),
}));

const tasks: DailyTaskRule[] = [
    { id: 'win_1', type: 'win', target: 1, rewardId: 'task_30', slot: 'fixed', weight: 0 },
    { id: 'win_3', type: 'win', target: 3, rewardId: 'task_50', slot: 'fixed', weight: 0 },
    { id: 'build_1', type: 'build', target: 1, rewardId: 'task_30', slot: 'rotate', weight: 1 },
    { id: 'lines_5', type: 'endlessLines', target: 5, rewardId: 'task_30', slot: 'rotate', weight: 1 },
    { id: 'score_500', type: 'endlessScore', target: 500, rewardId: 'task_30', slot: 'rotate', weight: 1 },
    { id: 'place_10', type: 'placePiece', target: 10, rewardId: 'task_30', slot: 'fallback', weight: 1 },
];

/** 1–5 cell shapes, each orientation listed separately (no rotation in play). */
const SHAPES: readonly [string, readonly (readonly [number, number])[], number][] = [
    ['s1', [[0, 0]], 6],
    ['i2a', [[0, 0], [1, 0]], 4], ['i2b', [[0, 0], [0, 1]], 4], ['i2c', [[0, 0], [1, -1]], 4],
    ['i3a', [[0, 0], [1, 0], [2, 0]], 3], ['i3b', [[0, 0], [0, 1], [0, 2]], 3], ['i3c', [[0, 0], [1, -1], [2, -2]], 3],
    ['v3a', [[0, 0], [1, 0], [0, 1]], 3], ['v3b', [[0, 0], [1, 0], [1, -1]], 3], ['l3a', [[0, 0], [1, 0], [2, -1]], 2], ['l3b', [[0, 0], [0, 1], [1, 1]], 2],
    ['i4a', [[0, 0], [1, 0], [2, 0], [3, 0]], 1], ['i4b', [[0, 0], [0, 1], [0, 2], [0, 3]], 1], ['i4c', [[0, 0], [1, -1], [2, -2], [3, -3]], 1],
    ['o4', [[0, 0], [1, 0], [0, 1], [1, -1]], 2], ['z4', [[0, 0], [1, 0], [1, 1], [2, 1]], 2], ['y4', [[0, 0], [1, 0], [2, 0], [1, -1]], 2],
    ['c5', [[0, 0], [1, 0], [0, 1], [1, -1], [-1, 1]], 1], ['i5a', [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], 1],
];
const shapes: EndlessShape[] = SHAPES.map(([id, cells, weight], i) => ({ id, cells, weight, color: i % 6 }));

export function defaultRules(): Rules {
    return {
        initialCoins: 0,
        initialHints: 5,
        energy: { max: 5, initial: 5, recoverSeconds: 300, startCost: 1, firstLevelFree: true },
        rewards,
        welcomeRewardId: 'welcome',
        guideBuildingId: 'B01',
        mainline: mainline(110),
        maps,
        firstMapId: 'M01',
        build: { expPerUpgrade: 20, constructionSeconds: 1.6 },
        // Linear 100 exp per level; every level gives 1 energy, levels 6/11/16… also a hint.
        levels: Array.from({ length: 30 }, (_, i) => ({ expToNext: 100, rewardId: i === 0 ? null : (i + 1) % 5 === 1 ? 'level_up_5' : 'level_up' })),
        signIn: ['sign_1', 'sign_2', 'sign_3', 'sign_4', 'sign_5', 'sign_6', 'sign_7'],
        daily: { tasks, chestRewardId: 'task_50', count: 3 },
        endless: {
            unlockAfterLevelNo: 5,
            radius: 4,
            traySize: 3,
            shapes,
            score: { perPlaced: 1, perCleared: 10, perLine: 20, multiLine: 20 },
            stages: [{ score: 500, rewardId: 'endless_1' }, { score: 1500, rewardId: 'endless_2' }, { score: 3000, rewardId: 'endless_3' }, { score: 6000, rewardId: 'endless_4' }],
        },
    };
}
