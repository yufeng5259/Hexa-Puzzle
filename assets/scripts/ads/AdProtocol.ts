import type { RewardRequest } from '../data/SaveTypes';

export type PlacementId = RewardRequest['placementId'];
export interface NativeRewardReceipt extends RewardRequest {
  protocolVersion: 1;
  receiptId: string;
  outcome: 'earned' | 'closed_no_reward';
  errorCode?: string;
}
export interface AdPresentation {
  requestId: string;
  presentationEnded: boolean;
  showing: boolean;
  receipt?: NativeRewardReceipt;
}
export interface NativeAdEvent {
  event: 'rewarded_ad';
  requestId: string;
  phase: 'showing' | 'earned' | 'dismissed' | 'failed';
  presentationEnded?: boolean;
  receipt?: NativeRewardReceipt;
  errorCode?: string;
}
export interface RewardAcknowledgement {
  requestId: string;
  receiptId: string;
  disposition: 'settled' | 'quarantined';
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function validIdentity(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9:_-]{1,192}$/.test(value) && value !== '__proto__' && value !== 'constructor';
}
export function isRewardRequest(value: unknown): value is RewardRequest {
  if (!isRecord(value) || !validIdentity(value.requestId) || !validIdentity(value.attemptId)
    || !validIdentity(value.mapId) || !validIdentity(value.levelId)
    || !Number.isSafeInteger(value.contentVersion) || (value.contentVersion as number) < 1 || !isRecord(value.rewardSpec)) return false;
  const reward = value.rewardSpec;
  return value.placementId === 'hint_refill' ? reward.kind === 'hints' && reward.amount === 1 && Object.keys(reward).length === 2
    : value.placementId === 'challenge_continue' && reward.kind === 'continue' && reward.bonusMoves === 3 && Object.keys(reward).length === 2;
}
export function isNativeReceipt(value: unknown): value is NativeRewardReceipt {
  return isRewardRequest(value) && isRecord(value) && value.protocolVersion === 1 && validIdentity(value.receiptId)
    && (value.outcome === 'earned' || value.outcome === 'closed_no_reward')
    && (value.errorCode === undefined || typeof value.errorCode === 'string');
}
export function isNativeAdEvent(value: unknown): value is NativeAdEvent {
  return isRecord(value) && value.event === 'rewarded_ad' && validIdentity(value.requestId)
    && ['showing', 'earned', 'dismissed', 'failed'].indexOf(value.phase as string) >= 0
    && (value.presentationEnded === undefined || typeof value.presentationEnded === 'boolean')
    && (value.receipt === undefined || isNativeReceipt(value.receipt))
    && (value.phase !== 'earned' || (isNativeReceipt(value.receipt) && value.receipt.outcome === 'earned'))
    && (value.receipt === undefined || (value.receipt as NativeRewardReceipt).requestId === value.requestId);
}
export function isPresentation(value: unknown): value is AdPresentation {
  return isRecord(value) && validIdentity(value.requestId) && typeof value.presentationEnded === 'boolean'
    && typeof value.showing === 'boolean' && !(value.presentationEnded && value.showing)
    && (value.receipt === undefined || (isNativeReceipt(value.receipt) && value.receipt.requestId === value.requestId));
}
export function copyRequest(request: RewardRequest): RewardRequest { return JSON.parse(JSON.stringify(request)) as RewardRequest; }
