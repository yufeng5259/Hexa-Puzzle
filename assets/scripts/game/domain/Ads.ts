import { EconomyConfig } from '../config/EconomyConfig';
import { SaveData } from '../save/SaveData';

type Ads = EconomyConfig['ads'];

export type AdBlock = 'daily' | 'interval' | 'placement' | null;

/**
 * Rewarded-ad quota (F052): global daily successes, a minimum interval between successes, and per-placement caps
 * (per day, or per attempt counted on the attempt itself). Returns why the placement is unavailable, or null.
 */
export function adBlock(save: Readonly<SaveData>, cfg: Ads, placement: string, today: string, nowSeconds: number): AdBlock {
    const sameDay = save.ads.day === today;
    if (sameDay && save.ads.total >= cfg.dailyMax) return 'daily';
    if (nowSeconds - save.ads.lastAt < cfg.intervalSeconds) return 'interval';
    const dailyCap = cfg.daily[placement];
    if (dailyCap !== undefined && sameDay && (save.ads.daily[placement] ?? 0) >= dailyCap) return 'placement';
    const attemptCap = cfg.perAttempt[placement];
    if (attemptCap !== undefined && (save.attempt?.ads[placement] ?? 0) >= attemptCap) return 'placement';
    return null;
}

/** Count one rewarded success; call inside the same transaction that grants the reward. */
export function recordAd(draft: SaveData, cfg: Ads, placement: string, today: string, nowSeconds: number): void {
    const block = adBlock(draft, cfg, placement, today, nowSeconds);
    if (block) throw new Error(`Ad ${placement} not available: ${block}`);
    if (draft.ads.day !== today) draft.ads = { day: today, total: 0, lastAt: draft.ads.lastAt, daily: {} };
    draft.ads.total++;
    draft.ads.lastAt = nowSeconds;
    draft.ads.daily[placement] = (draft.ads.daily[placement] ?? 0) + 1;
    if (cfg.perAttempt[placement] !== undefined) draft.attempt!.ads[placement] = (draft.attempt!.ads[placement] ?? 0) + 1;
}

/** Settlement bonus (F056): half of the base reward, capped. */
export function bonusAmount(cfg: Ads, baseHoney: number): number {
    return Math.min(cfg.bonusMax, Math.floor(baseHoney / 2));
}
