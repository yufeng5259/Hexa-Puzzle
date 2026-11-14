import { instantiate, Node, Prefab, SpriteFrame } from 'cc';
import { ScreenFit } from '../features/ui/ScreenFit';
import type { ResourceLoader } from '../framework/resources/ResourceLoader';
import type { ViewHost } from '../framework/ui/ViewHost';
import { LayoutView } from '../features/ui/LayoutView';
import type { Transition } from './Transition';

type ActionHandler = (actionId: string, view: LayoutView) => void;
export interface PageOptions {
    /** Runs while the transition still covers the screen (load the page's own pictures here). */
    prepare?: (view: LayoutView) => Promise<unknown> | unknown;
    /** No transition (first page opened under the boot loading screen). */
    instant?: boolean;
}
/** A prepare step never holds the cover longer than this. */
const PREPARE_LIMIT_MS = 4000;

/**
 * Opens generated layout Prefabs on the scene's ViewHost. Pages stack on the page
 * layer (home map + build overlay); dialogs are one at a time, the rest queue.
 * Each view owns its resource scope, released by BaseView when destroyed.
 * Page changes run behind the honeycomb transition, overlays fade, dialogs pop.
 */
export class Navigator {
    private readonly pages: LayoutView[] = [];
    private dialog: LayoutView | null = null;
    private readonly queue: (() => Promise<void>)[] = [];
    /** Page replacements run one after another. */
    private swapping: Promise<unknown> = Promise.resolve();
    private swaps = 0;

    /** Small shared UI frames (button states, dots); lives as long as the app. */
    private readonly frames;
    public constructor(private readonly host: ViewHost, private readonly loader: ResourceLoader, private readonly transition: Transition | null = null) {
        this.frames = loader.createScope();
        ScreenFit.events.on('changed', () => { for (const v of [...this.pages, this.dialog]) if (v?.isValid) v.fitScreen(); });
    }
    public loadFrame(id: string): Promise<SpriteFrame> { return this.frames.load(id, SpriteFrame); }
    /** Optional art: true once the frame is delivered and imported. */
    public hasFrame(id: string): boolean { return this.loader.has(id); }

    public get topPage(): LayoutView | null { return this.pages[this.pages.length - 1] ?? null; }
    public get dialogOpen(): boolean { return !!this.dialog || this.queue.length > 0; }
    /** A page change is running (screen covered or uncovering). */
    public get transitioning(): boolean { return this.swaps > 0 || !!this.transition?.busy; }

    /**
     * Closes every page and opens a fresh one: load → cover → swap → prepare → reveal.
     * Resolves with the new page while still covered; the reveal follows the caller's
     * synchronous setup (and options.prepare when given).
     */
    public replacePage(id: string, onAction: ActionHandler, options: PageOptions = {}): Promise<LayoutView> {
        this.swaps++;
        const run = this.swapping.then(async () => {
            const scope = this.loader.createScope();
            let prefab: Prefab;
            try { prefab = await scope.load(`prefab.${id}`, Prefab); }
            catch (error) { scope.release(); throw error; }
            const animate = !options.instant && !!this.transition;
            if (animate) await this.transition!.cover();
            const page = this.mount(prefab, scope, id, 'page', onAction);
            for (const old of this.pages.splice(0)) old.close();
            this.pages.push(page);
            const reveal = (async () => {
                try { if (options.prepare) await Promise.race([options.prepare(page), wait(PREPARE_LIMIT_MS)]); }
                catch (error) { console.error(error); }
                await wait(0); // let the caller's code after `await replacePage` run first
                if (animate) await this.transition!.reveal();
            })();
            return { page, reveal };
        });
        this.swapping = run.then(r => r.reveal, () => undefined).finally(() => { this.swaps--; });
        return run.then(r => r.page);
    }
    /** Covers the screen (e.g. over the boot loading screen) and reveals what is below once `under` is done. */
    public async coverWhile(under: () => void): Promise<void> {
        if (!this.transition) { under(); return; }
        await this.transition.cover();
        under();
        await this.transition.reveal();
    }

    /** Opens a page above the current one (e.g. build mode over the shared home map); it fades in. */
    public async pushPage(id: string, onAction: ActionHandler): Promise<LayoutView> {
        const scope = this.loader.createScope();
        let prefab: Prefab;
        try { prefab = await scope.load(`prefab.${id}`, Prefab); }
        catch (error) { scope.release(); throw error; }
        const page = this.mount(prefab, scope, id, 'page', onAction);
        this.pages.push(page);
        page.fadeIn();
        return page;
    }
    public popPage(): void { this.pages.pop()?.fadeOutAndClose(); }

    /** Shows a dialog now, or after the current one closes. Resolves when it is on screen. */
    public showDialog(id: string, onAction: ActionHandler, setup?: (view: LayoutView) => void): Promise<LayoutView> {
        return new Promise((resolve, reject) => {
            const show = async () => {
                try {
                    const scope = this.loader.createScope();
                    let prefab: Prefab;
                    try { prefab = await scope.load(`prefab.${id}`, Prefab); }
                    catch (error) { scope.release(); throw error; }
                    this.dialog = this.mount(prefab, scope, id, 'dialog', onAction);
                    setup?.(this.dialog);
                    this.dialog.popIn();
                    resolve(this.dialog);
                } catch (error) { this.dialog = null; reject(error); this.next(); }
            };
            if (this.dialog || this.queue.length) this.queue.push(show); else void show();
        });
    }
    public closeDialog(): void {
        this.dialog?.fadeOutAndClose();
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
    private mount(prefab: Prefab, scope: ReturnType<ResourceLoader['createScope']>, id: string, layer: 'page' | 'dialog', onAction: ActionHandler): LayoutView {
        const opened = this.host.open(prefab, layer, scope);
        if (!(opened instanceof LayoutView)) { opened.close(); throw new Error(`prefab.${id} is not a LayoutView`); }
        const page = opened;
        page.fitScreen();
        page.node.on('view-action', (event: { actionId: string }) => onAction(event.actionId, page));
        return page;
    }
}

function wait(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }
