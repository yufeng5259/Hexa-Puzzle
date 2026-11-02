import { _decorator, Canvas, Component, JsonAsset, Label, Prefab, ResolutionPolicy, resources, view, director, Director, Node, UITransform, instantiate, isValid } from 'cc';
import { DEBUG, EDITOR } from 'cc/env';
import { ViewHost } from '../framework/ui/ViewHost';
import { BaseView } from '../framework/ui/BaseView';
import { VirtualList } from '../framework/ui/VirtualList';
import { requireBinding } from '../framework/components/Binding';
import { GardenAssetStore, FoundationPrefabRegistry, FoundationPrefabRecord, FoundationArtManifest } from '../features/garden/resources/GardenAssetStore';
import { PresentationGroup } from '../features/presentation/PresentationGroup';
import { SerializedView } from '../ui/common/SerializedView';
import { UIContext, UIEntry, UIFlow, UILayer, UIRequest } from './UIFlow';
import { LevelCatalog } from '../features/puzzle/data/LevelCatalog';
import type { ResourceScope } from '../framework/resources/ResourceScope';
import { MainlineMapPageView } from '../features/mainline/ui/MainlineMapPageView';
import { PuzzleBoardPresentation } from '../features/puzzle/presentation/PuzzleBoardPresentation';
import { levelRouteState } from '../features/mainline/presentation/LevelRoutePresentation';
import { PuzzleController } from '../features/puzzle/controller/PuzzleController';
import { PlayStatusPresentation } from '../features/puzzle/presentation/PlayStatusPresentation';
import type { PuzzleSession, PuzzleSessionSnapshot } from '../features/puzzle/session/PuzzleSession';
import { PuzzleAttemptStore } from './PuzzleAttemptStore';
import { LoadingPageView } from '../features/boot/ui/LoadingPageView';
const { ccclass, property } = _decorator;
interface PreviewRecord extends FoundationPrefabRecord { category: string; stateIds?: string[] }
interface MountedView extends UIEntry {
    readonly view: BaseView | null;
    readonly node: Node;
    controller?: PuzzleController;
    session?: PuzzleSession;
    commitAttempt?: () => void;
    outcomeOpening?: boolean;
    outcomeRetry?: boolean;
}
interface ViewAction { actionId: string; mainlineNumber?: number }

/** Composition root: navigation and process-local attempt ownership, without save or reward authority. */
@ccclass('FoundationBoot')
export class FoundationBoot extends Component {
    @property(ViewHost) public host: ViewHost | null = null;
    @property(Prefab) public loadingPrefab: Prefab | null = null;
    @property(Label) public statusLabel: Label | null = null;
    public currentView: BaseView | null = null;
    public ready = false;
    private store: GardenAssetStore | null = null;
    private registry: { prefabs: PreviewRecord[] } | null = null;
    private readonly documents: JsonAsset[] = [];
    private flow: UIFlow<MountedView> | null = null;
    private sampleNode: Node | null = null;
    private disposed = false;
    private catalog: LevelCatalog | null = null;
    private catalogScope: ResourceScope | null = null;
    private attempts: PuzzleAttemptStore | null = null;
    private outcomeNoticePage: MountedView | null = null;
    private loadingView: LoadingPageView | null = null;

    public get activeAttempt(): PuzzleSessionSnapshot | null { return this.attempts?.current?.snapshot || null; }
    public get currentPuzzleController(): PuzzleController | null { return this.flow?.page?.controller || null; }

    public get selectedLevelId(): string { return this.flow?.context.levelId || ''; }
    public get selectedMainlineNumber(): number | null { return this.flow?.context.debugLevelId ? null : this.flow?.context.mainlineNumber || 1; }
    public get mapPage(): number { return this.flow?.context.mapPage || 1; }

    public get currentPage(): BaseView | null { return this.flow?.page?.view || null; }
    public get currentRoute(): string { return this.flow?.current?.id || 'loading'; }
    public get overlayCount(): number { return this.flow?.overlayCount || 0; }
    public get navigating(): boolean { return this.flow?.navigating || false; }

    public async start(): Promise<void> {
        if (EDITOR) return;
        try {
            requireBinding('FoundationBoot', 'host', this.host);
            requireBinding('FoundationBoot', 'loadingPrefab', this.loadingPrefab);
            requireBinding('FoundationBoot', 'statusLabel', this.statusLabel);
            view.setDesignResolutionSize(853, 1844, ResolutionPolicy.SHOW_ALL);
            const loading = this.host!.open(this.loadingPrefab!);
            this.loadingView = requireBinding('FoundationBoot', 'LoadingPageView', loading.node.getComponent(LoadingPageView));
            this.loadingView.setProgress(0);
            this.currentView = loading;
            const initial = this.entry('loading', 'page', loading.node, loading);
            initial.show(); this.fit(); view.on('canvas-resize', this.fit, this);
            const [art, registry] = await Promise.all([this.loadDocument('source-art-manifest'), this.loadDocument('prefab-registry')]);
            if (this.disposed) return;
            this.loadingView.setProgress(0.25);
            this.registry = registry.json as { prefabs: PreviewRecord[] };
            this.store = new GardenAssetStore(art.json as FoundationArtManifest, registry.json as FoundationPrefabRegistry);
            this.catalogScope = this.store.createScope();
            const catalogAsset = await this.catalogScope.load('data:level-catalog', JsonAsset);
            if (this.disposed) return;
            this.catalog = new LevelCatalog(catalogAsset.json);
            this.loadingView.setProgress(0.6);
            this.attempts = new PuzzleAttemptStore();
            this.flow = new UIFlow<MountedView>({
                mount: (id, layer, request, state, context) => this.prepare(id, layer, request, state, context),
                changed: () => this.onFlowChanged(),
                navigationChanged: () => this.syncPuzzleInput(),
                notice: message => this.notice(message),
                allowDemo: DEBUG,
                levelIdFor: number => this.catalog!.getMainline(number).id,
                play: {
                    returnPiece: () => this.currentPuzzleController?.onReturnPiece(),
                    status: () => this.attempts?.get(this.flow!.context.levelId)?.snapshot.status || null,
                    resultRoute: () => this.catalog!.getById(this.flow!.context.levelId).mode === 'challenge' ? 'challenge-result' : 'puzzle-result',
                },
            }, initial);
            this.loadingView.setProgress(0.75);
            const opened = await this.flow.replacePage('mainline-map', undefined, false, true);
            if (!opened || this.disposed) return;
            this.ready = true; this.resetNotice();
        } catch (error) {
            if (!this.disposed) { this.notice('界面资源加载失败，请重新启动', true); console.error(error); }
        }
    }

    /** The development gallery remains available for all 82 registered Prefabs. */
    public async preview(id: string, state?: string): Promise<void> {
        if (!DEBUG) throw new Error('Foundation preview unavailable');
        if (!this.flow || this.disposed) throw new Error('Foundation not initialized');
        await this.flow.replacePage(id, state, true, true, { ...this.flow.context, presentation: 'fixture',
            levelId: this.catalog!.getMainline(this.flow.context.mainlineNumber).id, debugLevelId: undefined });
    }

    /** Normal selection entry, also used by the explicit item action payload. */
    public async selectMainline(number: number): Promise<void> {
        if (!this.flow || this.disposed) throw new Error('Foundation not initialized');
        await this.flow.handle('select:mainline', undefined, { mainlineNumber: number });
    }

    /** Developer-only reserve fixture; intentionally absent from every product Button. */
    public async previewLevel(id: string): Promise<void> {
        if (!DEBUG) throw new Error('Reserve level preview unavailable');
        if (!this.flow || !this.catalog || this.disposed) throw new Error('Foundation not initialized');
        const level = this.catalog.getById(id);
        if (level.mainlineNumber !== null) throw new Error('Use normal mainline selection for a mapped question');
        await this.flow.replacePage('puzzle', undefined, true, true,
            { ...this.flow.context, presentation: 'level', levelId: id, debugLevelId: id });
    }

    /** Serialized debug-badge Button entry; no production result or reward authority. */
    public onDemoAction(): void {
        const page = this.flow?.page;
        if (page?.context?.presentation === 'level' && page.session?.snapshot.status !== 'active'
            && page.session && this.currentRoute === 'puzzle') {
            this.openOutcome(page, true); return;
        }
        if (DEBUG && this.currentRoute === 'puzzle' && this.flow) { void this.flow.handle('demo:result'); return; }
        this.notice('结算演示仅在开发预览的拼图页面提供');
    }

    private async prepare(id: string, layer: UILayer, request: UIRequest, state?: string, context?: UIContext): Promise<MountedView | null> {
        if (!this.store || !this.registry || this.disposed) throw new Error('Foundation not initialized');
        if (context?.debugLevelId && !DEBUG) throw new Error('Reserve level preview unavailable');
        const catalog = requireBinding('FoundationBoot', 'catalog', this.catalog);
        const level = context?.presentation === 'level'
            ? context.debugLevelId ? catalog.getById(context.debugLevelId) : catalog.getMainline(context.mainlineNumber) : null;
        if (context?.debugLevelId && level?.mainlineNumber !== null) throw new Error('Reserve preview requires an unmapped question');
        if (level && level.id !== context!.levelId) throw new Error('FoundationBoot: level identity mismatch');
        if (level) state = levelRouteState(id, level) || state;
        const record = this.registry.prefabs.find(item => item.id === id);
        if (!record) throw new Error(`Unknown Prefab: ${id}`);
        if (record.category === 'debug' && !DEBUG) throw new Error('Development UI unavailable');
        if (state && (!record.stateIds || record.stateIds.indexOf(state) < 0)) throw new Error(`${id}: unknown layout state ${state}`);
        const scope = this.store.createScope();
        let mounted: MountedView | null = null;
        let transferred = false;
        const unregister = request.onCancel(() => {
            if (mounted) mounted.close();
            else if (!transferred) scope.release();
        });
        try {
            const prefab = await scope.load('prefab:' + id, Prefab);
            if (!request.isCurrent() || this.disposed) { scope.release(); return null; }
            if (id === 'virtual-list') {
                const node = instantiate(prefab);
                node.once(Node.EventType.NODE_DESTROYED, () => director.once(Director.EVENT_AFTER_UPDATE, () => scope.release()));
                transferred = true;
                try {
                    node.parent = this.host!.pageLayer!;
                    mounted = this.entry(id, layer, node, null, state, context);
                    this.stage(node);
                    requireBinding('VirtualList sample', 'component', node.getComponent(VirtualList))
                        .setData(Array.from({ length: 1000 }, (_, index) => ({ title: `预览条目 ${index + 1}` })));
                } catch (error) { node.destroy(); throw error; }
            } else {
                // ViewHost owns cleanup even if validation/instantiation fails.
                transferred = true;
                const component = this.host!.open(prefab, layer, scope);
                mounted = this.entry(id, layer, component.node, component, state, context);
                this.stage(component.node);
                let board: PuzzleBoardPresentation | null = null;
                if (component instanceof SerializedView) component.selectState(state);
                const activeRoots = (component instanceof SerializedView ? component.stateRoots : [component.node])
                    .filter(root => root.activeInHierarchy);
                if (level && (id === 'puzzle' || id === 'puzzle-preview')) {
                    board = requireBinding('FoundationBoot', `${id}.PuzzleBoardPresentation`,
                        activeRoots.map(root => root.getComponent(PuzzleBoardPresentation)).find(value => !!value));
                    board.activateLevel();
                }
                if (!request.isCurrent() || this.disposed) { mounted.close(); return null; }
                if (component instanceof MainlineMapPageView)
                    await component.render(scope, catalog, context?.mapPage || 1, context?.presentation === 'fixture');
                else await component.node.getComponent(PresentationGroup)?.present(scope, {}, board?.fixtureNodes || []);
                if (!request.isCurrent() || this.disposed) { mounted.close(); return null; }
                if (level && context) {
                    if (board) await board.present(scope, level);
                    if (!request.isCurrent() || this.disposed) { mounted.close(); return null; }
                    if (id === 'puzzle' && board) {
                        const controller = requireBinding('FoundationBoot', 'puzzle.PuzzleController', board.node.getComponent(PuzzleController));
                        // Preparation is active for loading but must never accept input off-screen.
                        controller.enabled = false;
                        controller.inputCamera = requireBinding('FoundationBoot', 'inputCamera', this.node.getComponent(Canvas)?.cameraComponent);
                        const attempt = requireBinding('FoundationBoot', 'attempts', this.attempts).prepare(level, request.restartAttempt);
                        controller.bind(attempt.session);
                        controller.suspend();
                        mounted.controller = controller; mounted.session = attempt.session; mounted.commitAttempt = attempt.commit;
                        const owner = mounted;
                        controller.onOutcome = () => {
                            if (this.disposed || this.flow?.page !== owner || this.attempts?.current !== owner.session) return;
                            this.openOutcome(owner);
                        };
                    }
                    const snapshot = mounted.session?.snapshot || this.attempts?.get(level.id)?.snapshot || null;
                    activeRoots.forEach(root => root.getComponent(PlayStatusPresentation)?.present(snapshot, level.mainlineNumber));
                }
            }
            if (!request.isCurrent() || this.disposed) { mounted?.close(); return null; }
            return mounted;
        } catch (error) {
            if (mounted) mounted.close();
            else if (!transferred) scope.release();
            if (!request.isCurrent() || this.disposed) return null;
            throw error;
        } finally { unregister(); }
    }

    private entry(id: string, layer: UILayer, node: Node, component: BaseView | null, state?: string, context?: UIContext): MountedView {
        const destination = node.position.clone();
        let subscribed = false, closed = false;
        const action = (payload: ViewAction): void => {
            if (closed || !this.flow || this.disposed) { if (!this.disposed) this.notice('界面正在准备，请稍候'); return; }
            void this.flow.handle(payload?.actionId || '', entry, payload);
        };
        const unbind = (): void => {
            if (!subscribed) return;
            if (isValid(node, true)) node.off('view-action', action);
            subscribed = false;
        };
        const entry: MountedView = {
            id, layer, state, context, node, view: component,
            show: () => {
                if (closed || !isValid(node, true)) return;
                node.setPosition(destination);
                if (!subscribed) { node.on('view-action', action); subscribed = true; }
                if (component && isValid(component, true)) component.show();
                else node.active = true;
                this.fitNode(node);
                // Commit last: a failed show retains the previous attempt and page.
                entry.commitAttempt?.();
                entry.commitAttempt = undefined;
                if (entry.controller && isValid(entry.controller, true)) entry.controller.enabled = true;
                if (id === 'mainline-map' && this.loadingView) {
                    this.loadingView.setProgress(1);
                    this.loadingView = null;
                }
            },
            hide: () => {
                entry.controller?.suspend();
                unbind();
                if (component && isValid(component, true)) component.hide();
                else if (isValid(node, true)) node.active = false;
            },
            close: () => {
                if (closed) return;
                entry.controller?.suspend();
                if (entry.controller) entry.controller.onOutcome = null;
                closed = true; unbind();
                if (component && isValid(component, true)) component.close();
                else if (isValid(node, true)) node.destroy();
            },
        };
        return entry;
    }

    /** Keep preparation active for source-image loading, outside the visible frame until commit. */
    private stage(node: Node): void {
        this.fitNode(node);
        const size = view.getVisibleSize(); node.setPosition(size.width * 4, 0, 0);
    }
    private onFlowChanged(): void {
        this.currentView = this.flow?.current?.view || null;
        this.sampleNode = this.flow?.page?.id === 'virtual-list' ? this.flow.page.node : null;
        this.fit();
        const page = this.flow?.page;
        if (this.outcomeNoticePage && this.outcomeNoticePage !== page) {
            this.outcomeNoticePage = null; this.resetNotice();
        }
        this.syncPuzzleInput();
        if (page?.controller && !this.flow!.overlayCount && !this.flow!.navigating) this.openOutcome(page);
    }
    private syncPuzzleInput(): void {
        const page = this.flow?.page;
        if (page?.controller) {
            if (this.disposed || this.flow!.overlayCount || this.flow!.navigating || page.session?.snapshot.status !== 'active') page.controller.suspend();
            else page.controller.resume();
            if (page.outcomeRetry && !this.flow!.overlayCount && !this.flow!.navigating && !this.disposed) this.showOutcomeRetry(page);
        }
    }
    private openOutcome(page: MountedView, retry = false): void {
        const status = page.session?.snapshot.status;
        if (!this.flow || this.flow.page !== page || this.flow.overlayCount || this.flow.navigating
            || page.outcomeOpening || page.outcomeRetry && !retry || !status || status === 'active') return;
        page.controller?.suspend();
        page.outcomeOpening = true; page.outcomeRetry = false;
        if (this.outcomeNoticePage === page) this.notice('正在重试结算界面…', true);
        const done = (opened: boolean): void => {
            page.outcomeOpening = false;
            if (opened) {
                if (this.outcomeNoticePage === page) { this.outcomeNoticePage = null; this.resetNotice(); }
                return;
            }
            if (this.disposed || this.flow?.page !== page) return;
            page.outcomeRetry = true;
            if (!this.flow.overlayCount && !this.flow.navigating) this.showOutcomeRetry(page);
        };
        void this.flow.showPuzzleOutcome(status).then(done, () => done(false));
    }
    private showOutcomeRetry(page: MountedView): void {
        this.outcomeNoticePage = page;
        this.notice('结算界面加载失败，点此重试', true);
    }
    private fitNode(node: Node): void {
        const transform = node.getComponent(UITransform);
        if (!transform || transform.width <= 0 || transform.height <= 0) return;
        const size = view.getVisibleSize(), scale = Math.min(size.width / transform.width, size.height / transform.height);
        node.setScale(scale, scale, 1);
    }
    private fit(): void {
        if (!this.host || !isValid(this.host, true)) return;
        for (const layer of [this.host.pageLayer, this.host.dialogLayer, this.host.guideLayer]) {
            if (!layer) continue;
            for (const node of layer.children) this.fitNode(node);
        }
    }
    private notice(message: string, sticky = false): void {
        if (this.disposed || !this.statusLabel || !isValid(this.statusLabel, true)) return;
        this.statusLabel.node.active = true; this.statusLabel.string = message;
        this.unschedule(this.resetNotice); if (!sticky) this.scheduleOnce(this.resetNotice, 4);
    }
    private readonly resetNotice = (): void => {
        if (this.disposed || !this.statusLabel || !isValid(this.statusLabel, true)) return;
        const live = this.flow?.context.presentation === 'level';
        if (this.outcomeNoticePage === this.flow?.page && this.outcomeNoticePage?.outcomeRetry) {
            this.statusLabel.string = '结算界面加载失败，点此重试'; this.statusLabel.node.active = true; return;
        }
        this.statusLabel.string = live ? '玩法验证 · 无存档与奖励' : '界面预览 · 点此演示结算'; this.statusLabel.node.active = DEBUG;
    };
    private loadDocument(name: string): Promise<JsonAsset> {
        return new Promise((resolve, reject) => resources.load('framework/config/' + name, JsonAsset, (error, document) => {
            if (error) { reject(error); return; }
            document.addRef();
            if (this.disposed) { document.decRef(); reject(new Error('FoundationBoot disposed')); return; }
            this.documents.push(document); resolve(document);
        }));
    }
    public onDestroy(): void {
        this.disposed = true; this.unschedule(this.resetNotice);
        this.ready = false; this.loadingView = null;
        view.off('canvas-resize', this.fit, this);
        this.flow?.dispose(); this.flow = null;
        if (this.host && isValid(this.host, true)) this.host.closeAll();
        if (this.sampleNode && isValid(this.sampleNode, true)) this.sampleNode.destroy();
        this.sampleNode = null; this.currentView = null;
        this.attempts?.clear(); this.attempts = null;
        this.outcomeNoticePage = null;
        this.catalogScope?.release(); this.catalogScope = null; this.catalog = null;
        const documents = this.documents.splice(0);
        director.once(Director.EVENT_AFTER_UPDATE, () => documents.forEach(document => document.decRef()));
    }
}
