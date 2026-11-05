import { _decorator, Component, JsonAsset } from 'cc';
import { EventBus } from '../framework/core/EventBus';
import { I18n } from '../framework/i18n/I18n';
import { WebPlatform } from '../framework/platform/Platform';
import { ResLoader } from '../framework/res/ResLoader';
import { UIManager } from '../framework/ui/UIManager';
import { UIRoot } from '../framework/ui/UIRoot';
import { LoadingPage } from './features/boot/LoadingPage';
import { services } from './Services';

const { ccclass, property } = _decorator;

/** Composition root on Boot.scene's Canvas: creates the services, loads the text table, then hands over to LoadingPage. */
@ccclass('App')
export class App extends Component {
    @property(UIRoot) uiRoot: UIRoot = null!;

    onLoad(): void {
        services.bus = new EventBus();
        services.res = new ResLoader();
        services.i18n = new I18n(services.bus);
        I18n.current = services.i18n;
        services.platform = new WebPlatform();
        services.ui = new UIManager(this.uiRoot, services.res);
    }

    async start(): Promise<void> {
        const table = await services.res.load('common', 'i18n/zh-CN', JsonAsset);
        services.i18n.setTable('zh-CN', table.json as Record<string, string>);
        await services.ui.open(LoadingPage);
    }
}
