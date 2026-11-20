import { BlockInputEvents, Color, Graphics, Label, Node, Tween, tween, UIOpacity, UITransform, Vec3, view } from 'cc';

/**
 * A lightweight anchored tooltip bubble (no Prefab needed).
 * show(anchor, items) pops a rounded-rect bubble above the anchor node,
 * with a small downward triangle pointer. Tapping anywhere dismisses it.
 *
 * Usage:
 *   TooltipBubble.show(someNode, [{ icon: '🎁', label: '金币 ×200' }, ...]);
 *   TooltipBubble.dismiss();
 */

export interface TooltipItem { readonly icon: string; readonly label: string; }

const PAD = { x: 32, y: 24 };
const GAP = 16;
const ROW_H = 56;
const FONT = 36;
const CORNER = 24;
const POINTER_H = 20;
const POINTER_W = 32;
const BG = new Color(255, 255, 255, 240);
const SHADOW = new Color(0, 0, 0, 40);
const TEXT_COLOR = new Color(44, 62, 80, 255);
const LABEL_COLOR = new Color(91, 58, 22, 255);
const ANIM_MS = 150;

let _current: { node: Node; mask: Node } | null = null;

export class TooltipBubble {
    /** Shows a tooltip above `anchor` node (world-space centre used as pointer tip). */
    static show(anchor: Node, items: TooltipItem[], title?: string): void {
        TooltipBubble.dismiss();

        const ui = anchor.getComponent(UITransform);
        if (!ui) return;

        // World position of anchor top-centre
        const anchorWorld = anchor.getWorldPosition();
        const anchorTopY = anchorWorld.y + ui.height * (1 - ui.anchorY) * anchor.scale.y;
        const anchorCX = anchorWorld.x;

        // Find scene root layer (parent of dialogs / guide)
        const scene = anchor.scene?.children[0];
        if (!scene) return;

        // ---- mask (full-screen transparent tap-catcher) ----
        const maskNode = new Node('TooltipMask');
        maskNode.layer = anchor.layer;
        maskNode.parent = scene;
        const maskUi = maskNode.addComponent(UITransform);
        maskNode.addComponent(BlockInputEvents);
        const sz = view.getVisibleSize();
        maskUi.setContentSize(sz.width, sz.height);
        maskNode.on(Node.EventType.TOUCH_END, () => TooltipBubble.dismiss());

        // ---- bubble node ----
        const bubbleNode = new Node('TooltipBubble');
        bubbleNode.layer = anchor.layer;
        bubbleNode.parent = scene;

        const rows = items.length + (title ? 1 : 0);
        const bubbleW = 320;
        const bubbleH = rows * ROW_H + PAD.y * 2 + (items.length > 1 ? (items.length - 1) * GAP : 0);

        const bubbleUi = bubbleNode.addComponent(UITransform);
        bubbleUi.setContentSize(bubbleW, bubbleH + POINTER_H);
        bubbleUi.setAnchorPoint(0.5, 0);

        // Position: pointer tip at anchor top-centre
        const clampedX = Math.max(-sz.width / 2 + bubbleW / 2 + 16, Math.min(sz.width / 2 - bubbleW / 2 - 16, anchorCX));
        bubbleNode.setWorldPosition(clampedX, anchorTopY + 8, 0);

        const g = bubbleNode.addComponent(Graphics);
        drawBubble(g, bubbleW, bubbleH, CORNER, POINTER_H, POINTER_W, anchorCX - clampedX);

        // ---- text rows ----
        let startTitle = title ? 1 : 0;
        if (title) {
            const titleNode = makeLabel(bubbleNode, title, FONT, LABEL_COLOR, bubbleW - PAD.x * 2);
            titleNode.setPosition(0, bubbleH - PAD.y - ROW_H * 0.5, 0);
        }
        items.forEach((item, i) => {
            const rowY = bubbleH - PAD.y - (startTitle + i + 0.5) * ROW_H - i * GAP;
            const rowText = item.icon ? `${item.icon}  ${item.label}` : item.label;
            const lbl = makeLabel(bubbleNode, rowText, FONT, TEXT_COLOR, bubbleW - PAD.x * 2);
            lbl.setPosition(0, rowY, 0);
        });

        // ---- pop-in ----
        const op = bubbleNode.addComponent(UIOpacity);
        op.opacity = 0;
        bubbleNode.setScale(0.85, 0.85, 1);
        tween(bubbleNode)
            .to(ANIM_MS / 1000, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();
        tween(op).to(ANIM_MS / 1000, { opacity: 255 }).start();

        _current = { node: bubbleNode, mask: maskNode };
    }

    static dismiss(): void {
        if (!_current) return;
        const { node, mask } = _current;
        _current = null;
        const op = node.getComponent(UIOpacity);
        if (op) {
            tween(op).to(0.1, { opacity: 0 }).call(() => { if (node.isValid) node.destroy(); if (mask.isValid) mask.destroy(); }).start();
        } else {
            if (node.isValid) node.destroy();
            if (mask.isValid) mask.destroy();
        }
    }
}

function drawBubble(g: Graphics, w: number, h: number, r: number, ph: number, pw: number, pOffsetX: number): void {
    // Shadow
    g.fillColor = SHADOW;
    roundRect(g, -w / 2 + 2, ph + 2, w, h, r);
    g.fill();
    // Background
    g.fillColor = BG;
    roundRect(g, -w / 2, ph, w, h, r);
    // Pointer triangle (pointing down)
    const px = Math.max(-w / 2 + pw, Math.min(w / 2 - pw, pOffsetX));
    g.moveTo(px - pw / 2, ph);
    g.lineTo(px + pw / 2, ph);
    g.lineTo(px, 0);
    g.close();
    g.fill();
}

function roundRect(g: Graphics, x: number, y: number, w: number, h: number, r: number): void {
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.arc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    g.lineTo(x + w, y + h - r);
    g.arc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    g.lineTo(x + r, y + h);
    g.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    g.lineTo(x, y + r);
    g.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    g.close();
}

function makeLabel(parent: Node, text: string, fontSize: number, color: Color, maxW: number): Node {
    const node = new Node('TooltipLabel');
    node.layer = parent.layer;
    node.parent = parent;
    const ui = node.addComponent(UITransform);
    ui.setContentSize(maxW, ROW_H);
    ui.setAnchorPoint(0.5, 0.5);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 4;
    label.color = color;
    label.isBold = true;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    return node;
}
