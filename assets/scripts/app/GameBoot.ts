import { _decorator, assetManager, Canvas, Component, director, Director, native, instantiate, JsonAsset, Label, Node, Prefab, ResolutionPolicy, resources, screen, SpriteFrame, sys, UITransform, view } from 'cc';
import { EDITOR } from 'cc/env';
import { ViewHost } from '../framework/ui/ViewHost';
import { RegisteredResource, ResourceLoader } from '../framework/resources/ResourceLoader';
import { parseGameConfig } from '../core/Config';
import { systemClock } from '../core/Clock';
import { Game } from '../core/Game';
import { Store } from '../core/Store';
import { Navigator } from './Navigator';
import { HomeController } from './HomeController';
import { DESIGN_HEIGHT, DESIGN_WIDTH, LayoutView } from '../features/ui/LayoutView';
import { PuzzlePage } from './PuzzlePage';
import { GuideCoach } from './GuideCoach';
import { EndlessPage } from './EndlessPage';
import { MapPage } from './MapPage';
import { Transition } from './Transition';

const { ccclass, property } = _decorator;
const TYPES: Record<string, RegisteredResource['type']> = { SpriteFrame, Prefab, JsonAsset };
/** Progress share of each boot step; the bar only moves forward. */
const STEPS = { config: 0.15, bundles: 0.35, save: 0.45, page: 0.9, first: 1 };
const BUNDLES = ['ui', 'map', 'puzzle'];

function loadJson(path: string): Promise<unknown> {
    return new Promise((resolve, reject) => resources.load(path, JsonAsset, (error, asset) => error ? reject(error) : resolve(asset.json)));
}

/**
 * Entry point on Main.scene. The loading screen is a start-scene prefab (its images are
 * scene dependencies), so it is on screen from the first frame. Boot loads configuration,
 * bundles and the save with real progress, builds the first page under it, then the
 * honeycomb transition replaces it.
 */
@ccclass('GameBoot')
export class GameBoot extends Component {
    @property(ViewHost) public host: ViewHost | null = null;
    @property(Label) public statusLabel: Label | null = null;
    @property(Prefab) public loadingPrefab: Prefab | null = null;
    public game: Game | null = null;
    public nav: Navigator | null = null;
    public home: HomeController | null = null;
    public puzzle: PuzzlePage | null = null;
    public endless: EndlessPage | null = null;
    private guide: GuideCoach | null = null;
    private transition: Transition | null = null;
    private loading: LayoutView | null = null;
    private progress = 0;
    private fillWidth = 0;
    private booting = false;

    protected onLoad(): void {
        if (EDITOR) return;
        this.fitResolution();
        screen.on('window-resize', this.fitResolution, this);
        this.showLoading();
        this.hideLaunchCover();
    }
    /**
     * Android shows a native launch cover (AppActivity) while the engine starts; drop it once
     * the engine has drawn the loading screen twice, so there is never a black frame between.
     */
    private hideLaunchCover(): void {
        if (!sys.isNative || sys.os !== sys.OS.ANDROID) return;
        let frames = 0;
        const after = () => {
            if (++frames < 2) return;
            director.off(Director.EVENT_AFTER_DRAW, after);
            try { native.reflection.callStaticMethod('com/cocos/game/AppActivity', 'hideLaunchCover', '()V'); }
            catch (error) { console.warn('launch cover', error); }
        };
        director.on(Director.EVENT_AFTER_DRAW, after);
    }
    protected start(): void { if (!EDITOR) void this.boot(); }

    /** Keeps the whole design area visible: wider screens get extra width, narrower ones extra height. */
    private fitResolution(): void {
        const size = screen.windowSize, wide = size.width / size.height >= DESIGN_WIDTH / DESIGN_HEIGHT;
        const policy = wide ? ResolutionPolicy.FIXED_HEIGHT : ResolutionPolicy.FIXED_WIDTH;
        view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, policy);
    }

    /** Loading prefab above the page layer, created synchronously in onLoad. */
    private showLoading(): void {
        if (!this.loadingPrefab || !this.host?.pageLayer) return;
        const node = instantiate(this.loadingPrefab);
        node.parent = this.host.pageLayer.parent;
        node.setSiblingIndex(this.host.pageLayer.getSiblingIndex() + 3); // above pages, dialogs and guides
        const view = node.getComponent(LayoutView)!;
        view.fitScreen();
        view.node.on('view-action', (event: { actionId: string }) => { if (event.actionId === 'retry') this.onRetry(); });
        this.loading = view;
        const fill = view.element('bar_fill_green').getComponent(UITransform)!;
        this.fillWidth = fill.width;
        // Grow the fill from its left edge.
        const left = view.element('bar_fill_green').position.x - fill.width * fill.anchorX;
        fill.setAnchorPoint(0, fill.anchorY);
        view.element('bar_fill_green').setPosition(left, view.element('bar_fill_green').position.y, 0);
        this.setProgress(0, '正在准备蜂巢家园…');
        if (this.statusLabel) this.statusLabel.node.active = false;
    }
    private setProgress(value: number, caption?: string): void {
        this.progress = Math.max(this.progress, Math.min(1, value));
        const v = this.loading;
        if (!v?.isValid) return;
        v.setText('loading_percent', `${Math.round(this.progress * 100)}%`);
        v.element('bar_fill_green').getComponent(UITransform)!.width = Math.max(24, this.fillWidth * this.progress);
        if (caption) v.setText('loading_caption', caption);
    }

    /** Tapping the caption after a failure retries the boot. */
    public onRetry(): void { if (!this.game) void this.boot(); }

    protected update(dt: number): void {
        this.transition?.update(dt);
        this.guide?.update(dt); this.home?.update(); this.puzzle?.update(); this.endless?.update();
    }

    private async boot(): Promise<void> {
        if (this.booting || !this.host) return;
        this.booting = true;
        this.setProgress(this.progress, '正在准备蜂巢家园…');
        try {
            const [config, art, prefabs] = await Promise.all(['config/game-config', 'config/resource-registry', 'config/ui-prefabs'].map(loadJson)) as [unknown, { resources: { id: string; bundle: string; path: string; type: string; uuid: string }[] }, typeof art];
            this.setProgress(STEPS.config);
            await this.loadBundles();
            const records = [...art.resources, ...prefabs.resources].map(r => ({ id: r.id, bundle: r.bundle, path: r.path, uuid: r.uuid, type: TYPES[r.type] }));
            const loader = new ResourceLoader(records);
            this.transition ??= new Transition(this.host.pageLayer!.parent!);
            this.nav = new Navigator(this.host, loader, this.transition);
            const parsed = parseGameConfig(config);
            const game = new Game(parsed, new Store(sys.localStorage, parsed.rules), systemClock);
            game.tick();
            this.setProgress(STEPS.save, '正在打开家园…');
            this.game = game;
            const camera = this.getComponent(Canvas)?.cameraComponent ?? null;
            const guide = this.guide = new GuideCoach(game, this.host.guideLayer!, this.nav, this.host.dialogLayer!);
            const home = this.home = new HomeController(game, this.nav, loader, guide);
            const puzzle = this.puzzle = new PuzzlePage(game, this.nav, loader, camera, guide);
            const endless = this.endless = new EndlessPage(game, this.nav, loader, camera, guide);
            home.onEndless = puzzle.onEndless = () => void endless.open();
            endless.onHome = () => void home.enter();
            const maps = new MapPage(game, this.nav, { home: mapId => void home.enter(mapId), replay: levelNo => void puzzle.play(levelNo) });
            home.onMaps = () => void maps.openMaps();
            home.onReplay = puzzle.onReplayList = () => void maps.openReplay();
            home.onPlay = () => void puzzle.play();
            puzzle.onHome = () => void home.enter();
            // The first page is built (and its pictures loaded) under the loading screen,
            // then the transition covers the loading screen and reveals the page.
            // Only what the first page shows is waited for; the bar creeps toward STEPS.page meanwhile.
            const creep = setInterval(() => this.setProgress(this.progress + (STEPS.page - this.progress) * 0.15), 100);
            try {
                if (guide.step === 'firstPuzzle') await puzzle.play(1, true); else await home.enter(null, true);
                if (guide.step !== 'firstPuzzle') await home.ready();
            } finally { clearInterval(creep); }
            this.setProgress(STEPS.first, '欢迎回来');
            await this.nav.coverWhile(() => { this.loading?.node.destroy(); this.loading = null; });
            this.warmUp();
        } catch (error) {
            console.error(error);
            this.setProgress(this.progress, '加载失败，点击这里重试');
            this.game = null;
        } finally {
            this.booting = false;
        }
    }

    /** Loads the content bundles' manifests (small); their pictures load on demand. */
    private async loadBundles(): Promise<void> {
        const share = (STEPS.bundles - STEPS.config) / BUNDLES.length;
        for (const [i, name] of BUNDLES.entries()) {
            if (!assetManager.getBundle(name)) await new Promise<void>((resolve, reject) => assetManager.loadBundle(name, error => error ? reject(error) : resolve()));
            this.setProgress(STEPS.config + share * (i + 1));
        }
    }
    /** After the first page is up, quietly preload the shared UI pictures so later dialogs open without pop-in. */
    private warmUp(): void {
        assetManager.getBundle('ui')?.preloadDir('textures', () => undefined);
    }

    protected onDestroy(): void {
        screen.off('window-resize', this.fitResolution, this);
        this.home?.dispose(); this.puzzle?.dispose(); this.endless?.dispose();
    }
}
