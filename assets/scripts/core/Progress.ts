import { mapRule, reward, RuleError, Rules } from './Rules';
import { buildingLevel, GameState, grantAndShow } from './State';
import { recordDaily } from './Daily';

/** Unlocked once the first-build guide (including the welcome gift) is done. */
export function dailyUnlocked(state: GameState): boolean { return state.guide.completed; }
export function endlessUnlocked(state: GameState, rules: Rules): boolean {
    return !!state.mainline.cleared[rules.endless.unlockAfterLevelNo];
}

/** Adds exp and grants every level reached, in order. */
export function addExp(state: GameState, rules: Rules, amount: number, source: string): void {
    // levels[i] describes level i+1; levels past the table repeat the last row.
    const row = (level: number) => rules.levels[Math.min(level - 1, rules.levels.length - 1)];
    state.player.exp += amount;
    while (state.player.exp >= row(state.player.level).expToNext) {
        state.player.exp -= row(state.player.level).expToNext;
        state.player.level += 1;
        const rewardId = row(state.player.level).rewardId;
        if (rewardId) grantAndShow(state, { id: `level:${state.player.level}`, type: 'levelUp', reward: reward(rules, rewardId), detail: { level: state.player.level, source } });
    }
}

export function upgradeCost(state: GameState, rules: Rules, mapId: string, buildingId: string): number | null {
    const building = mapRule(rules, mapId).buildings.find(b => b.id === buildingId);
    if (!building) throw new RuleError('invalid', `Unknown building ${mapId}/${buildingId}`);
    const level = buildingLevel(state, mapId, buildingId);
    return level < building.costs.length ? building.costs[level] : null;
}

export function mapProgress(state: GameState, rules: Rules, mapId: string): { built: number; total: number } {
    const map = mapRule(rules, mapId);
    return {
        built: map.buildings.reduce((sum, b) => sum + buildingLevel(state, mapId, b.id), 0),
        total: map.buildings.reduce((sum, b) => sum + b.costs.length, 0),
    };
}

/** Step 1 of a build: pay and record the pending build. The building keeps its old level. */
export function startBuild(state: GameState, rules: Rules, mapId: string, buildingId: string, buildId: string): void {
    if (state.pendingBuild) throw new RuleError('pending', 'Another build is still in progress');
    if (mapId !== state.maps.currentMapId || state.maps.completed[mapId]) throw new RuleError('locked', `Map ${mapId} is not the active build map`);
    const cost = upgradeCost(state, rules, mapId, buildingId);
    if (cost === null) throw new RuleError('maxed', `${buildingId} is already at max level`);
    if (state.wallet.coins < cost) throw new RuleError('coins', `Need ${cost} coins`);
    const fromLevel = buildingLevel(state, mapId, buildingId);
    state.wallet.coins -= cost;
    state.pendingBuild = { buildId, mapId, buildingId, fromLevel, toLevel: fromLevel + 1, paidCost: cost };
}

/** Step 2: after construction, commit the new level and every follow-up reward. Never charges again. */
export function finishBuild(state: GameState, rules: Rules, buildId: string, dayId: string): void {
    const pending = state.pendingBuild;
    if (!pending || pending.buildId !== buildId) throw new RuleError('invalid', `No pending build ${buildId}`);
    const map = mapRule(rules, pending.mapId), building = map.buildings.find(b => b.id === pending.buildingId)!;
    (state.maps.levels[pending.mapId] ??= {})[pending.buildingId] = pending.toLevel;
    state.pendingBuild = null;
    addExp(state, rules, rules.build.expPerUpgrade, `build:${buildId}`);
    if (pending.toLevel === building.costs.length && building.maxRewardId) {
        grantAndShow(state, { id: `buildingMax:${map.id}:${building.id}`, type: 'buildingMax', reward: reward(rules, building.maxRewardId), detail: { mapId: map.id, buildingId: building.id } });
    }
    const progress = mapProgress(state, rules, map.id);
    if (progress.built === progress.total && !state.maps.completed[map.id]) {
        state.maps.completed[map.id] = true;
        if (map.completionRewardId) grantAndShow(state, { id: `mapComplete:${map.id}`, type: 'mapComplete', reward: reward(rules, map.completionRewardId), detail: { mapId: map.id } });
    }
    recordDaily(state, rules, dayId, 'build', 1);
}

/** Moves on after the current map is complete. Returns false when no further map exists. */
export function goToNextMap(state: GameState, rules: Rules): boolean {
    const current = mapRule(rules, state.maps.currentMapId);
    if (!state.maps.completed[current.id]) throw new RuleError('locked', 'Current map is not complete');
    if (!current.nextMapId) return false;
    state.maps.currentMapId = mapRule(rules, current.nextMapId).id;
    return true;
}

/** True when nothing is left to build anywhere reachable. */
export function allBuildingsDone(state: GameState, rules: Rules): boolean {
    const current = mapRule(rules, state.maps.currentMapId);
    return !!state.maps.completed[current.id] && !current.nextMapId;
}
