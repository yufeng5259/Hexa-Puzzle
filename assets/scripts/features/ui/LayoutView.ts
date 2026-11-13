import { _decorator, CCString, Label, Node, Sprite, SpriteFrame, sys, UITransform, Vec3, view } from 'cc';
import { BaseView } from '../../framework/ui/BaseView';
import { requireBinding } from '../../framework/components/Binding';
import type { ResourceScope } from '../../framework/resources/ResourceScope';
const { ccclass, property } = _decorator;

export const DESIGN_WIDTH = 853, DESIGN_HEIGHT = 1844;
/** Elements entirely above / below these design-y edges (from the top) belong to the HUD / bottom button band. */
const TOP_BAND = 140, BOTTOM_BAND = DESIGN_HEIGHT - 254;

/** Uniform scale that makes a w×h picture cover the whole visible area. */
export function coverScale(w: number, h: number): number {
    const size = view.getVisibleSize();
    return Math.max(size.width / w, size.height / h, 1);
}
/** Extra visible height beyond the design (each side), and how much of it the device's unsafe edges take. */
export function screenInsets(): { extra: number; top: number; bottom: number } {
    const size = view.getVisibleSize(), origin = view.getVisibleOrigin(), safe = sys.getSafeAreaRect();
    return { extra: Math.max(0, (size.height - DESIGN_HEIGHT) / 2),
        top: Math.max(0, origin.y + size.height - (safe.y + safe.height)), bottom: Math.max(0, safe.y - origin.y) };
}

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
    /** Design-space positions, recorded before the first fit so refits never drift. */
    private designPositions: Map<Node, Vec3> | null = null;
    private labelIndex: Map<string, Label> | null = null;

    public validateBindings(): void {
        super.validateBindings();
        if (this.nodes.length !== this.nodeIds.length || this.labels.length !== this.labelIds.length) throw new Error(`LayoutView ${this.pageId}: id lists do not match bindings`);
        this.nodes.forEach((node, i) => requireBinding(`LayoutView ${this.pageId}`, this.nodeIds[i], node));
        this.labels.forEach((label, i) => requireBinding(`LayoutView ${this.pageId}`, this.labelIds[i], label));
    }
    /** The scope this view owns; data-driven children (board cells, pieces) borrow it. */
    public get resources(): ResourceScope { return this.resourceScope; }
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
    /**
     * Fits a full-screen page or dialog to the visible area: full-screen pictures cover it,
     * the HUD band hugs the safe top, the bottom button band the safe bottom, and the rest
     * stays centred in the 853×1844 design area (always fully visible, see GameBoot).
     */
    public fitScreen(): void {
        const root = this.node.getComponent(UITransform)!, size = view.getVisibleSize(), inset = screenInsets();
        root.setContentSize(size.width, size.height);
        this.designPositions ??= new Map(this.nodes.map(node => [node, node.position.clone()]));
        for (const node of this.nodes) {
            const ui = node.getComponent(UITransform), at = this.designPositions.get(node)!;
            if (!ui || node.parent !== this.node) continue;
            const top = DESIGN_HEIGHT / 2 - (at.y + ui.height * (1 - ui.anchorY)), bottom = DESIGN_HEIGHT / 2 - (at.y - ui.height * ui.anchorY);
            if (ui.width >= DESIGN_WIDTH - 20 && ui.height >= DESIGN_HEIGHT - 60) {
                // Backgrounds and dim masks; data mounts (no Sprite) keep the design frame.
                if (node.getComponent(Sprite)) { const s = coverScale(ui.width, ui.height); node.setScale(s * Math.sign(node.scale.x || 1), s, 1); }
            } else if (bottom <= TOP_BAND) node.setPosition(at.x, at.y + inset.extra - inset.top, at.z);
            else if (top >= BOTTOM_BAND) node.setPosition(at.x, at.y - inset.extra + inset.bottom, at.z);
        }
    }
    private nodeMap(): Map<string, Node> {
        this.index ??= new Map(this.nodeIds.map((key, i) => [key, this.nodes[i]]));
        return this.index;
    }
}
