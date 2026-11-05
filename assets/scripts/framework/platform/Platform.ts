export type AdResult = 'rewarded' | 'skipped' | 'unavailable';

export interface IPlatform {
    showRewardedAd(placement: string): Promise<AdResult>;
    vibrate(kind: 'light' | 'medium'): void;
}

/** Browser/dev platform. Rewarded video is simulated as watched. Native/WeChat platforms come later. */
export class WebPlatform implements IPlatform {
    showRewardedAd(_placement: string): Promise<AdResult> {
        return new Promise(resolve => setTimeout(() => resolve('rewarded'), 300));
    }

    vibrate(_kind: 'light' | 'medium'): void {}
}
