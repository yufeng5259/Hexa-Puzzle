import { SaveData } from '../save/SaveData';
import type { Activity } from './Activity';

/**
 * Daily systems state (F041–F045, F050, F057): tasks, weekly goal, seven-day sign-in, achievements,
 * picnic event, mailbox. Owned by the daily module; fields are added here as the module grows.
 */
export interface DailyState {}

export function newDailyState(): DailyState {
    return {};
}

/** Count an activity toward tasks, weekly goal, picnic progress and achievements. */
export function applyDailyActivity(_draft: SaveData, _activity: Activity, _today: string): void {}
