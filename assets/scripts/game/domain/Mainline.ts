import { EconomyConfig } from '../config/EconomyConfig';
import { nextId, PuzzleAttemptState, SaveData } from '../save/SaveData';
import { SaveService } from '../save/SaveService';
import { LevelDefinition } from './puzzle/LevelDefinition';
import { recordActivity } from './Activity';
import { addHoney } from './Wallet';

type Mainline = EconomyConfig['mainline'];

/** Highest playable mainline number (F008): levels unlock in order; there is no level after the last. */
export function reachableLevel(save: Readonly<SaveData>, cfg: Mainline): number {
    const highest = save.mainline.cleared.reduce((max, n) => Math.max(max, n), 0);
    return Math.min(cfg.levelCount, highest + 1);
}

export function isCleared(save: Readonly<SaveData>, level: number): boolean {
    return save.mainline.cleared.indexOf(level) >= 0;
}

export function isMainlineComplete(save: Readonly<SaveData>, cfg: Mainline): boolean {
    return isCleared(save, cfg.levelCount);
}

export function isEndlessUnlocked(save: Readonly<SaveData>, cfg: Mainline): boolean {
    return isCleared(save, cfg.endlessUnlockLevel);
}

/** New attempt for a mainline level; replaces any unfinished one (the caller confirms first, F013). */
export function startAttempt(draft: SaveData, levelNumber: number): PuzzleAttemptState {
    const attempt: PuzzleAttemptState = { attemptId: nextId(draft, 'attempt'), levelNumber, placements: {}, moves: 0, hintsUsed: 0, extraMoves: 0, continued: false, ads: {} };
    draft.attempt = attempt;
    return attempt;
}

/**
 * Challenge stars (F015). perfectMoveTarget = piece count: every piece placed once, no repositioning.
 * Continue ad -> 1; no hints and perfect moves -> 3; otherwise 2.
 */
export function challengeStars(level: LevelDefinition, attempt: Readonly<PuzzleAttemptState>): number {
    if (attempt.continued) return 1;
    return attempt.hintsUsed === 0 && attempt.moves <= level.pieces.length ? 3 : 2;
}

export interface WinReceipt {
    attemptId: string;
    levelNumber: number;
    mode: 'classic' | 'challenge';
    firstClear: boolean;
    honey: number;
    stars: number;
    bestStars: number;
    /** Replay reward withheld because today's replay quota is used up. */
    replayCapped: boolean;
}

/** Unified idempotent win settlement (F014/F015/F020/F021). */
export function settleWin(save: SaveService, cfg: Mainline, level: LevelDefinition, attempt: Readonly<PuzzleAttemptState>, today: string): WinReceipt {
    return save.claim<WinReceipt>('settle:' + attempt.attemptId, draft => {
        const n = attempt.levelNumber;
        const firstClear = draft.mainline.cleared.indexOf(n) < 0;
        let honey = 0, stars = 0, bestStars = 0, replayCapped = false;
        if (level.mode === 'challenge') {
            stars = challengeStars(level, attempt);
            const previous = draft.mainline.bestStars[level.id] ?? 0;
            honey = firstClear ? cfg.challengeFirstClear : Math.max(0, stars - previous) * cfg.starStep;
            bestStars = Math.max(previous, stars);
            draft.mainline.bestStars[level.id] = bestStars;
        } else if (firstClear) {
            honey = cfg.classicFirstClear;
        } else {
            if (draft.mainline.replayDay !== today) {
                draft.mainline.replayDay = today;
                draft.mainline.replayCount = 0;
            }
            replayCapped = draft.mainline.replayCount >= cfg.replayDailyLimit;
            if (!replayCapped) {
                draft.mainline.replayCount++;
                honey = cfg.replay;
            }
        }
        if (firstClear) draft.mainline.cleared.push(n);
        recordActivity(draft, { kind: 'puzzleWin', levelNumber: n, firstClear, mode: level.mode }, today);
        addHoney(draft, honey);
        draft.attempt = null;
        return { attemptId: attempt.attemptId, levelNumber: n, mode: level.mode, firstClear, honey, stars, bestStars, replayCapped };
    });
}
