import { _decorator, AudioSource, Component, JsonAsset, ResolutionPolicy, screen, view } from 'cc';
import { DEBUG } from 'cc/env';
import { AudioService } from '../framework/audio/AudioService';
import { EventBus } from '../framework/core/EventBus';
import { I18n } from '../framework/i18n/I18n';
import { createPlatform } from '../framework/platform/Platform';
import { ResLoader } from '../framework/res/ResLoader';
import { UIManager } from '../framework/ui/UIManager';
import { UIRoot } from '../framework/ui/UIRoot';
import { LoadingPage } from './features/boot/LoadingPage';
import { services } from './Services';

const { ccclass, property } = _decorator;

const DESIGN_W = 853, DESIGN_H = 1844;

/** Composition root on Boot.scene's Canvas: creates the services, loads the text table, then hands over to LoadingPage. */
@ccclass('App')
export class App extends Component {
    private policy = -1;
    @property(UIRoot) uiRoot: UIRoot = null!;
    @property(AudioSource) audioSource: AudioSource = null!;

    onLoad(): void {
        this.adaptResolution();
        view.on('canvas-resize', this.adaptResolution, this);
        services.bus = new EventBus();
        services.res = new ResLoader();
        services.i18n = new I18n(services.bus);
        I18n.current = services.i18n;
        services.platform = createPlatform();
        services.ui = new UIManager(this.uiRoot, services.res);
        services.audio = new AudioService(this.audioSource, services.res);
        // Development builds expose the services for automated browser checks.
        if (DEBUG) (globalThis as unknown as { hexa: typeof services }).hexa = services;
    }

    /**
     * The design is 853×1844. Screens narrower than that fit the width (extra height goes to the pinned top/bottom
     * groups); wider screens (e.g. 16:9) fit the height so nothing is cut off, and CoverFit backgrounds fill the sides.
     */
    private adaptResolution(): void {
        const size = screen.windowSize;
        const wide = size.width / size.height > DESIGN_W / DESIGN_H;
        const policy = wide ? ResolutionPolicy.FIXED_HEIGHT : ResolutionPolicy.FIXED_WIDTH;
        if (this.policy === policy) return;
        this.policy = policy;
        view.setDesignResolutionSize(DESIGN_W, DESIGN_H, policy);
    }

    async start(): Promise<void> {
        const table = await services.res.load('common', 'i18n/zh-CN', JsonAsset);
        services.i18n.setTable('zh-CN', table.json as Record<string, string>);
        await services.ui.open(LoadingPage);
    }
}
