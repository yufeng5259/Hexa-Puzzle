import { SaveData } from '../save/SaveData';
import type { Activity } from './Activity';

/**
 * Collection state (F035–F040): companions and affinity, story reads, outfits, photos and album rewards.
 * Owned by the collection module; fields are added here as the module grows.
 */
export interface CollectionState {}

export function newCollectionState(): CollectionState {
    return {};
}

/** Photos on first builds, companion unlocks on new gardens, etc. */
export function applyCollectionActivity(_draft: SaveData, _activity: Activity, _today: string): void {}
