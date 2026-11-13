import { instantiate, Node, Prefab, SpriteFrame } from 'cc';
import type { ResourceLoader } from '../framework/resources/ResourceLoader';
import type { ViewHost } from '../framework/ui/ViewHost';
import { LayoutView } from '../features/ui/LayoutView';

type ActionHandler = (actionId: string, view: LayoutView) => void;

/**
 * Opens generated layout Prefabs on the scene's ViewHost. Pages stack on the page
 * layer (home map + build overlay); dialogs are one at a time, the rest queue.
 * Each view owns its resource scope, released by BaseView when destroyed.
 */
export class Navigator {
    private readonly pages: LayoutView[] = [];
    private dialog: LayoutView | null = null;
    private readonly queue: (() => Promise<void>)[] = [];

    /** Small shared UI frames (button states, dots); lives as long as the app. */
    private readonly frames;
    public constructor(private readonly host: ViewHost, private readonly loader: ResourceLoader) { this.frames = loader.createScope(); }
    public loadFrame(id: string): Promise<SpriteFrame> { return this.frames.load(id, SpriteFrame); }

    public get topPage(): LayoutView | null { return this.pages[this.pages.length - 1] ?? null; }
    public get dialogOpen(): boolean { return !!this.dialog || this.queue.length > 0; }

    /** Closes every page and opens a fresh one. */
    public async replacePage(id: string, onAction: ActionHandler): Promise<LayoutView> {
        const view = await this.open(id, 'page', onAction);
        for (const page of this.pages.splice(0)) page.close();
        this.pages.push(view);
        return view;
    }
    /** Opens a page above the current one (e.g. build mode over the shared home map). */
    public async pushPage(id: string, onAction: ActionHandler): Promise<LayoutView> {
        const view = await this.open(id, 'page', onAction);
        this.pages.push(view);
        return view;
    }
    public popPage(): void { this.pages.pop()?.close(); }

    /** Shows a dialog now, or after the current one closes. Resolves when it is on screen. */
    public showDialog(id: string, onAction: ActionHandler, setup?: (view: LayoutView) => void): Promise<LayoutView> {
        return new Promise((resolve, reject) => {
            const show = async () => {
                try {
                    this.dialog = await this.open(id, 'dialog', onAction);
                    setup?.(this.dialog);
                    resolve(this.dialog);
                } catch (error) { this.dialog = null; reject(error); this.next(); }
            };
            if (this.dialog || this.queue.length) this.queue.push(show); else void show();
        });
    }
    public closeDialog(): void {
        this.dialog?.close();
        this.dialog = null;
        this.next();
    }

    /** Instantiates a layout Prefab under an existing node (e.g. one build anchor per building). */
    public async instantiate(id: string, parent: Node, onAction: ActionHandler): Promise<LayoutView> {
        const scope = this.loader.createScope();
        let node: Node | null = null;
        try {
            const prefab = await scope.load(`prefab.${id}`, Prefab);
            node = instantiate(prefab);
            node.active = false;
            const view = node.getComponent(LayoutView);
            if (!view) throw new Error(`prefab.${id} is not a LayoutView`);
            view.attachResourceScope(scope);
            node.parent = parent;
            view.show();
            view.node.on('view-action', (event: { actionId: string }) => onAction(event.actionId, view));
            return view;
        } catch (error) {
            if (node) node.destroy(); else scope.release();
            throw error;
        }
    }

    private next(): void { const show = this.queue.shift(); if (show) void show(); }
    private async open(id: string, layer: 'page' | 'dialog', onAction: ActionHandler): Promise<LayoutView> {
        const scope = this.loader.createScope();
        let prefab: Prefab;
        try { prefab = await scope.load(`prefab.${id}`, Prefab); }
        catch (error) { scope.release(); throw error; }
        const opened = this.host.open(prefab, layer, scope);
        if (!(opened instanceof LayoutView)) { opened.close(); throw new Error(`prefab.${id} is not a LayoutView`); }
        const view = opened;
        view.node.on('view-action', (event: { actionId: string }) => onAction(event.actionId, view));
        return view;
    }
}
