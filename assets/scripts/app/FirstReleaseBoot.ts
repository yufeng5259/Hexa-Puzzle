import { _decorator, Canvas, Component, Director, director, Game, game, isValid, JsonAsset, Label, Node, Prefab, ResolutionPolicy, resources, sys, UITransform, view } from 'cc';
import { EDITOR } from 'cc/env';
import { ViewHost } from '../framework/ui/ViewHost';
import { BaseView } from '../framework/ui/BaseView';
import type { ResourceScope } from '../framework/resources/ResourceScope';
import { GardenAssetStore, FoundationArtManifest, FoundationPrefabRegistry } from '../features/garden/resources/GardenAssetStore';
import { LoadingPageView } from '../features/boot/ui/LoadingPageView';
import { HomeBuildView } from '../features/home/ui/HomeBuildView';
import { FirstReleaseDialogView, DialogOptions } from '../features/common/ui/FirstReleaseDialogView';
import { FirstReleasePuzzleView } from '../features/puzzle/ui/FirstReleasePuzzleView';
import { PuzzleSession, PuzzleSessionSnapshot } from '../features/puzzle/session/PuzzleSession';
import { LevelCatalog } from '../features/puzzle/data/LevelCatalog';
import { MetaManager } from '../features/config/MetaManager';
import { GameStateStore, SavedPuzzleSnapshot } from '../features/progression/GameStateStore';
import { GameServices, ProgressionError, ProgressionEvent } from '../features/progression/GameServices';
import { GuideOverlayView, GuideTarget } from '../features/guide/GuideOverlayView';
import { GuideCoordinator } from '../features/guide/GuideCoordinator';
import { GuideTargetRegistry } from '../features/guide/GuideTargetRegistry';
const { ccclass, property } = _decorator;

/** Single composition root. Views share the existing ViewHost/resource scopes and one durable state. */
@ccclass('FirstReleaseBoot')
export class FirstReleaseBoot extends Component {
    @property(ViewHost) public host: ViewHost | null = null;
    @property(Prefab) public loadingPrefab: Prefab | null = null;
    @property(Label) public statusLabel: Label | null = null;
    public ready = false;
    public currentRoute = 'loading';
    public navigating = false;
    public meta: MetaManager | null = null;
    public services: GameServices | null = null;
    public homeView: HomeBuildView | null = null;
    public puzzleView: FirstReleasePuzzleView | null = null;
    public dialogView: FirstReleaseDialogView | null = null;
    public guide: GuideCoordinator | null = null;
    public catalog: LevelCatalog | null = null;
    private assets: GardenAssetStore | null = null;
    private documents: JsonAsset[] = [];
    private dataScope: ResourceScope | null = null;
    private overlay: GuideOverlayView | null = null;
    private disposed = false;
    private renderPending = false;
    private outcomeId = '';
    private dialogKind = '';
    private unsubscribe: (() => void) | null = null;
    private loading: LoadingPageView | null = null;
    private homeMode: 'home' | 'build' = 'home';
    private eventQueue: ProgressionEvent[] = [];
    private dialogEpoch = 0;
    private syncingBrowserFrame = false;
    private welcomeOpening = false;
    /** Candidate currently produced by the live session's own rules; it needs no replay proof. */
    private trustedSnapshot: PuzzleSessionSnapshot | null = null;

    public get activeAttempt(): PuzzleSessionSnapshot | null { return this.puzzleView?.session?.snapshot || null; }
    public get currentPuzzleController() { return this.puzzleView?.controller || null; }
    public get overlayCount(): number { return this.dialogView ? 1 : 0; }
    /** Native verification hooks; the coordinator owns registration. */
    public get targets(): GuideTargetRegistry<GuideTarget> | null { return this.guide?.targets ?? null; }
    public bindGuideTargets(): void { this.guide?.bindTargets(); }

    public async start(): Promise<void> {
        if (EDITOR) return;
        try {
            if (!this.host || !this.loadingPrefab || !this.statusLabel) throw new Error('FirstReleaseBoot: missing Inspector bindings');
            view.setDesignResolutionSize(853, 1844, ResolutionPolicy.SHOW_ALL);
            this.loading = this.host.open(this.loadingPrefab).node.getComponent(LoadingPageView);
            if (!this.loading) throw new Error('Loading Prefab requires LoadingPageView');
            this.loading.setProgress(0); this.fit(); this.statusLabel.node.active = false;
            const [art, registry] = await Promise.all([this.loadDocument('framework/config/source-art-manifest'), this.loadDocument('framework/config/prefab-registry')]);
            if (this.disposed) return;
            this.assets = new GardenAssetStore(art.json as FoundationArtManifest, registry.json as FoundationPrefabRegistry);
            this.loading.setProgress(.3);
            this.dataScope = this.assets.createScope();
            const [config, levels] = await Promise.all([this.dataScope.load('data:game-config', JsonAsset), this.dataScope.load('data:level-catalog', JsonAsset)]);
            if (this.disposed) return;
            this.meta = new MetaManager(config.json); this.catalog = new LevelCatalog(levels.json);
            for (const line of this.meta.getMainlines()) this.catalog.getById(line.puzzleId);
            const store = new GameStateStore(sys.localStorage, this.meta);
            this.services = new GameServices(store, this.meta, Date.now, snapshot => this.validateSnapshot(snapshot));
            this.services.refresh(); this.services.reconcileGuide();
            this.unsubscribe = this.services.subscribe(event => { this.eventQueue.push(event); this.requestRender(); });
            this.loading.setProgress(.65);
            this.overlay = await this.mount('first-guide', GuideOverlayView, 'guide');
            this.guide = new GuideCoordinator(this.meta, this.services, this.overlay, {
                route: () => ({ route: this.currentRoute, homeMode: this.homeMode, dialogKind: this.dialogKind,
                    puzzle: this.puzzleView, home: this.homeView, dialog: this.dialogView }),
                notice: (message, sticky) => this.notice(message, sticky),
                clearNotice: () => this.clearNotice(),
                recoveryNode: () => this.statusLabel!.node,
            }, this.node);
            view.on('canvas-resize', this.fit, this);
            game.on(Game.EVENT_HIDE, this.checkpoint, this); game.on(Game.EVENT_SHOW, this.onForeground, this);
            this.schedule(this.tick, 1);
            if (this.services.getGuidePhase() === 'puzzle') await this.showPuzzle(); else await this.showHome('home');
            if (this.disposed) return;
            this.loading.setProgress(1); this.loading.close(); this.loading = null;
            this.ready = true; this.statusLabel.node.active = false;
        } catch (error) { this.notice('初始化失败，点击上方提示重试：' + this.message(error), true); console.error(error); }
    }

    private validateSnapshot(snapshot: SavedPuzzleSnapshot): void {
        if (snapshot === this.trustedSnapshot) return;
        if (!this.catalog) throw new Error('Missing puzzle catalog');
        const proof = new PuzzleSession(this.catalog.getById(snapshot.levelId), snapshot.attemptId);
        proof.restore(snapshot as PuzzleSessionSnapshot);
    }
    private loadDocument(path: string): Promise<JsonAsset> {
        return new Promise((resolve, reject) => resources.load(path, JsonAsset, (error, asset) => {
            if (error) { reject(error); return; }
            asset.addRef();
            if (this.disposed) { asset.decRef(); reject(new Error('Application destroyed')); return; }
            this.documents.push(asset); resolve(asset);
        }));
    }
    private async mount<T extends BaseView>(id: string, type: new () => T, layer: 'page' | 'dialog' | 'guide' = 'page'): Promise<T> {
        const scope = this.assets!.createScope();
        let transferred = false;
        try {
            const prefab = await scope.load('prefab:' + id, Prefab);
            if (this.disposed) throw new Error('Application destroyed');
            transferred = true;
            const mounted = this.host!.open(prefab, layer, scope);
            const component = mounted.node.getComponent(type);
            if (!component) { mounted.close(); throw new Error(id + ': missing View component'); }
            component.node.on('view-action', this.onViewAction, this);
            this.fitNode(component.node); return component;
        } catch (error) { if (!transferred) scope.release(); throw error; }
    }
    private async showHome(mode: 'home' | 'build'): Promise<void> {
        this.closeDialog(); this.guide?.suspend();
        if (!this.homeView) this.homeView = await this.mount('home', HomeBuildView);
        if (this.disposed) return;
        await this.homeView.setData(this.meta!, this.services!.state);
        if (this.disposed) return;
        this.puzzleView?.close(); this.puzzleView = null;
        this.homeMode = mode; this.homeView.setMode(mode); this.homeView.show(); this.currentRoute = mode;
        this.guide?.sync(); this.fit();
        if (this.services!.getGuidePhase() === 'welcome') await this.showWelcome();
    }
    private allowsAction(action: string): boolean {
        if (this.services?.getGuidePhase() === 'complete') return true;
        return !!this.guide?.allowsAction(action);
    }
    private async showPuzzle(): Promise<void> {
        const attempt = this.services!.startOrResume();
        const level = this.catalog!.getById(attempt.puzzleId);
        const session = new PuzzleSession(level, attempt.attemptId);
        if (attempt.snapshot) session.restore(attempt.snapshot as PuzzleSessionSnapshot);
        session.beforeCommit = candidate => {
            this.trustedSnapshot = candidate;
            try { this.services!.saveAttempt(candidate); } finally { this.trustedSnapshot = null; }
        };
        const next = await this.mount('firstrelease-puzzle', FirstReleasePuzzleView);
        try {
            const scope = this.assets!.createScope();
            // Board borrows an explicit scope owned by the view's entire lifetime.
            next.node.once(Node.EventType.NODE_DESTROYED, () => director.once(Director.EVENT_AFTER_UPDATE, () => scope.release()));
            await next.setLevel(scope, { ...level, mainlineNumber: attempt.levelNo }, session, this.node.getComponent(Canvas)?.cameraComponent);
            if (this.disposed || next.isClosed) return;
            this.closeDialog(); this.homeView?.hide(); this.puzzleView?.close(); this.puzzleView = next;
            this.currentRoute = 'puzzle'; this.outcomeId = '';
            next.setHints(this.services!.state.hints);
            next.controller!.onError = error => this.notice(this.message(error));
            this.guide!.attachPuzzle(next, () => !!this.dialogView);
            next.controller!.onOutcome = () => { this.requestRender(); };
            this.guide!.sync(true); this.fit(); next.controller!.resume();
        } catch (error) { next.close(); throw error; }
    }
    private requestRender(): void {
        if (this.disposed || this.renderPending) return;
        this.renderPending = true;
        this.scheduleOnce(() => {
            this.renderPending = false;
            if (this.disposed) return;
            // The guide consumes committed events before views react to them.
            this.guide?.deliver(this.eventQueue.splice(0));
            if (this.homeView?.isShown && this.services!.getGuidePhase() !== 'welcome') void this.homeView.setData(this.meta!, this.services!.state).catch(error => this.notice(this.message(error)));
            this.puzzleView?.setHints(this.services!.state.hints);
            if (this.puzzleView?.session?.snapshot.status !== 'active' && this.currentRoute === 'puzzle' && this.puzzleView) void this.showOutcome().catch(error => this.notice(this.message(error)));
            if (this.services!.getGuidePhase() === 'welcome' && !this.dialogView && (this.currentRoute === 'home' || this.currentRoute === 'build')) void this.showWelcome().catch(error => this.notice(this.message(error), true));
        }, 0);
    }
    private async showWelcome(): Promise<void> {
        if (this.disposed || this.welcomeOpening || this.services!.getGuidePhase() !== 'welcome' || this.dialogKind === 'welcome' && this.dialogView) return;
        this.welcomeOpening = true;
        try {
            if (this.homeView?.isShown) await this.homeView.setData(this.meta!, this.services!.state);
            const reward = this.meta!.getReward(this.meta!.getConstant<string>('welcomeRewardId'));
            await this.openDialog({ title: '欢迎来到花园！', body: '闯关赚取蜜蜂币\n建造属于你的花园', primary: '领取并开始', primaryAction: 'welcome:claim', closable: false, rewards: { coins: reward.coins, hints: reward.hints } }, 'welcome');
            this.guide?.sync();
        } finally { this.welcomeOpening = false; }
    }
    private async showOutcome(): Promise<void> {
        const session = this.puzzleView?.session;
        if (!session || session.snapshot.status === 'active' || this.outcomeId === session.attemptId || this.dialogView) return;
        this.outcomeId = session.attemptId;
        const won = session.snapshot.status === 'completed';
        const phase = this.services!.getGuidePhase();
        const line = this.meta!.getMainline(this.services!.state.activeAttempt!.levelNo), reward = this.meta!.getReward(line.rewardId);
        try {
            await this.openDialog(won ? {
                title: '拼图完成！', body: '获得蜜蜂币 ' + reward.coins, primary: '回家', primaryAction: 'result:home',
                secondary: phase === 'complete' && this.services!.state.currentLevelNo <= this.meta!.getMainlineCount() ? '下一关' : '', secondaryAction: 'result:next',
            } : { title: '再试一次', body: '步数用完了，调整一下放置顺序吧。', primary: '重试', primaryAction: 'result:next', secondary: '回家', secondaryAction: 'result:home' }, 'result');
            this.guide?.sync();
        } catch (error) { this.outcomeId = ''; throw error; }
    }
    private async openDialog(options: DialogOptions, kind = 'notice'): Promise<void> {
        this.closeDialog(); this.guide?.suspend(); this.puzzleView?.controller?.suspend();
        const epoch = ++this.dialogEpoch;
        this.dialogKind = kind;
        try {
            const dialog = await this.mount('firstrelease-dialog', FirstReleaseDialogView, 'dialog');
            if (this.disposed || epoch !== this.dialogEpoch) { dialog.close(); return; }
            this.dialogView = dialog; dialog.configure(options); this.fit();
        } catch (error) {
            if (epoch === this.dialogEpoch && !this.disposed) {
                this.dialogKind = ''; this.puzzleView?.controller?.resume(); this.guide?.sync();
            }
            throw error;
        }
    }
    private closeDialog(): void {
        this.dialogEpoch++;
        this.dialogView?.close(); this.dialogView = null; this.dialogKind = '';
        if (this.currentRoute === 'puzzle' && this.puzzleView?.session?.snapshot.status === 'active') this.puzzleView.controller?.resume();
    }
    private readonly onViewAction = (payload: { actionId: string }): void => {
        if (this.disposed || this.navigating || !this.allowsAction(payload.actionId)) return;
        this.navigating = true;
        void this.handleAction(payload.actionId).catch(error => this.handleFailure(error)).finally(() => { this.navigating = false; });
    };
    private async handleAction(action: string): Promise<void> {
        if (!this.allowsAction(action)) return;
        const services = this.services!, state = services.state;
        if (action === 'welcome:claim') {
            if (services.claimWelcome()) { await this.showHome('home'); this.notice('欢迎礼已领取，继续挑战第' + services.state.currentLevelNo + '关吧！'); }
            return;
        }
        if (action === 'home:play' || action === 'result:next' || action === 'coins:play') { await this.showPuzzle(); return; }
        if (action === 'home:build' || action === 'home:back' || action === 'result:home' || action === 'puzzle:home') {
            await this.showHome(action === 'home:build' ? 'build' : 'home'); return;
        }
        if (action === 'settings') { await this.openSettings(); return; }
        if (action.startsWith('settings:')) {
            const key = action.slice(9);
            if (key === 'language') { this.notice('当前版本提供简体中文'); return; }
            if (key === 'music' || key === 'sound' || key === 'vibration') services.updateSettings({ [key]: !state.settings[key] });
            this.dialogView?.configure({ title: '设置', body: '', primary: '确定', primaryAction: 'dialog:close', settings: services.state.settings }); return;
        }
        if (action === 'dialog:close' || action === 'dialog:cancel') {
            if (this.dialogKind === 'result') { await this.showHome('home'); return; }
            this.closeDialog(); this.guide?.sync(); return;
        }
        if (action.startsWith('building:upgrade:')) {
            const slot = Number(action.split(':')[2]), level = state.buildings[state.currentMapId][String(slot)];
            const row = this.meta!.getMapBuildings(state.currentMapId).find(item => item.slotId === slot)!;
            const cost = this.meta!.getBuildingStage(row.buildingId, level + 1).cost;
            if (state.coins < cost) {
                await this.openDialog({ title: '蜜蜂币不足', body: '当前拥有 ' + state.coins + '\n本次需要 ' + cost + '\n还差 ' + (cost - state.coins), primary: '去闯关', primaryAction: 'coins:play', secondary: '关闭' }); return;
            }
            services.upgrade(state.currentMapId, slot, level); return;
        }
        if (action === 'map:claim') {
            const mapId = state.currentMapId;
            if (services.claimMap(mapId)) {
                await this.homeView!.setData(this.meta!, services.state);
                await this.openDialog({ title: '地图建设完成！', body: services.state.currentMapId === mapId ? '奖励已领取，更多地图即将开放。' : '奖励已领取，新的地图等你建设！', primary: '确定' });
            }
            return;
        }
        if (action === 'puzzle:undo') { this.puzzleView?.undo(); return; }
        if (action === 'puzzle:hint') { this.puzzleView?.showHint(); return; }
        if (action === 'puzzle:restart') {
            await this.openDialog({ title: '重新开始？', body: state.activeAttempt?.tutorial ? '本关教学不会消耗体力。' : '重新开始会消耗' + this.meta!.getConstant<number>('energyFailureCost') + '点体力。', primary: '重新开始', primaryAction: 'puzzle:confirm-restart', secondary: '取消' }); return;
        }
        if (action === 'puzzle:confirm-restart' || action === 'puzzle:abandon') {
            if (state.activeAttempt) services.endAttempt(state.activeAttempt.attemptId, action.endsWith('restart') ? 'restart' : 'abandoned');
            if (action.endsWith('restart')) await this.showPuzzle(); else await this.showHome('home'); return;
        }
        if (action === 'puzzle:back') {
            await this.openDialog({ title: '暂停拼图', body: '本局会保存，回家后点击Play可继续。', primary: '保留本局回家', primaryAction: 'puzzle:home', secondary: '放弃本局', secondaryAction: 'puzzle:confirm-abandon' }); return;
        }
        if (action === 'puzzle:confirm-abandon') {
            await this.openDialog({ title: '放弃本局？', body: state.activeAttempt?.tutorial ? '本关教学不会消耗体力。' : '放弃会消耗' + this.meta!.getConstant<number>('energyFailureCost') + '点体力。', primary: '放弃', primaryAction: 'puzzle:abandon', secondary: '取消' }); return;
        }
    }
    private async openSettings(): Promise<void> {
        await this.openDialog({ title: '设置', body: '', primary: '确定', primaryAction: 'dialog:close', settings: this.services!.state.settings }, 'settings');
    }
    private handleFailure(error: unknown): void {
        const code = error instanceof ProgressionError ? error.code : null;
        if (code === 'energy') {
            void this.openDialog({ title: '体力不足', body: this.energyMessage(), primary: '知道了', secondary: '回家', secondaryAction: 'result:home' }, 'energy').catch(e => this.notice(this.message(e)));
        } else if (code === 'hints') {
            void this.openDialog({ title: '提示不足', body: '当前没有可用提示，先试试调整拼块吧。', primary: '继续拼图' }).catch(e => this.notice(this.message(e)));
        } else this.notice(this.message(error));
    }
    private energyMessage(): string {
        const seconds = this.services!.secondsToEnergy();
        const interval = this.meta!.getConstant<number>('energyRecoverSeconds');
        const cycle = interval % 60 === 0 ? interval / 60 + '分钟' : interval + '秒';
        return '每' + cycle + '恢复1点体力\n距离下次恢复：' + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    }
    private readonly tick = (): void => {
        if (!this.services || this.disposed) return;
        try {
            this.services.refresh(); this.homeView?.refreshEnergy(this.meta!, this.services.state);
            this.guide?.tick();
            if (this.ready && this.homeView?.isShown && (this.currentRoute === 'home' || this.currentRoute === 'build') && this.services.getGuidePhase() === 'welcome' && !this.dialogView && !this.navigating) void this.showWelcome().catch(error => this.notice(this.message(error), true));
            if (this.dialogKind === 'energy') this.dialogView?.configure({ title: '体力不足', body: this.energyMessage(), primary: '知道了', secondary: '回家', secondaryAction: 'result:home' });
        } catch (error) { this.notice(this.message(error)); }
    };
    private readonly checkpoint = (): void => { try { this.services?.store.transact(null, () => {}); } catch (error) { this.notice(this.message(error)); } };
    private readonly onForeground = (): void => { this.tick(); this.fit(); };
    private message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
    private notice(message: string, sticky = false): void {
        if (this.disposed || !this.statusLabel) return;
        this.statusLabel.string = message; this.statusLabel.node.active = true;
        this.unschedule(this.clearNotice); if (!sticky) this.scheduleOnce(this.clearNotice, 5);
    }
    private readonly clearNotice = (): void => { if (!this.disposed && this.statusLabel) this.statusLabel.node.active = false; };
    public onRetry(): void { if (!this.ready || this.guide?.recoveryAvailable || this.services?.getGuidePhase() === 'welcome' && !this.dialogView) director.loadScene(director.getScene()!.name); }
    private fitNode(node: Node): void {
        const ui = node.getComponent(UITransform), visible = view.getVisibleSize();
        if (ui && ui.width > 0 && ui.height > 0) { const ratio = Math.min(visible.width / ui.width, visible.height / ui.height); node.setScale(ratio, ratio, 1); }
    }
    private readonly fit = (): void => {
        if (!this.host || !isValid(this.host, true)) return;
        if (sys.isBrowser && game.canvas && !this.syncingBrowserFrame) {
            const canvas = game.canvas, width = canvas.clientWidth, height = canvas.clientHeight;
            const ratio = view.getDevicePixelRatio();
            // Creator's preview toolbar can resize CSS without resizing the drawing buffer.
            // Keep visible buttons, Canvas projection and native pointer picking in the same frame.
            if (width > 0 && height > 0 && (Math.abs(canvas.width - width * ratio) > 1 || Math.abs(canvas.height - height * ratio) > 1)) {
                this.syncingBrowserFrame = true;
                try { view.setFrameSize(width, height); } finally { this.syncingBrowserFrame = false; }
            }
        }
        for (const layer of [this.host.pageLayer, this.host.dialogLayer, this.host.guideLayer]) layer?.children.forEach(node => this.fitNode(node));
    };
    public onDestroy(): void {
        this.disposed = true; this.ready = false; this.unsubscribe?.(); this.guide?.dispose();
        view.off('canvas-resize', this.fit, this); game.off(Game.EVENT_HIDE, this.checkpoint, this); game.off(Game.EVENT_SHOW, this.onForeground, this);
        this.unscheduleAllCallbacks(); this.host?.closeAll();
        const documents = this.documents.splice(0), scope = this.dataScope;
        director.once(Director.EVENT_AFTER_UPDATE, () => { scope?.release(); documents.forEach(asset => asset.decRef()); });
    }
}
