import { _decorator, Canvas, Component, JsonAsset, Label, Prefab, resources, SpriteFrame, sys } from 'cc';
import { EDITOR } from 'cc/env';
import { ViewHost } from '../framework/ui/ViewHost';
import { RegisteredResource, ResourceLoader } from '../framework/resources/ResourceLoader';
import { parseGameConfig } from '../core/Config';
import { systemClock } from '../core/Clock';
import { Game } from '../core/Game';
import { Store } from '../core/Store';
import { Navigator } from './Navigator';
import { HomeController } from './HomeController';
import { PuzzlePage } from './PuzzlePage';

const { ccclass, property } = _decorator;
const TYPES: Record<string, RegisteredResource['type']> = { SpriteFrame, Prefab, JsonAsset };

function loadJson(path: string): Promise<unknown> {
    return new Promise((resolve, reject) => resources.load(path, JsonAsset, (error, asset) => error ? reject(error) : resolve(asset.json)));
}

/**
 * Entry point on Main.scene: loads configuration, resource registries and the
 * save, shows the loading page, then hands over to the home controller.
 */
@ccclass('GameBoot')
export class GameBoot extends Component {
    @property(ViewHost) public host: ViewHost | null = null;
    @property(Label) public statusLabel: Label | null = null;
    public game: Game | null = null;
    public nav: Navigator | null = null;
    public home: HomeController | null = null;
    public puzzle: PuzzlePage | null = null;
    private booting = false;

    protected start(): void { if (!EDITOR) void this.boot(); }

    /** Serialized retry button on the scene status label. */
    public onRetry(): void { if (!this.game) void this.boot(); }

    protected update(): void { this.home?.update(); this.puzzle?.update(); }

    private async boot(): Promise<void> {
        if (this.booting || !this.host || !this.statusLabel) return;
        this.booting = true;
        this.status('正在准备蜂巢小镇…');
        try {
            const [config, art, prefabs] = await Promise.all(['config/game-config', 'config/resource-registry', 'config/ui-prefabs'].map(loadJson)) as [unknown, { resources: { id: string; bundle: string; path: string; type: string; uuid: string }[] }, typeof art];
            const records = [...art.resources, ...prefabs.resources].map(r => ({ id: r.id, bundle: r.bundle, path: r.path, uuid: r.uuid, type: TYPES[r.type] }));
            const loader = new ResourceLoader(records);
            this.nav = new Navigator(this.host, loader);
            const loading = await this.nav.replacePage('S01', () => undefined);
            this.statusLabel.node.active = false;
            loading.setText('loading_percent', '60%');
            const parsed = parseGameConfig(config);
            const game = new Game(parsed, new Store(sys.localStorage, parsed.rules), systemClock);
            game.tick();
            loading.setText('loading_percent', '100%');
            this.game = game;
            this.home = new HomeController(game, this.nav, loader);
            this.puzzle = new PuzzlePage(game, this.nav, loader, this.getComponent(Canvas)?.cameraComponent ?? null);
            const home = this.home, puzzle = this.puzzle;
            home.onPlay = () => void puzzle.play();
            puzzle.onHome = () => void home.enter();
            await this.home.enter();
        } catch (error) {
            console.error(error);
            this.status('加载失败，点击重试');
            this.statusLabel.node.active = true;
        } finally {
            this.booting = false;
        }
    }
    private status(text: string): void { if (this.statusLabel) this.statusLabel.string = text; }

    protected onDestroy(): void { this.home?.dispose(); this.puzzle?.dispose(); }
}
