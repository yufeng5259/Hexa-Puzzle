import { input, Input, instantiate, KeyCode, Prefab, EventKeyboard } from 'cc';
import { debugLog } from '../Log';
import { ResLoader } from '../res/ResLoader';
import { playHide, playShow, stopTransition } from './Transitions';
import { UIQueue } from './UILayer';
import { UIRoot } from './UIRoot';
import { viewMeta } from './uiView';
import { ViewBase, ViewHost } from './ViewBase';

export type ViewClass<V extends ViewBase<any>> = new () => V;
export type ArgsOf<V> = V extends ViewBase<infer A> ? A : never;
type OpenArgs<V> = ArgsOf<V> extends void ? [] : [ArgsOf<V>];

interface Record { view: ViewBase<any> | null; pending: Promise<ViewBase<any>> | null; prefab: Prefab | null; }
interface Queued { type: ViewClass<any>; args: unknown; }

const LOADING_DELAY = 0.1;

/**
 * BigHero ViewCoordinator on 3.x: open by class (one instance per class), per-queue stacks
 * (opening hides the previous top, closing shows it again), an ordered popup queue,
 * input blocking during transitions, and the back key.
 */
export class UIManager implements ViewHost {
    private readonly records = new Map<Function, Record>();
    private readonly stacks: ViewBase<any>[][] = [[], []];
    private readonly queue: Queued[] = [];
    private queuedOpen: ViewBase<any> | null = null;
    /** Views in a show/hide transition; input is blocked while any exists or a view is loading. */
    private readonly busy = new Set<ViewBase<any>>();
    private readonly listeners = new Set<() => void>();
    private loadingCount = 0;

    constructor(private readonly root: UIRoot, private readonly loader: ResLoader) {
        input.on(Input.EventType.KEY_DOWN, this.onKey, this);
    }

    open<V extends ViewBase<any>>(type: ViewClass<V>, ...args: OpenArgs<V>): Promise<V> {
        return this.openWith(type, args[0]) as Promise<V>;
    }

    private openWith(type: ViewClass<any>, arg: unknown): Promise<ViewBase<any>> {
        const record = this.records.get(type);
        if (record?.view) {
            this.reopen(record.view, arg);
            return Promise.resolve(record.view);
        }
        if (record?.pending) return record.pending;
        const entry: Record = { view: null, pending: null, prefab: null };
        this.records.set(type, entry);
        entry.pending = this.create(type, entry, arg);
        return entry.pending;
    }

    /** Open now if no queued popup is showing, otherwise after the previous queued one closes. */
    enqueue<V extends ViewBase<any>>(type: ViewClass<V>, ...args: OpenArgs<V>): void {
        this.queue.push({ type, args: args[0] });
        if (!this.queuedOpen) this.openNextQueued();
    }

    close(view: ViewBase<any>): void {
        if (!view.isOpened) return;
        debugLog('UI', 'close', view.constructor.name);
        const stack = view.meta.queue === UIQueue.None ? null : this.stacks[view.meta.queue];
        const wasTop = !!stack && stack[stack.length - 1] === view;
        view._setShowed(false);
        this.setBusy(view, true);
        playHide(view, () => {
            view.onHideFinish();
            view._close();
            const record = this.records.get(view.constructor)!;
            record.prefab!.decRef();
            this.records.delete(view.constructor);
            view.node.destroy();
            if (stack) {
                stack.splice(stack.indexOf(view), 1);
                const previous = stack[stack.length - 1];
                if (wasTop && previous) this.show(previous);
            }
            this.setBusy(view, false);
            this.notify();
            if (this.queuedOpen === view) {
                this.queuedOpen = null;
                this.openNextQueued();
            }
        });
    }

    closeAll(queue: UIQueue): void {
        for (const view of this.stacks[queue].slice().reverse()) this.close(view);
    }

/** Called after a view finished showing or closing (the visible top may have changed). */
    onChanged(enabled: boolean, listener: () => void): void {
        if (enabled) this.listeners.add(listener);
        else this.listeners.delete(listener);
    }

/** The open instance of a view class, or null. */
    find<V extends ViewBase<any>>(type: ViewClass<V>): V | null {
        return (this.records.get(type)?.view as V | undefined) ?? null;
    }

    top(queue: UIQueue): ViewBase<any> | null {
        const stack = this.stacks[queue];
        return stack[stack.length - 1] ?? null;
    }

    private async create(type: ViewClass<any>, entry: Record, arg: unknown): Promise<ViewBase<any>> {
        const meta = viewMeta(type);
        debugLog('UI', 'open', type.name);
        this.setLoading(true);
        const prefab = await this.loader.load(meta.bundle, meta.path, Prefab);
        this.setLoading(false);
        prefab.addRef();
        entry.prefab = prefab;
        const node = instantiate(prefab);
        const view = node.getComponent(type) as ViewBase<any>;
        if (!view) throw new Error(`${meta.path} root has no ${type.name} component`);
        view.meta = meta;
        view.host = this;
        node.active = false;
        node.parent = this.root.layers[meta.layer];
        entry.view = view;
        entry.pending = null;
        if (meta.queue !== UIQueue.None) {
            const stack = this.stacks[meta.queue];
            const previous = stack[stack.length - 1];
            if (previous) this.hide(previous);
            stack.push(view);
        }
        view._open(arg);
        this.show(view);
        return view;
    }

    private reopen(view: ViewBase<any>, arg: unknown): void {
        view.node.setSiblingIndex(view.node.parent!.children.length - 1);
        if (view.meta.queue !== UIQueue.None) {
            const stack = this.stacks[view.meta.queue];
            if (stack[stack.length - 1] !== view) {
                this.hide(stack[stack.length - 1]);
                stack.splice(stack.indexOf(view), 1);
                stack.push(view);
            }
        }
        view._open(arg);
        if (!view.isShowed) this.show(view);
    }

    private show(view: ViewBase<any>): void {
        this.setBusy(view, true);
        view._setShowed(true);
        playShow(view, () => {
            this.setBusy(view, false);
            view.onShowFinish();
            this.notify();
        });
    }

    private hide(view: ViewBase<any>): void {
        if (!view.isShowed) return;
        stopTransition(view);
        this.setBusy(view, false);
        view._setShowed(false);
        view.node.active = false;
        view.onHideFinish();
    }

    private notify(): void {
        for (const listener of Array.from(this.listeners)) listener();
    }

    private openNextQueued(): void {
        const next = this.queue.shift();
        if (!next) return;
        void this.openWith(next.type, next.args).then(view => { this.queuedOpen = view; });
    }

    private setBusy(view: ViewBase<any>, on: boolean): void {
        if (on) this.busy.add(view);
        else this.busy.delete(view);
        this.updateBlock();
    }

    private updateBlock(): void {
        const blocked = this.busy.size > 0 || this.loadingCount > 0;
        if (blocked !== this.root.block.active) debugLog('UI', 'input', blocked ? 'blocked' : 'free', [...this.busy].map(v => v.constructor.name));
        this.root.block.active = blocked;
    }

    private setLoading(on: boolean): void {
        this.loadingCount += on ? 1 : -1;
        this.updateBlock();
        if (on) this.root.scheduleOnce(() => { this.root.loading.active = this.loadingCount > 0; }, LOADING_DELAY);
        else if (this.loadingCount === 0) this.root.loading.active = false;
    }

    private onKey(event: EventKeyboard): void {
        if (event.keyCode !== KeyCode.MOBILE_BACK && event.keyCode !== KeyCode.ESCAPE) return;
        if (this.root.block.active) return;
        const view = this.top(UIQueue.Popup) ?? this.top(UIQueue.Page);
        if (view) view.onBack();
    }
}
