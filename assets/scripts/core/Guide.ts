import { reward, RuleError, Rules } from './Rules';
import { buildingLevel, DisplayEvent, GameState, grantAndShow } from './State';

/**
 * First-run guide position, derived from real records (clear, build, welcome
 * receipt) rather than from which popups were shown, so it always resumes
 * correctly after a crash.
 */
export type GuideStep = 'firstPuzzle' | 'goBuild' | 'finishBuild' | 'welcome' | 'done';

export function guideStep(state: GameState, rules: Rules): GuideStep {
    if (state.guide.completed) return 'done';
    if (!state.mainline.cleared[1]) return 'firstPuzzle';
    if (state.pendingBuild) return 'finishBuild';
    if (buildingLevel(state, rules.firstMapId, rules.guideBuildingId) === 0) return 'goBuild';
    return 'welcome';
}

/** The only building the guide allows to be bought while step is goBuild. */
export function guideAllowsBuild(state: GameState, rules: Rules, buildingId: string): boolean {
    const step = guideStep(state, rules);
    return step === 'done' || (step === 'goBuild' && buildingId === rules.guideBuildingId);
}

/** Grants the welcome reward and finishes the guide in one commit; returns the queued display event. */
export function claimWelcome(state: GameState, rules: Rules): DisplayEvent | null {
    if (guideStep(state, rules) !== 'welcome') throw new RuleError('locked', 'Welcome reward is not available');
    const event: DisplayEvent = { id: 'welcome', type: 'welcome', reward: reward(rules, rules.welcomeRewardId) };
    const granted = grantAndShow(state, event);
    state.guide.completed = true;
    state.guide.stepId = 'done';
    return granted ? event : null;
}
