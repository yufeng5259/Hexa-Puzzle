import { _decorator, Component, instantiate, isValid, Layout, Mask, Node, Prefab, ScrollView, UITransform, Vec2 } from 'cc';
import { requireBinding } from '../components/Binding';
import { listWindow } from '../core/VirtualWindow';
import { VirtualListItem } from './VirtualListItem';
const { ccclass, property } = _decorator;

/** Fixed-extent virtual list. Content and items are top-left anchored in its Prefab. */
@ccclass('VirtualList')
export class VirtualList extends Component {
    @property(ScrollView) public scrollView: ScrollView | null = null;
    @property(Node) public viewport: Node | null = null;
    @property(Node) public content: Node | null = null;
    @property(Prefab) public itemPrefab: Prefab | null = null;
    @property public itemExtent = 100;
    @property public spacing = 0;
    @property public buffer = 2;
    @property public horizontal = false;
    private values: readonly unknown[] = [];
    private readonly visible = new Map<number, VirtualListItem>();
    private readonly pool: VirtualListItem[] = [];
    private select: ((index: number, value: unknown) => void) | undefined;
    private listening = false;
    private ready = false;

    public onLoad(): void { this.validateBindings(); this.ready = true; this.refresh(); }
    public validateBindings(): void {
        const scroll = requireBinding('VirtualList', 'scrollView', this.scrollView);
        const viewport = requireBinding('VirtualList', 'viewport', this.viewport);
        const content = requireBinding('VirtualList', 'content', this.content);
        const prefab = requireBinding('VirtualList', 'itemPrefab', this.itemPrefab);
        const viewportUI = requireBinding('VirtualList', 'viewport.UITransform', viewport.getComponent(UITransform));
        const contentUI = requireBinding('VirtualList', 'content.UITransform', content.getComponent(UITransform));
        requireBinding('VirtualList', 'viewport.Mask', viewport.getComponent(Mask));
        if (scroll.content !== content || content.parent !== viewport) throw new Error('VirtualList ScrollView/content/viewport binding mismatch');
        if (content.getComponent(Layout)?.enabled) throw new Error('VirtualList content must not have an enabled Layout');
        for (const transform of [viewportUI, contentUI]) {
            if (transform.anchorX !== 0 || transform.anchorY !== 1) throw new Error('VirtualList viewport/content require top-left anchors');
        }
        const template = prefab.data as Node;
        requireBinding('VirtualList', 'itemPrefab.VirtualListItem', template.getComponent(VirtualListItem));
        const itemUI = requireBinding('VirtualList', 'itemPrefab.UITransform', template.getComponent(UITransform));
        if (itemUI.anchorX !== 0 || itemUI.anchorY !== 1) throw new Error('VirtualList item requires top-left anchor');
        listWindow(0, this.itemExtent, this.spacing, 0, 0, this.buffer);
        scroll.horizontal = this.horizontal; scroll.vertical = !this.horizontal;
    }
    public onEnable(): void {
        if (this.listening) return;
        requireBinding('VirtualList', 'scrollView', this.scrollView).node.on(ScrollView.EventType.SCROLLING, this.refresh, this);
        requireBinding('VirtualList', 'viewport', this.viewport).on(Node.EventType.SIZE_CHANGED, this.onResize, this);
        this.listening = true;
        if (this.ready) this.onResize();
    }
    public onDisable(): void {
        if (!this.listening) return;
        this.scrollView?.node?.off(ScrollView.EventType.SCROLLING, this.refresh, this);
        this.viewport?.off(Node.EventType.SIZE_CHANGED, this.onResize, this);
        this.listening = false;
    }
    public setData(values: readonly unknown[], onSelect?: (index: number, value: unknown) => void): void {
        if (!this.ready) { this.validateBindings(); this.ready = true; }
        this.scrollView!.stopAutoScroll();
        this.recycleAll();
        // Keep a stable snapshot so external array mutation cannot invalidate the visible range.
        this.values = values.slice(); this.select = onSelect;
        this.updateContentSize();
        this.scrollView!.scrollToOffset(new Vec2(0, 0), 0);
        this.refresh();
    }
    public jumpTo(index: number): void {
        if (!this.ready || !this.values.length) return;
        if (!Number.isFinite(index)) throw new Error('VirtualList index must be finite');
        const target = Math.max(0, Math.min(this.values.length - 1, Math.floor(index)));
        const offset = target * (this.itemExtent + this.spacing);
        const window = listWindow(this.values.length, this.itemExtent, this.spacing, this.viewportExtent(), offset, this.buffer);
        this.scrollView!.stopAutoScroll();
        this.scrollView!.scrollToOffset(this.horizontal ? new Vec2(window.offset, 0) : new Vec2(0, window.offset), 0);
        this.refresh();
    }
    public refresh(): void {
        if (!this.ready) return;
        this.updateContentSize();
        const offset = this.scrollView!.getScrollOffset();
        // Cocos reports horizontal leftward content displacement as a negative x offset.
        const position = this.horizontal ? -offset.x : offset.y;
        const window = listWindow(this.values.length, this.itemExtent, this.spacing, this.viewportExtent(), position, this.buffer);
        for (const [index, item] of this.visible) {
            if (index < window.first || index >= window.end) { this.recycle(item); this.visible.delete(index); }
        }
        for (let index = window.first; index < window.end; index++) {
            let item = this.visible.get(index);
            if (!item) {
                item = this.take(); this.visible.set(index, item);
                item.bind(this.values[index], index, this.select);
            }
            const position = index * (this.itemExtent + this.spacing);
            item.node.setPosition(this.horizontal ? position : 0, this.horizontal ? 0 : -position, 0);
            const itemUI = item.node.getComponent(UITransform)!;
            const cross = this.viewport!.getComponent(UITransform)!;
            itemUI.setContentSize(this.horizontal ? this.itemExtent : cross.width, this.horizontal ? cross.height : this.itemExtent);
        }
        // A resized viewport must also reduce the retained pool instead of keeping old capacity.
        const capacity = Math.max(1, window.end - window.first);
        while (this.pool.length > capacity) this.pool.pop()!.node.destroy();
    }
    public get activeItemCount(): number { return this.visible.size; }
    public get retainedItemCount(): number { return this.visible.size + this.pool.length; }
    public onDestroy(): void {
        this.ready = false;
        this.onDisable();
        // Cocos destroys child nodes before this parent component. Their components
        // may already have node=null; never rebind/recycle those destroyed children.
        const owned = [...this.visible.values(), ...this.pool];
        this.visible.clear();
        for (const item of owned) {
            const node = item.node;
            if (node && isValid(node, true)) node.destroy();
        }
        this.pool.length = 0; this.values = []; this.select = undefined;
    }
    private onResize(): void {
        this.scrollView!.stopAutoScroll();
        const offset = this.scrollView!.getScrollOffset();
        const position = this.horizontal ? -offset.x : offset.y;
        this.updateContentSize();
        const window = listWindow(this.values.length, this.itemExtent, this.spacing, this.viewportExtent(), position, this.buffer);
        this.scrollView!.scrollToOffset(this.horizontal ? new Vec2(window.offset, 0) : new Vec2(0, window.offset), 0);
        this.refresh();
    }
    private viewportExtent(): number {
        const transform = this.viewport!.getComponent(UITransform)!;
        return this.horizontal ? transform.width : transform.height;
    }
    private updateContentSize(): void {
        const transform = this.content!.getComponent(UITransform)!;
        const viewport = this.viewport!.getComponent(UITransform)!;
        const extent = listWindow(this.values.length, this.itemExtent, this.spacing, this.viewportExtent(), 0, this.buffer).extent;
        transform.setContentSize(this.horizontal ? Math.max(viewport.width, extent) : viewport.width,
            this.horizontal ? viewport.height : Math.max(viewport.height, extent));
    }
    private take(): VirtualListItem {
        const item = this.pool.pop() || requireBinding('VirtualList', 'instantiated VirtualListItem', instantiate(this.itemPrefab!).getComponent(VirtualListItem));
        item.node.parent = this.content; item.node.active = true;
        return item;
    }
    private recycle(item: VirtualListItem): void {
        item.unbind(); item.node.active = false; this.pool.push(item);
    }
    private recycleAll(): void {
        for (const item of this.visible.values()) this.recycle(item);
        this.visible.clear();
    }
}
