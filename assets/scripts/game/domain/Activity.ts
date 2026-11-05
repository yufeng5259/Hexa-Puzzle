import { SaveData } from '../save/SaveData';
import { applyCollectionActivity } from './Collection';
import { applyDailyActivity } from './Daily';

/**
 * Business events recorded inside the same transaction as the action that caused them (F020/F022),
 * so tasks, weekly goals, events, photos and achievements never drift from wallet and progress.
 */
export type Activity =
    /** A mainline win was settled (valid game for tasks / weekly / picnic). */
    | { kind: 'puzzleWin'; levelNumber: number; firstClear: boolean; mode: 'classic' | 'challenge' }
    /** One building upgrade (chapter, building id, new level). */
    | { kind: 'build'; chapter: number; buildingId: number; level: number }
    /** One legal endless placement. */
    | { kind: 'endlessPlace' }
    /** An endless run was harvested; `valid` = placements ≥ 6 and score ≥ 100. */
    | { kind: 'endlessRun'; score: number; valid: boolean }
    /** Departed to a new garden. */
    | { kind: 'gardenEntered'; chapter: number };

/** Record an activity in the current draft; called by the command that produced it. */
export function recordActivity(draft: SaveData, activity: Activity, today: string): void {
    applyDailyActivity(draft, activity, today);
    applyCollectionActivity(draft, activity, today);
}
