import { _decorator, CCString, Label, Node, Sprite, SpriteFrame } from 'cc';
import { BaseView } from '../../framework/ui/BaseView';
import { requireBinding } from '../../framework/components/Binding';
const { ccclass, property } = _decorator;

/**
 * Root of every Prefab generated from docs/v2/素材/布局/Sxx.json. Element ids from
 * the layout are serialized next to their nodes, so feature code addresses the
 * real controls by the same id the artist used. Buttons call onAction(id).
 */
@ccclass('LayoutView')
export class LayoutView extends BaseView {
    @property(CCString) public pageId = '';
    @property([Node]) public nodes: Node[] = [];
    @property([CCString]) public nodeIds: string[] = [];
    @property([Label]) public labels: Label[] = [];
    @property([CCString]) public labelIds: string[] = [];
    private index: Map<string, Node> | null = null;
    private labelIndex: Map<string, Label> | null = null;

    public validateBindings(): void {
        super.validateBindings();
        if (this.nodes.length !== this.nodeIds.length || this.labels.length !== this.labelIds.length) throw new Error(`LayoutView ${this.pageId}: id lists do not match bindings`);
        this.nodes.forEach((node, i) => requireBinding(`LayoutView ${this.pageId}`, this.nodeIds[i], node));
        this.labels.forEach((label, i) => requireBinding(`LayoutView ${this.pageId}`, this.labelIds[i], label));
    }
    public has(id: string): boolean { return this.nodeMap().has(id); }
    public element(id: string): Node {
        const node = this.nodeMap().get(id);
        if (!node) throw new Error(`LayoutView ${this.pageId}: no element ${id}`);
        return node;
    }
    public label(id: string): Label {
        this.labelIndex ??= new Map(this.labelIds.map((key, i) => [key, this.labels[i]]));
        const label = this.labelIndex.get(id);
        if (!label) throw new Error(`LayoutView ${this.pageId}: no label ${id}`);
        return label;
    }
    public setText(id: string, text: string | number): void { this.label(id).string = String(text); }
    public setVisible(id: string, visible: boolean): void { this.element(id).active = visible; }
    public setFrame(id: string, frame: SpriteFrame | null): void {
        requireBinding(`LayoutView ${this.pageId}`, `${id}.Sprite`, this.element(id).getComponent(Sprite)).spriteFrame = frame;
    }
    private nodeMap(): Map<string, Node> {
        this.index ??= new Map(this.nodeIds.map((key, i) => [key, this.nodes[i]]));
        return this.index;
    }
}
