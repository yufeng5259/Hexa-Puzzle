/** Shape of bundles/common/config/economy.json. Every business number lives in that file. */
export interface EconomyConfig {
    initial: { honey: number; hints: number };
    mainline: {
        levelCount: number;
        levelsPerPage: number;
        classicFirstClear: number;
        challengeFirstClear: number;
        replay: number;
        replayDailyLimit: number;
        starStep: number;
        endlessUnlockLevel: number;
    };
    garden: {
        buildingCount: number;
        maxLevel: number;
        /** prices[chapter][currentLevel] = cost of the next upgrade */
        prices: number[][];
        chapterReward: { honey: number; hints: number };
        themes: string[];
        buildings: string[];
        rotorBuilding: number;
    };
    endless: {
        radius: number;
        trayCount: number;
        fixedSeeds: number[];
        cellScore: number;
        lineScore: number;
        multiLineScore: number;
        comboScore: number;
        harvestPerHundred: number;
        harvestRunMax: number;
        harvestDailyMax: number;
        validPlacements: number;
        validScore: number;
        dealRetries: number;
        colors: number;
        shapes: { id: string; weight: number; cells: [number, number][] }[];
    };
    ads: {
        dailyMax: number;
        intervalSeconds: number;
        /** Per-day caps by placement. */
        daily: Record<string, number>;
        /** Per-attempt caps by placement (hint, challenge continue). */
        perAttempt: Record<string, number>;
        continueMoves: number;
        bonusMax: number;
        supplyHoney: number;
        /** The first N classic levels never invite an ad (F052). */
        protectedLevels: number;
    };
}
