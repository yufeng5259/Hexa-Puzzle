import { EventBus } from '../framework/core/EventBus';
import { I18n } from '../framework/i18n/I18n';
import { IPlatform } from '../framework/platform/Platform';
import { ResLoader } from '../framework/res/ResLoader';
import { UIManager } from '../framework/ui/UIManager';

/** Application services, created once by App before any view opens (explicit composition, no tree injection). */
export interface Services {
    bus: EventBus;
    res: ResLoader;
    ui: UIManager;
    i18n: I18n;
    platform: IPlatform;
}

export const services = {} as Services;
