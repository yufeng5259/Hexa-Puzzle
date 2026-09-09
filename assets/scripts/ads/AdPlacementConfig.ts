import type { AttemptSave, RewardRequest } from '../data/SaveTypes';
import type { PlacementId } from './AdProtocol';

export const AD_PROTOCOL_VERSION = 1;
export const AD_BRIDGE_TIMEOUT_MS = 15000;
export const AD_SHOW_OBSERVATION_MS = 180000;
export const AD_PLACEMENTS = {
  hint_refill: { successfulLimit: 2, rewardSpec: { kind: 'hints' as const, amount: 1 as const } },
  challenge_continue: { successfulLimit: 1, rewardSpec: { kind: 'continue' as const, bonusMoves: 3 as const } },
};
export function rewardRequestFor(requestId: string, placementId: PlacementId, attempt: AttemptSave): RewardRequest {
  const configuration = AD_PLACEMENTS[placementId];
  if (!configuration) throw new Error('Unknown rewarded placement');
  return {
    requestId, placementId, attemptId: attempt.attemptId, mapId: attempt.mapId,
    levelId: attempt.levelId, contentVersion: attempt.contentVersion, rewardSpec: { ...configuration.rewardSpec },
  };
}
