import { BlockInputEvents, Color, Graphics, Node, UITransform } from 'cc';
import { ScreenFit } from '../features/ui/ScreenFit';
import type { Fit } from '../features/ui/FitMath';

/**
 * Tablet / unfolded-foldable mode: two plain black strips left and right of the design-ratio
 * frame. They hide anything that overflows the frame and swallow touches there.
 * Phones have no curtains (the frame is the whole screen).
 */
export class SideCurtains {
    private readonly node: Node;
    private readonly g: Graphics;
    /** Touch blockers covering exactly the two side strips (the frame stays interactive). */
    private readonly blockers: Node[];
    private key = '';

    public constructor(parent: Node) {
        this.node = new Node('SideCurtains');
        this.node.layer = parent.layer;
        this.node.parent = parent;
        this.node.addComponent(UITransform);
        this.g = this.node.addComponent(Graphics);
        this.blockers = ['Left', 'Right'].map(name => {
            const n = new Node(name);
            n.layer = parent.layer; n.parent = this.node;
            n.addComponent(UITransform);
            n.addComponent(BlockInputEvents);
            return n;
        });
        ScreenFit.events.on('changed', () => { this.key = ''; }, this);
    }
    /** Keeps the curtains just under the given node (the transition stays above them). */
    public placeBelow(top: Node | null): void {
        const parent = this.node.parent!;
        this.node.setSiblingIndex(top && top.parent === parent ? Math.max(0, top.getSiblingIndex() - 1) : parent.children.length - 1);
    }

    /** Called every frame by GameBoot; redraws only when the screen or frame changes. */
    public update(): void {
        const fit = ScreenFit.current, side = (fit.visible.width - fit.frame.width) / 2;
        const active = fit.tablet && side > 1;
        if (this.node.active !== active) this.node.active = active;
        if (!active) return;
        const key = `${fit.visible.width}x${fit.visible.height}|${fit.frame.x},${fit.frame.width}`;
        if (key === this.key) return;
        this.key = key;
        this.draw(fit);
    }

    private draw(fit: Fit): void {
        const g = this.g, W = fit.visible.width, H = fit.visible.height;
        this.node.getComponent(UITransform)!.setContentSize(W, H);
        const frameLeft = fit.frame.x - fit.frame.width / 2, frameRight = fit.frame.x + fit.frame.width / 2;
        const strips: [number, number][] = [[-W / 2, frameLeft], [frameRight, W / 2]];
        g.clear();
        g.fillColor = Color.BLACK;
        strips.forEach(([x0, x1], i) => {
            const b = this.blockers[i], w = Math.max(0, x1 - x0);
            b.getComponent(UITransform)!.setContentSize(w, H);
            b.setPosition((x0 + x1) / 2, 0, 0);
            // 1 unit of overlap into the frame hides sub-pixel seams at the frame edge.
            if (w > 0) g.rect(i === 0 ? x0 : x1 - w - 1, -H / 2, w + 1, H);
        });
        g.fill();
    }
}
