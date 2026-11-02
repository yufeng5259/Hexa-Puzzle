import { _decorator, Component, director, Director } from 'cc';
import type { EventTouch } from 'cc';
import { ViewLifetime, Cleanup } from '../core/ViewLifetime';
import type { ResourceScope } from '../resources/ResourceScope';
const { ccclass } = _decorator;

/** Prefab root lifecycle. Derived views declare typed bindings and presentation hooks. */
@ccclass('BaseView')
export class BaseView extends Component {
    private readonly lifetime = new ViewLifetime();
    private scope: ResourceScope | null = null;
    private initialized = false;
    private disposed = false;
    public get isShown(): boolean { return this.lifetime.isVisible; }
    public get isClosed(): boolean { return this.lifetime.isClosed; }
    public validateBindings(): void {}
    public onAction(_event?: EventTouch, actionId = ''): void {
        this.node.emit('view-action', { actionId, view: this });
    }

    public onLoad(): void { this.ensureInitialized(); }
    public onEnable(): void { this.present(); }
    public onDisable(): void { this.conceal(); }
    public show(): void {
        this.ensureInitialized();
        if (this.lifetime.isClosed) throw new Error('Cannot show a closed view');
        this.node.active = true;
        try { this.present(); }
        catch (error) { this.node.active = false; throw error; }
    }
    public hide(): void {
        try { this.conceal(); }
        finally { if (this.node.active) this.node.active = false; }
    }
    public close(): void {
        if (this.lifetime.isClosed) return;
        try { this.hide(); }
        finally { this.lifetime.close(); this.node.destroy(); }
    }
    public attachResourceScope(scope: ResourceScope): void {
        if (this.scope || this.disposed || scope.isReleased) throw new Error('View resource scope already attached, released, or view destroyed');
        this.scope = scope;
    }
    protected get resourceScope(): ResourceScope {
        if (!this.scope) throw new Error('View resource scope has not been attached');
        return this.scope;
    }
    protected addShownCleanup(cleanup: Cleanup): void { this.lifetime.addCleanup(cleanup); }
    protected requestIdentity(): () => boolean { return this.lifetime.requestIdentity(); }
    protected onShown(): void {}
    protected onHidden(): void {}
    protected onClosed(): void {}

    public onDestroy(): void {
        if (this.disposed) return;
        this.disposed = true;
        const scope = this.scope; this.scope = null;
        try {
            try { this.conceal(); }
            finally { this.lifetime.close(); this.onClosed(); }
        } finally {
            // Node.destroy is deferred. DecRef only after the engine's entire destruction pass.
            if (scope) director.once(Director.EVENT_AFTER_UPDATE, () => scope.release());
        }
    }
    private ensureInitialized(): void {
        if (this.initialized) return;
        this.validateBindings(); this.initialized = true;
    }
    private present(): void {
        this.ensureInitialized();
        if (this.lifetime.show()) {
            try { this.onShown(); }
            catch (error) { this.conceal(); throw error; }
        }
    }
    private conceal(): void {
        const wasVisible = this.lifetime.isVisible;
        try { this.lifetime.hide(); }
        finally { if (wasVisible) this.onHidden(); }
    }
}
