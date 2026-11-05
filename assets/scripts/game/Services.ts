import { EventBus } from '../framework/core/EventBus';
import { I18n } from '../framework/i18n/I18n';
import { IPlatform } from '../framework/platform/Platform';
import { ResLoader } from '../framework/res/ResLoader';
import { UIManager } from '../framework/ui/UIManager';
import { EconomyConfig } from './config/EconomyConfig';
import { LevelCatalog } from './domain/puzzle/LevelCatalog';
import { SaveService } from './save/SaveService';

/** Application services, created by App and LoadingPage before any other view opens (explicit composition, no tree injection). */
export interface Services {
    bus: EventBus;
    res: ResLoader;
    ui: UIManager;
    i18n: I18n;
    platform: IPlatform;
    save: SaveService;
    config: EconomyConfig;
    catalog: LevelCatalog;
}

export const services = {} as Services;
