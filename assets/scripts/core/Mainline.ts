import { mainlineLevel, reward, RuleError, Rules } from './Rules';
import { Attempt, GameState, grantAndShow } from './State';
import { spendEnergy } from './Energy';
import { recordDaily } from './Daily';

export function mainlineFinished(state: GameState, rules: Rules): boolean { return state.mainline.nextLevelNo > rules.mainline.length; }

/** Energy a new attempt of this level costs; the first level is free until first cleared. */
export function startCost(state: GameState, rules: Rules, levelNo: number): number {
    if (levelNo === 1 && rules.energy.firstLevelFree && !state.mainline.cleared[1]) return 0;
    return rules.energy.startCost;
}

/**
 * Starts a new attempt. Paying energy and saving the attempt happen in the same
 * commit. The old attempt is replaced only when the new one can be paid for.
 */
export function startAttempt(state: GameState, rules: Rules, now: number, levelNo: number, attemptId: string): Attempt {
    const mode = levelNo === state.mainline.nextLevelNo ? 'main' : 'replay';
    if (mode === 'main' && mainlineFinished(state, rules)) throw new RuleError('locked', 'Mainline finished');
    if (mode === 'replay' && !state.mainline.cleared[levelNo]) throw new RuleError('locked', `Level ${levelNo} not cleared yet`);
    mainlineLevel(rules, levelNo);
    if (!spendEnergy(state, rules, now, startCost(state, rules, levelNo))) throw new RuleError('energy', 'Not enough energy');
    state.mainline.attempt = { attemptId, levelNo, mode, board: null };
    return state.mainline.attempt;
}

/** Saves the in-progress board so leaving keeps the attempt. */
export function saveBoard(state: GameState, attemptId: string, board: unknown): void {
    const attempt = state.mainline.attempt;
    if (!attempt || attempt.attemptId !== attemptId) throw new RuleError('invalid', 'Attempt is no longer active');
    attempt.board = board;
}

/** Ends the attempt without reward and without any further energy cost (quit or fail). */
export function abandonAttempt(state: GameState, attemptId: string): void {
    if (state.mainline.attempt?.attemptId === attemptId) state.mainline.attempt = null;
}

/** Win: first clear pays and advances, replay pays the lower replay reward. Repeated calls do nothing. */
export function completeAttempt(state: GameState, rules: Rules, attemptId: string, day: string): 'firstClear' | 'replay' | 'duplicate' {
    const attempt = state.mainline.attempt;
    if (!attempt || attempt.attemptId !== attemptId) return 'duplicate';
    const level = mainlineLevel(rules, attempt.levelNo);
    state.mainline.attempt = null;
    let kind: 'firstClear' | 'replay';
    if (!state.mainline.cleared[level.levelNo]) {
        kind = 'firstClear';
        state.mainline.cleared[level.levelNo] = true;
        state.mainline.nextLevelNo = Math.max(state.mainline.nextLevelNo, level.levelNo + 1);
        grantAndShow(state, { id: `firstClear:${level.levelNo}`, type: 'firstClear', reward: reward(rules, level.firstClearRewardId), detail: { levelNo: level.levelNo } });
    } else {
        kind = 'replay';
        grantAndShow(state, { id: `replay:${attemptId}`, type: 'replay', reward: reward(rules, level.replayRewardId), detail: { levelNo: level.levelNo } });
    }
    recordDaily(state, rules, day, 'win', 1);
    return kind;
}

/** A valid mainline piece placement; only feeds the fallback daily task. */
export function recordPlacement(state: GameState, rules: Rules, day: string): void { recordDaily(state, rules, day, 'placePiece', 1); }

/** Spending a hint succeeds only when one is in stock; repeat viewing is handled by the puzzle session. */
export function useHint(state: GameState): void {
    if (state.wallet.hints <= 0) throw new RuleError('invalid', 'No hints left');
    state.wallet.hints -= 1;
}
