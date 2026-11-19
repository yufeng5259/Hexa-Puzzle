import type { BuildingRule, DailyTaskRule, EndlessShape, LeagueBot, LeagueRewardRule, LeagueRules, MainlineLevel, MapRule, Reward, Rules } from './Rules';

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
    building_max: r(30), map_done: r(200),
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
        return { levelNo, puzzleId, kind, firstClearRewardId: `clear_${kind}`, replayRewardId: `replay_${kind}`, transform: 0 };
    });
}

/**
 * docs/v2/14 §4.2: 30 maps, income multiplier and the per-level cost of each of the 5 buildings
 * (same on one map). Map n owns buildings B(5n−4)–B(5n).
 */
export const MAPS30: readonly (readonly [string, number, readonly number[]])[] = [
    ['M01', 1.0, [40, 60, 80, 100, 120]],
    ['M02', 1.5, [60, 100, 130, 160, 200]],
    ['M03', 2.0, [100, 160, 210, 260, 310]],
    ['M04', 2.5, [150, 230, 300, 380, 460]],
    ['M05', 3.0, [200, 300, 400, 500, 600]],
    ['M06', 3.25, [250, 350, 500, 600, 700]],
    ['M07', 3.5, [250, 400, 550, 700, 800]],
    ['M08', 3.75, [300, 450, 600, 750, 900]],
    ['M09', 4.0, [350, 500, 700, 850, 1050]],
    ['M10', 4.25, [400, 600, 750, 950, 1150]],
    ['M11', 4.5, [400, 650, 850, 1050, 1250]],
    ['M12', 4.75, [450, 700, 900, 1150, 1350]],
    ['M13', 5.0, [500, 750, 1000, 1200, 1450]],
    ['M14', 5.25, [500, 800, 1050, 1300, 1550]],
    ['M15', 5.5, [550, 850, 1100, 1400, 1700]],
    ['M16', 5.65, [600, 900, 1200, 1450, 1750]],
    ['M17', 5.8, [600, 900, 1250, 1550, 1850]],
    ['M18', 5.95, [650, 950, 1300, 1600, 1950]],
    ['M19', 6.1, [650, 1000, 1350, 1700, 2000]],
    ['M20', 6.25, [700, 1050, 1400, 1750, 2100]],
    ['M21', 6.4, [750, 1100, 1450, 1850, 2200]],
    ['M22', 6.55, [750, 1150, 1550, 1900, 2300]],
    ['M23', 6.7, [800, 1200, 1600, 2000, 2400]],
    ['M24', 6.85, [850, 1250, 1650, 2100, 2500]],
    ['M25', 7.0, [850, 1300, 1750, 2150, 2600]],
    ['M26', 7.15, [900, 1350, 1800, 2250, 2700]],
    ['M27', 7.3, [950, 1400, 1850, 2350, 2800]],
    ['M28', 7.45, [950, 1450, 1950, 2400, 2900]],
    ['M29', 7.6, [1000, 1500, 2000, 2500, 3000]],
    ['M30', 7.75, [1050, 1550, 2100, 2600, 3100]],
];
const bid = (n: number) => `B${String(n).padStart(2, '0')}`;
const maps: MapRule[] = MAPS30.map(([id, incomeMult, costs], i) => ({
    id,
    nextMapId: MAPS30[i + 1]?.[0] ?? null,
    completionRewardId: 'map_done',
    incomeMult,
    buildings: [1, 2, 3, 4, 5].map((slot): BuildingRule => ({ id: bid(i * 5 + slot), costs, maxRewardId: 'building_max' })),
}));
/** Coin rewards that grow with the map being built (14 §4.1); energy and hints never scale. */
const SCALED = ['clear_normal', 'clear_challenge', 'replay_normal', 'replay_challenge', 'building_max', 'map_done',
    'sign_1', 'sign_3', 'sign_5', 'sign_7', 'task_30', 'task_50', 'endless_1', 'endless_2', 'endless_4'];

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

/**
 * Bee league (docs/v2/16 §4–§5). The bot pool is 24 animals × 5 honey nicknames, generated
 * once here as the source of LeagueBots.xlsx; the numbers are tuned in Excel afterwards.
 */
export const LEAGUE_ANIMALS: readonly (readonly [string, string, string])[] = [
    ['bear', '熊', 'Bear'], ['rabbit', '兔', 'Bunny'], ['fox', '狐', 'Fox'], ['cat', '猫', 'Cat'], ['dog', '狗', 'Pup'], ['panda', '熊猫', 'Panda'],
    ['raccoon', '浣熊', 'Raccoon'], ['hedgehog', '刺猬', 'Hedgehog'], ['squirrel', '松鼠', 'Squirrel'], ['frog', '蛙', 'Frog'], ['duck', '鸭', 'Duck'], ['chick', '小鸡', 'Chick'],
    ['sloth', '树懒', 'Sloth'], ['monkey', '猴', 'Monkey'], ['tiger', '虎', 'Tiger'], ['lion', '狮', 'Lion'], ['elephant', '象', 'Elephant'], ['giraffe', '长颈鹿', 'Giraffe'],
    ['hippo', '河马', 'Hippo'], ['crocodile', '鳄鱼', 'Croc'], ['seal', '海豹', 'Seal'], ['owl', '猫头鹰', 'Owl'], ['penguin', '企鹅', 'Penguin'], ['koala', '考拉', 'Koala'],
];
const LEAGUE_PREFIXES: readonly (readonly [string, string])[] = [
    ['蜜糖', 'Honey'], ['花粉', 'Pollen'], ['嗡嗡', 'Buzzy'], ['蜂蜡', 'Waxy'], ['甜甜', 'Sweet'],
    ['金蜜', 'Golden'], ['花蜜', 'Nectar'], ['蜂巢', 'Comb'], ['小蜜', 'Little'], ['晨露', 'Dewy'],
];
const STYLES = ['casual', 'steady', 'steady', 'sprinter', 'nightOwl'] as const;
function leagueBots(): LeagueBot[] {
    const bots: LeagueBot[] = [];
    for (let n = 0; n < 5; n++) LEAGUE_ANIMALS.forEach(([avatar, zh, en], a) => {
        const i = n * LEAGUE_ANIMALS.length + a, [pz, pe] = LEAGUE_PREFIXES[(a + n * 3) % LEAGUE_PREFIXES.length];
        const style = STYLES[(a * 7 + n * 3) % STYLES.length], skill = Math.round((0.3 + ((i * 37) % 120) / 119 * 1.7) * 100) / 100;
        const night = style === 'nightOwl', sessions = style === 'casual' ? [1, 2] : style === 'steady' ? [3, 5] : [2, 4];
        bots.push({
            id: `bot${String(i + 1).padStart(3, '0')}`, name: `${pz}${zh}`, nameEn: `${pe} ${en}`, avatar, avatarBg: (a + n) % 6,
            style, skill, sessionsMin: sessions[0], sessionsMax: sessions[1],
            activeFrom: night ? 17 : 7 + (i % 3), activeTo: night ? 24 : 22 + (i % 2), sprintShare: style === 'sprinter' ? 0.4 : 0,
            tierMin: skill >= 1.4 ? 2 : 1, tierMax: skill < 0.6 ? 3 : 5,
        });
    });
    return bots;
}
const lr = (board: 'daily' | 'weekly', rankFrom: number, rankTo: number, reward: Reward, stars: number, gift: LeagueRewardRule['gift']): LeagueRewardRule => ({ board, rankFrom, rankTo, reward, stars, gift });
/** Slot curve of an n-person group: 1.5× the base score on top down to 0.1× at the bottom (16 §5.2). */
function curve(n: number): number[] {
    const daily = [1.5, 1.3, 1.15, 1, 0.92, 0.85, 0.78, 0.72, 0.66, 0.6, 0.54, 0.48, 0.42, 0.36, 0.3, 0.25, 0.2, 0.15, 0.1];
    if (n - 1 === daily.length) return daily;
    return Array.from({ length: n - 1 }, (_, i) => {
        const x = (i / (n - 2)) * (daily.length - 1), lo = Math.floor(x), hi = Math.min(daily.length - 1, lo + 1);
        return Math.round((daily[lo] + (daily[hi] - daily[lo]) * (x - lo)) * 1000) / 1000;
    });
}
export function defaultLeague(): LeagueRules {
    return {
        tiers: [
            { tier: 1, name: '工蜂', starsToNext: 50, rewardMult: 1, strength: 1, floor: 400 },
            { tier: 2, name: '采蜜蜂', starsToNext: 80, rewardMult: 1.2, strength: 1.08, floor: 600 },
            { tier: 3, name: '守卫蜂', starsToNext: 120, rewardMult: 1.4, strength: 1.16, floor: 800 },
            { tier: 4, name: '蜂王卫', starsToNext: 160, rewardMult: 1.6, strength: 1.24, floor: 1000 },
            { tier: 5, name: '蜂后', starsToNext: 0, rewardMult: 2, strength: 1.32, floor: 1200 },
        ],
        rewards: [
            lr('daily', 1, 1, r(150, 1, 1), 20, 'gold'), lr('daily', 2, 2, r(90, 1), 15, 'silver'), lr('daily', 3, 3, r(60, 0, 1), 10, 'bronze'),
            lr('daily', 4, 10, r(20), 5, 'coin'), lr('daily', 11, 20, r(0), 1, 'none'),
            lr('weekly', 1, 1, r(500, 3, 2), 0, 'gold'), lr('weekly', 2, 2, r(300, 2, 1), 0, 'silver'), lr('weekly', 3, 3, r(200, 1, 1), 0, 'bronze'),
            lr('weekly', 4, 10, r(50), 0, 'coin'), lr('weekly', 11, 30, r(0), 0, 'none'),
        ],
        curves: { daily: curve(20), weekly: curve(30) },
        bots: leagueBots(),
        sizes: { daily: 20, weekly: 30, allTime: 100 },
        dailyBaseDefault: 800, weeklyBaseDefault: 4000,
        allTimeMin: 300, allTimeMax: 30000, allTimeGrowMin: 0.01, allTimeGrowMax: 0.03,
        pendingMax: 7, jitter: 0.1, sprintHours: 3,
    };
}

export function defaultRules(): Rules {
    return {
        initialCoins: 0,
        initialHints: 5,
        energy: { max: 5, initial: 5, recoverSeconds: 300, startCost: 1, firstLevelFree: true },
        rewards, scaledRewards: [...SCALED].sort(),
        welcomeRewardId: 'welcome',
        guideBuildingId: 'B01',
        mainline: mainline(110),
        // After level 110 the same order repeats: rotate 180°, mirror, then the other symmetries.
        loopTransforms: [3, 6, 1, 9, 2, 7, 4, 10, 5, 8, 11],
        maps,
        firstMapId: 'M01',
        build: {
            expPerUpgrade: 20, constructionSeconds: 2,
            fx: { scaffoldEnd: 0.1, carryStart: 0.05, carryEnd: 0.35, hammerStart: 0.25, cloudStart: 0.8, revealAt: 0.92, sparkleSeconds: 0.4, beeFraction: 0.3, resumeFrom: 0.75 },
        },
        anim: {
            progressSeconds: 0.25, cardSeconds: 0.24, cardStaggerSeconds: 0.08, scatterSeconds: 0.12, flySeconds: 0.55, pulseSeconds: 0.16,
            skipAfterSeconds: 0.3, rewardTimeoutSeconds: 3, chestShakeSeconds: 0.24, chestOpenSeconds: 0.18, coinParticlesMax: 12,
            winHoldSeconds: 0.15, winWaveSeconds: 0.6, winFlashSeconds: 0.1,
            winCelebrateAt: 0.6, winCelebrateSeconds: 0.6, winCoinsAt: 1.2, winBarAt: 1.4, winBarSeconds: 0.25, winConfettiCount: 40, resultEnterSeconds: 0.18, failSeconds: 0.18, boardFadeSeconds: 0.18, firstWinLimitSeconds: 2.2,
            endlessSettleSeconds: 0.1, endlessHighlightSeconds: 0.12, endlessClearSeconds: 0.22, endlessScoreSeconds: 0.3, endlessRefillSeconds: 0.18,
            endlessDimSeconds: 0.18, scoreRollSeconds: 0.45, recordSeconds: 0.3,
            endlessSwapOutSeconds: 0.12, endlessSwapInSeconds: 0.2, endlessHammerSeconds: 0.15, endlessShatterSeconds: 0.2,
        },
        // Linear 100 exp per level; every level gives 1 energy, levels 6/11/16… also a hint.
        levels: Array.from({ length: 160 }, (_, i) => ({ expToNext: 100, rewardId: i === 0 ? null : (i + 1) % 5 === 1 ? 'level_up_5' : 'level_up' })),
        signIn: ['sign_1', 'sign_2', 'sign_3', 'sign_4', 'sign_5', 'sign_6', 'sign_7'],
        daily: { tasks, chestRewardId: 'task_50', count: 3 },
        endless: {
            unlockAfterLevelNo: 5,
            radius: 4,
            traySize: 3,
            shapes,
            score: { perPlaced: 1, perCleared: 10, perLine: 20, multiLine: 20 },
            stages: [{ score: 500, rewardId: 'endless_1' }, { score: 1500, rewardId: 'endless_2' }, { score: 3000, rewardId: 'endless_3' }, { score: 6000, rewardId: 'endless_4' }],
            tools: { swap: 1, hammer: 1, swapRetries: 8 },
        },
        league: defaultLeague(),
    };
}
