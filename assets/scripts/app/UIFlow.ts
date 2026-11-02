export type UILayer = 'page' | 'dialog' | 'guide';
export interface UIContext {
    readonly presentation: 'level' | 'fixture';
    readonly mainlineNumber: number;
    readonly levelId: string;
    readonly mapPage: number;
    /** Only the public DEBUG reserve preview can populate this field. */
    readonly debugLevelId?: string;
}
export interface UIActionPayload { readonly mainlineNumber?: number }
const initialContext: UIContext = Object.freeze({ presentation: 'level', mainlineNumber: 1, levelId: '1', mapPage: 1 });
export interface UIEntry {
    readonly id: string;
    readonly layer: UILayer;
    readonly state?: string;
    readonly context?: UIContext;
    show(): void;
    hide(): void;
    close(): void;
}
export interface UIRequest {
    readonly restartAttempt?: boolean;
    isCurrent(): boolean;
    /** Preparation owns its pending resources until it returns an entry. */
    onCancel(cleanup: () => void): () => void;
}
export interface UIFlowPorts<T extends UIEntry> {
    mount(id: string, layer: UILayer, request: UIRequest, state?: string, context?: UIContext): Promise<T | null>;
    changed(): void;
    /** Input can pause immediately while the retained page is preparing navigation. */
    navigationChanged?(pending: boolean): void;
    notice(message: string): void;
    readonly allowDemo: boolean;
    levelIdFor?(mainlineNumber: number): string;
    readonly play?: {
        returnPiece(): void;
        status(): 'active' | 'completed' | 'failed' | null;
        resultRoute(): 'puzzle-result' | 'challenge-result';
    };
}
interface PendingRequest extends UIRequest { cancel(): void }

/** UI navigation only: no player state, level authority, rewards, or persistence. */
export class UIFlow<T extends UIEntry> {
    private pageEntry: T | null;
    private readonly overlays: T[] = [];
    private pending: PendingRequest | null = null;
    private revision = 0;
    private disposed = false;
    private committedContext: UIContext = initialContext;
    private pageContext: UIContext = initialContext;
    private readonly overlayContexts = new Map<T, UIContext>();

    public constructor(private readonly ports: UIFlowPorts<T>, initialPage: T | null = null) {
        this.pageEntry = initialPage;
        this.committedContext = initialPage?.context || this.selectionContext(1);
        this.pageContext = this.committedContext;
    }
    public get context(): UIContext { return this.committedContext; }
    public get page(): T | null { return this.pageEntry; }
    public get current(): T | null { return this.overlays[this.overlays.length - 1] || this.pageEntry; }
    public get overlayCount(): number { return this.overlays.length; }
    public get navigating(): boolean { return !!this.pending; }
    public canAct(entry: T): boolean { return !this.disposed && this.current === entry; }

    public async replacePage(id: string, state?: string, force = false, throwOnError = false, context: UIContext = this.committedContext, restartAttempt = false): Promise<boolean> {
        if (this.disposed) return false;
        if (context.debugLevelId && ['puzzle', 'puzzle-result', 'challenge-result'].indexOf(id) < 0) context = this.selectionContext(context.mainlineNumber);
        this.cancelPending();
        if (!force && state === undefined && this.pageEntry?.id === id && this.sameContext(context, this.pageContext)) {
            this.committedContext = this.pageContext;
            this.closeOverlays(); this.ports.changed(); return true;
        }
        const request = this.begin(restartAttempt);
        let prepared: T | null = null;
        try {
            prepared = await this.ports.mount(id, 'page', request, state, context);
            if (!request.isCurrent()) { prepared?.close(); return false; }
            if (!prepared) { this.finish(request); return false; }
            prepared.show();
            const previous = this.pageEntry;
            this.pageEntry = prepared;
            this.committedContext = Object.freeze({ ...context });
            this.pageContext = this.committedContext;
            this.closeOverlays(); previous?.close();
            this.finish(request); this.ports.changed();
            return true;
        } catch (error) {
            prepared?.close();
            if (!request.isCurrent()) return false;
            this.finish(request); this.ports.notice('页面暂时无法打开，请重试');
            if (throwOnError) throw error;
            return false;
        }
    }

    public async openOverlay(id: string, layer: 'dialog' | 'guide' = 'dialog', state?: string, context: UIContext = this.committedContext): Promise<boolean> {
        if (this.disposed) return false;
        this.cancelPending();
        if (this.current?.id === id && (state === undefined || this.current.state === state) && this.overlays.length
            && this.sameContext(context, this.overlayContexts.get(this.current) || this.committedContext)) return true;
        const request = this.begin();
        let prepared: T | null = null;
        try {
            prepared = await this.ports.mount(id, layer, request, state, context);
            if (!request.isCurrent()) { prepared?.close(); return false; }
            if (!prepared) { this.finish(request); return false; }
            prepared.show();
            this.overlays[this.overlays.length - 1]?.hide();
            this.overlays.push(prepared);
            this.committedContext = Object.freeze({ ...context });
            this.overlayContexts.set(prepared, this.committedContext);
            this.finish(request); this.ports.changed(); return true;
        } catch (error) {
            prepared?.close();
            if (!request.isCurrent()) return false;
            this.finish(request); this.ports.notice('界面暂时无法打开，请重试'); return false;
        }
    }

    public closeOverlay(): boolean {
        if (this.disposed) return false;
        this.cancelPending();
        const previous = this.overlays.pop();
        if (!previous) return false;
        this.overlayContexts.delete(previous);
        previous.close();
        const restored = this.overlays[this.overlays.length - 1];
        restored?.show();
        // A cancelled replacement preview must not relabel an already retained puzzle.
        // Maps keep the selected number so that closing an entry card preserves selection.
        if (restored) this.committedContext = this.overlayContexts.get(restored) || this.committedContext;
        else if (this.pageEntry?.id === 'puzzle') this.committedContext = this.pageContext;
        this.ports.changed(); return true;
    }
    public async back(): Promise<void> {
        if (this.closeOverlay()) return;
        if (this.pageEntry?.id === 'puzzle') { await this.openOverlay('confirmation', 'dialog', 'T37-01_退出本局确认'); return; }
        if (this.pageEntry?.id === 'mainline-map' || this.pageEntry?.id === 'loading') {
            this.ports.notice(this.pageEntry.id === 'loading' ? '界面正在准备，请稍候' : '当前已在主线地图'); return;
        }
        await this.replacePage('mainline-map');
    }

    /** Only an app-validated rule outcome can enter a live result route. */
    public async showPuzzleOutcome(status: 'completed' | 'failed'): Promise<boolean> {
        if (this.disposed || !this.livePlay || this.pageEntry?.id !== 'puzzle'
            || this.ports.play!.status() !== status || this.overlays.length || this.pending) return false;
        return status === 'completed' ? this.replacePage(this.ports.play!.resultRoute()) : this.openOverlay('challenge-fail');
    }

    public async handle(actionId: string, source?: T, payload: UIActionPayload = {}): Promise<void> {
        if (this.disposed || (source && !this.canAct(source))) return;
        if (actionId === 'select:mainline') {
            let context: UIContext;
            try { context = this.selectionContext(payload.mainlineNumber as number); }
            catch { this.ports.notice('关卡编号无效，请重新选择'); return; }
            await this.openOverlay('puzzle-preview', 'dialog', undefined, context); return;
        }
        if (actionId === 'map:previous' || actionId === 'map:next') {
            if (this.pageEntry?.id !== 'mainline-map' || this.overlays.length) return;
            const page = this.committedContext.mapPage + (actionId === 'map:next' ? 1 : -1);
            if (page < 1 || page > 12) return;
            await this.replacePage('mainline-map', undefined, false, false,
                Object.freeze({ ...this.committedContext, presentation: 'level', mapPage: page })); return;
        }
        if (actionId === 'back') { await this.back(); return; }
        if (actionId === 'close') {
            if (!this.closeOverlay()) this.ports.notice('当前没有需要关闭的弹窗');
            return;
        }
        if (actionId === 'nav:puzzle-preview') { await this.openOverlay('puzzle-preview'); return; }
        if (['nav:mainline-map', 'nav:garden', 'nav:puzzle'].indexOf(actionId) >= 0) {
            await this.replacePage(actionId.slice(4)); return;
        }
        if (actionId === 'open:confirmation-exit' || actionId === 'open:confirmation-restart') {
            await this.openOverlay('confirmation', 'dialog', actionId === 'open:confirmation-exit'
                ? 'T37-01_退出本局确认' : 'T38-01_重新开始确认'); return;
        }
        if (actionId === 'confirm:exit' || actionId === 'confirm:restart') {
            if (this.current?.id !== 'confirmation' || !this.overlays.length) {
                this.ports.notice('请先打开对应的确认界面'); return;
            }
            if (actionId === 'confirm:exit') await this.replacePage('mainline-map');
            else if (this.livePlay) await this.replacePage('puzzle', undefined, true, false, this.pageContext, true);
            else { this.closeOverlay(); this.ports.notice('重新开始仅供界面预览，未重开真实对局或保存'); }
            return;
        }
        if (actionId === 'play:retry') {
            if (this.livePlay && this.ports.play!.status() === 'failed')
                await this.replacePage('puzzle', undefined, true, false, this.pageContext, true);
            else this.ports.notice('当前没有需要重试的失败对局');
            return;
        }
        if (actionId === 'play:next') {
            if (!this.livePlay || this.ports.play!.status() !== 'completed'
                || ['puzzle-result', 'challenge-result'].indexOf(this.pageEntry?.id || '') < 0) {
                this.ports.notice('完成本关后可进入下一关'); return;
            }
            if (this.committedContext.debugLevelId || this.committedContext.mainlineNumber >= 96) {
                await this.replacePage('mainline-map'); this.ports.notice('已到当前主线终点，可返回地图选择关卡');
            } else await this.replacePage('puzzle', undefined, false, false, this.selectionContext(this.committedContext.mainlineNumber + 1));
            return;
        }
        const helpStates: Record<string, string> = {
            'help:puzzle': 'T40-02_图示帮助_拖放拼图',
            'help:endless': 'T40-03_图示帮助_三轴消除',
            'help:build': 'T40-04_图示帮助_五级建设',
        };
        if (helpStates[actionId]) { await this.openOverlay('help-detail', 'dialog', helpStates[actionId]); return; }
        if (['open:pause', 'open:settings', 'open:confirmation', 'open:help-index', 'open:help-detail'].indexOf(actionId) >= 0) {
            await this.openOverlay(actionId.slice(5)); return;
        }
        if (actionId === 'demo:result') {
            if (this.ports.allowDemo && !this.livePlay && this.pageEntry?.id === 'puzzle' && !this.overlays.length) {
                if (await this.replacePage('puzzle-result')) this.ports.notice('结算演示：未发放奖励，也未记录通关');
            } else this.ports.notice('结算演示仅在开发预览的拼图页面提供');
            return;
        }
        if (actionId === 'play:return-piece' || actionId === 'demo:return-piece' && this.livePlay) {
            if (this.livePlay && this.pageEntry?.id === 'puzzle' && !this.overlays.length && !this.pending) this.ports.play!.returnPiece();
            return;
        }
        if (actionId === 'demo:hint' || actionId === 'demo:return-piece') {
            this.ports.notice(actionId === 'demo:hint' ? '提示仅供界面预览，未扣除道具或保存' : '归还拼块仅供界面预览，未修改真实对局或保存');
            return;
        }
        this.ports.notice('该入口尚未接入，本轮仅提供界面预览');
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true; this.cancelPending();
        this.closeOverlays(); this.pageEntry?.close(); this.pageEntry = null;
    }
    private selectionContext(number: number): UIContext {
        if (!Number.isInteger(number) || number < 1 || number > 96) throw new Error('Unknown mainline number');
        const levelId = this.ports.levelIdFor ? this.ports.levelIdFor(number) : String(number);
        if (!levelId) throw new Error('Unknown mainline level');
        return Object.freeze({ presentation: 'level', mainlineNumber: number, levelId, mapPage: Math.ceil(number / 8) });
    }
    private sameContext(a: UIContext, b: UIContext): boolean {
        return a.presentation === b.presentation && a.levelId === b.levelId
            && a.mainlineNumber === b.mainlineNumber && a.mapPage === b.mapPage;
    }
    private get livePlay(): boolean { return !!this.ports.play && this.pageContext.presentation === 'level'; }
    private closeOverlays(): void {
        for (let index = this.overlays.length - 1; index >= 0; index--) this.overlays[index].close();
        this.overlays.length = 0;
        this.overlayContexts.clear();
    }
    private cancelPending(): void {
        this.revision++;
        const pending = this.pending; this.pending = null;
        pending?.cancel();
        if (pending) this.ports.navigationChanged?.(false);
    }
    private begin(restartAttempt = false): PendingRequest {
        const revision = ++this.revision, cleanups = new Set<() => void>();
        let cancelled = false;
        const request: PendingRequest = {
            restartAttempt,
            isCurrent: () => !cancelled && !this.disposed && revision === this.revision,
            onCancel: cleanup => {
                if (cancelled || this.disposed || revision !== this.revision) { cleanup(); return () => {}; }
                cleanups.add(cleanup); return () => cleanups.delete(cleanup);
            },
            cancel: () => {
                if (cancelled) return;
                cancelled = true;
                for (const cleanup of cleanups) cleanup();
                cleanups.clear();
            },
        };
        this.pending = request;
        this.ports.navigationChanged?.(true);
        return request;
    }
    private finish(request: PendingRequest): void {
        if (this.pending !== request) return;
        this.pending = null;
        this.ports.navigationChanged?.(false);
    }
}
