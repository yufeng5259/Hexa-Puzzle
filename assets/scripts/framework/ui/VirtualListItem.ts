import { _decorator, Component, Label, Node } from 'cc';
const { ccclass, property } = _decorator;
export interface ListItemPresentation { title?: string; selected?: boolean }

/** Typed root component on each item Prefab. Rebinding invalidates every old async identity. */
@ccclass('VirtualListItem')
export class VirtualListItem extends Component {
    @property(Label) public titleLabel: Label | null = null;
    @property(Node) public selectedMarker: Node | null = null;
    private revision = 0;
    private boundIndex = -1;
    private value: unknown = null;
    private selected: ((index: number, value: unknown) => void) | null = null;
    public get index(): number { return this.boundIndex; }
    public bind(value: unknown, index: number, selected?: (index: number, value: unknown) => void): void {
        this.unbind();
        this.boundIndex = index; this.value = value; this.selected = selected || null;
        const presentation = value && typeof value === 'object' ? value as ListItemPresentation : null;
        if (this.titleLabel) this.titleLabel.string = presentation?.title ?? '';
        if (this.selectedMarker) this.selectedMarker.active = presentation?.selected === true;
        this.onBind(value, index);
    }
    public unbind(): void {
        this.revision++;
        if (this.boundIndex >= 0) this.onUnbind();
        this.boundIndex = -1; this.value = null; this.selected = null;
        if (this.titleLabel) this.titleLabel.string = '';
        if (this.selectedMarker) this.selectedMarker.active = false;
    }
    public onItemClicked(): void { if (this.boundIndex >= 0) this.selected?.(this.boundIndex, this.value); }
    protected requestIdentity(): () => boolean {
        const revision = this.revision;
        return () => this.isValid && this.boundIndex >= 0 && revision === this.revision;
    }
    protected onBind(_value: unknown, _index: number): void {}
    protected onUnbind(): void {}
    public onDestroy(): void { this.unbind(); }
}
