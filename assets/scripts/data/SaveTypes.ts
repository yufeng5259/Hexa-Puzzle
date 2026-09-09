import type { GameMode } from './LevelTypes';
import type { PuzzleSnapshot } from '../model/PuzzleModel';

export const SAVE_KEY = 'hexa-puzzle.save';
export const SAVE_BACKUP_KEY = `${SAVE_KEY}.pre-v3`;
export const SAVE_VERSION = 3;
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
export class SaveDataError extends Error {
  public constructor(public readonly code: string) { super(code); this.name = 'SaveDataError'; }
}
export type StarCount = 0 | 1 | 2 | 3;
export type CompletionMutationKind = 'first-completion' | 'improved-stars' | 'improved-metrics' | 'duplicate';
export interface LevelProgress {
  completed: boolean;
  unassisted: boolean;
  bestStars: StarCount;
  bestMoves: number | null;
  bestErrors: number | null;
  bestHintsUsed: number | null;
}
export interface MapProgress {
  /** First incomplete unlocked index, or level count when all are complete. Not a completion count. */
  maxCompleted: number;
  unlockedLevelIds: string[];
  levels: Record<string, LevelProgress>;
}
export interface LegacyLevelProgress {
  completed: boolean;
  bestStars: StarCount;
  bestMoves: number | null;
  bestErrors: number | null;
  bestHintsUsed: number | null;
  rewardStarsClaimed: StarCount;
}
export interface LegacyLevelMap {
  version: number;
  maps: Record<string, { legacyIndex: number; levelId: string | null; contentHash: string }[]>;
}
export interface LegacyArchive {
  originalData: unknown;
  maps: Record<string, { maxCompleted: number; levels: Record<string, LegacyLevelProgress> }>;
  mergedLevels: Record<string, LegacyLevelProgress>;
  rewardedTransactions: string[];
}
export interface AttemptSave {
  attemptId: string;
  mapId: string;
  levelId: string;
  mode: GameMode;
  contentVersion: number;
  status: 'active' | 'failed';
  moves: number;
  errors: number;
  hintsUsed: number;
  continuesUsed: number;
  bonusMoves: number;
  hintRefills: number;
  activeHintPieceId: string | null;
  puzzle: PuzzleSnapshot;
}
export interface AttemptInput { mapId: string; levelId: string; contentVersion: number; puzzle: PuzzleSnapshot }
export type RewardSpec = { kind: 'hints'; amount: 1 } | { kind: 'continue'; bonusMoves: 3 };
export interface RewardRequest {
  requestId: string;
  placementId: 'hint_refill' | 'challenge_continue';
  attemptId: string;
  mapId: string;
  levelId: string;
  contentVersion: number;
  rewardSpec: RewardSpec;
}
export interface PendingReward extends RewardRequest { state: 'registered' | 'awaiting_evidence' }
export type RewardSettlement = 'hint' | 'continue' | 'converted_hint' | 'compensated_hint';
export interface RewardReceiptState { outcome: 'earned' | 'closed_no_reward'; acknowledged: boolean }
export interface QuarantinedRewardReceipt {
  requestId: string;
  receiptId: string;
  reason: 'unknown_request' | 'identity_mismatch' | 'receipt_conflict';
  acknowledged: boolean;
}
export interface PlacementAvailability {
  available: boolean;
  reason: 'available' | 'invalid_placement' | 'stale_attempt' | 'attempt_not_active' | 'inventory_available' | 'hint_active' | 'no_hint_candidate' | 'quota_exhausted' | 'awaiting_evidence';
  successes: number;
  reserved: number;
  limit: number;
}
export interface TerminalReward extends RewardRequest {
  state: 'settled' | 'closed_no_reward' | 'quarantined';
  nativeAcknowledged: boolean;
  settlement: RewardSettlement | null;
  receipts: Record<string, RewardReceiptState>;
  compensated: boolean;
  localCloseReason?: string;
}
export interface SaveData {
  version: 3;
  hints: number;
  daily: { lastClaimDate: string | null; watermark: string | null };
  maps: Record<string, MapProgress>;
  legacy: LegacyArchive;
  migration: { sourceVersion: number | null; convertedHints: number; complete: true };
  identity: { installationId: string; nextSequence: number };
  currentAttempt: AttemptSave | null;
  abandonedAttempts: string[];
  rewards: { pending: Record<string, PendingReward>; terminal: Record<string, TerminalReward>; quarantinedReceipts: QuarantinedRewardReceipt[] };
}
export interface RewardSettlementResult {
  status: 'settled' | 'duplicate' | 'closed_no_reward' | 'quarantined';
  settlement: RewardSettlement | null;
  ack: { requestId: string; receiptId: string; disposition: 'settled' | 'quarantined' };
  save: SaveData;
}
export interface CompletionInput {
  mapId: string;
  levelIndex: number;
  stars?: StarCount;
  moves?: number | null;
  errors?: number | null;
  hintsUsed?: number | null;
  continuesUsed?: number | null;
  attemptId?: string;
}
export interface CompletionResult {
  firstCompletion: boolean;
  mutationKind: CompletionMutationKind;
  previous: LevelProgress | null;
  current: LevelProgress;
  /** Transitional result-view contract; there is no currency inventory. */
  save: SaveData;
}
