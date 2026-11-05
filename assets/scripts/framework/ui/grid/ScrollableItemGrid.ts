import { _decorator, Component, instantiate, Node, Prefab, ScrollView, UITransform } from 'cc';
import { ItemGridCell } from './ItemGridCell';

const { ccclass, property } = _decorator;

/**
 * BigHero ScrollableItemGrid on 3.x (vertical): only visible rows are instantiated and reused.
 * Lives on the ScrollView node; the content node is top-anchored; cell prefab root extends ItemGridCell.
 */
@ccclass('ScrollableItemGrid')
export class ScrollableItemGrid extends Component {
    @property(ScrollView) scrollView: ScrollView = null!;
    @property(Node) content: Node = null!;
    @property(Prefab) cellPrefab: Prefab = null!;
    @property columns = 1;
    @property spacingX = 0;
    @property spacingY = 12;

    private items: readonly unknown[] = [];
    private cellWidth = 0;
    private cellHeight = 0;
    private readonly active = new Map<number, ItemGridCell>();
    private readonly free: ItemGridCell[] = [];

    onLoad(): void {
        const size = this.cellPrefab.data.getComponent(UITransform)!.contentSize;
        this.cellWidth = size.width;
        this.cellHeight = size.height;
        this.scrollView.node.on(ScrollView.EventType.SCROLLING, this.refreshVisible, this);
    }

    loadData(items: readonly unknown[]): void {
        this.items = items;
        const rows = Math.ceil(items.length / this.columns);
        const height = Math.max(0, rows * (this.cellHeight + this.spacingY) - this.spacingY);
        this.content.getComponent(UITransform)!.height = height;
        for (const cell of this.active.values()) this.recycle(cell);
        this.active.clear();
        this.refreshVisible();
    }

    scrollToTop(): void {
        this.scrollView.scrollToTop(0);
        this.refreshVisible();
    }

    private refreshVisible(): void {
        const viewHeight = this.scrollView.node.getComponent(UITransform)!.height;
        const offset = this.scrollView.getScrollOffset().y;
        const rowHeight = this.cellHeight + this.spacingY;
        const first = Math.max(0, Math.floor(offset / rowHeight)) * this.columns;
        const last = Math.min(this.items.length - 1, (Math.floor((offset + viewHeight) / rowHeight) + 1) * this.columns - 1);
        for (const [index, cell] of this.active) {
            if (index < first || index > last) {
                this.recycle(cell);
                this.active.delete(index);
            }
        }
        const rowWidth = this.columns * this.cellWidth + (this.columns - 1) * this.spacingX;
        for (let index = first; index <= last; index++) {
            if (this.active.has(index)) continue;
            const cell = this.take();
            const column = index % this.columns, row = Math.floor(index / this.columns);
            cell.node.setPosition(-rowWidth / 2 + this.cellWidth / 2 + column * (this.cellWidth + this.spacingX),
                -this.cellHeight / 2 - row * rowHeight);
            cell.onRefresh(this.items[index], index);
            this.active.set(index, cell);
        }
    }

    private take(): ItemGridCell {
        const reused = this.free.pop();
        if (reused) {
            reused.node.active = true;
            return reused;
        }
        const node = instantiate(this.cellPrefab);
        node.parent = this.content;
        return node.getComponent(ItemGridCell)!;
    }

    private recycle(cell: ItemGridCell): void {
        cell.node.active = false;
        this.free.push(cell);
    }
}
