import { _decorator, Component } from 'cc';
import { EventBus } from '../framework/core/EventBus';
import { I18n } from '../framework/i18n/I18n';
import { WebPlatform } from '../framework/platform/Platform';
import { ResLoader } from '../framework/res/ResLoader';
import { UIManager } from '../framework/ui/UIManager';
import { UIRoot } from '../framework/ui/UIRoot';
import { services } from './Services';

const { ccclass, property } = _decorator;

/** Composition root on Boot.scene's Canvas. */
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
}
