import { JsonAsset } from 'cc';
import { configureDaily, DailyRules } from './domain/Daily';
import { services } from './Services';

/** Load bundles/common/config/daily.json; requires services.config (economy) to be loaded first. */
export async function loadDailyConfig(): Promise<void> {
    const asset = await services.res.load('common', 'config/daily', JsonAsset);
    configureDaily(asset.json as DailyRules, services.config);
}
