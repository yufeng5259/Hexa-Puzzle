import { adBlock, recordAd } from './domain/Ads';
import { SaveData } from './save/SaveData';
import { services } from './Services';
import { today } from './Today';

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

export function adAvailable(placement: string): boolean {
    return adBlock(services.save.data, services.config.ads, placement, today(), nowSeconds()) === null;
}

/**
 * Show a rewarded video; when it completes, count it and apply `reward` in one transaction (F052).
 * Resolves false when skipped or unavailable — the caller keeps its free path.
 */
export async function watchAd(placement: string, reward: (draft: SaveData) => void): Promise<boolean> {
    if (!adAvailable(placement)) return false;
    const result = await services.platform.showRewardedAd(placement);
    if (result !== 'rewarded') return false;
    const day = today(), now = nowSeconds();
    services.save.transact(draft => {
        recordAd(draft, services.config.ads, placement, day, now);
        reward(draft);
    });
    return true;
}
