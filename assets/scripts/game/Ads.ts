import { debugLog } from '../framework/Log';
import { adBlock, recordAd } from './domain/Ads';
import { adId, AdRequest, AdRewardSpec, AdTarget, applyAdReward } from './domain/AdReward';
import { AdStatusPopup } from './features/common/AdStatusPopup';
import { services } from './Services';
import { today } from './Today';

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

export function adAvailable(placement: string): boolean {
    return adBlock(services.save.data, services.config.ads, placement, today(), nowSeconds()) === null;
}

export interface AdOffer {
    placement: string;
    target: AdTarget;
    reward: AdRewardSpec;
    /** What is unlocked; with `slot` it must be unique per benefit (e.g. attempt id, run id, day). */
    benefitKey: string;
}

/** Shown on the loading / confirming status popup, e.g. "+1" or "+60". */
function rewardText(reward: AdRewardSpec): string {
    if (reward.kind === 'hints' || reward.kind === 'honey') return '+' + reward.amount;
    if (reward.kind === 'continue') return '+' + reward.bonusMoves;
    return '';
}

/** Earned ads already used for this benefit today / this attempt: the ledger's benefit slot (0 or 1). */
function benefitSlot(placement: string, day: string): number {
    const save = services.save.data;
    const used = services.config.ads.perAttempt[placement] !== undefined
        ? (save.attempt?.ads[placement] ?? 0)
        : save.ads.day === day ? (save.ads.daily[placement] ?? 0) : 0;
    return Math.min(1, used);
}

/**
 * Show a rewarded video for `offer` (F052). On an earned receipt the reward, the quota count and the receipt
 * claim are saved in one transaction, then the platform is told it can drop the receipt.
 * Resolves false when skipped, unavailable or failed — callers keep their free path.
 */
export async function watchAd(offer: AdOffer): Promise<boolean> {
    if (!adAvailable(offer.placement)) return false;
    const day = today();
    const request: AdRequest = {
        requestVersion: 2, requestId: adId(`ad-${offer.placement}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`),
        ownerProfile: 'prod', source: 'native', placementId: adId(offer.placement), target: offer.target,
        benefitKey: adId(offer.benefitKey), benefitSlot: benefitSlot(offer.placement, day),
        createdAtMs: Date.now(), createdDay: day, rewardSpec: offer.reward,
    };
    const status = await services.ui.open(AdStatusPopup, { state: 'loading', reward: rewardText(offer.reward) });
    const result = await services.platform.showRewardedAd(request as unknown as Record<string, unknown> & { requestId: string });
    debugLog('Ad', offer.placement, result.earned ? 'earned' : 'not earned', result.errorCode ?? '');
    if (!result.earned || !result.receiptId) {
        if (result.errorCode && result.errorCode !== 'closed_no_reward') void services.ui.open(AdStatusPopup, { state: 'unavailable' });
        else status.close();
        return false;
    }
    status.close();
    const granted = settle(request, result.receiptId, nowSeconds());
    void services.platform.acknowledge(request.requestId, result.receiptId);
    return granted;
}

/** Grant receipts earned in a session that ended before the reward was saved (called once after loading). */
export async function recoverAds(): Promise<void> {
    for (const pending of await services.platform.pendingReceipts()) {
        const request = pending.request as unknown as AdRequest;
        if (services.save.data.claims['ad:' + pending.receiptId] === undefined) {
            const granted = settle(request, pending.receiptId, Math.floor(request.createdAtMs / 1000));
            debugLog('Ad', 'recovered', pending.requestId, granted);
        }
        await services.platform.acknowledge(pending.requestId, pending.receiptId);
    }
}

function settle(request: AdRequest, receiptId: string, atSeconds: number): boolean {
    return services.save.claim('ad:' + receiptId, draft => {
        recordAd(draft, services.config.ads, request.placementId, request.createdDay, atSeconds);
        return applyAdReward(draft, request);
    });
}
