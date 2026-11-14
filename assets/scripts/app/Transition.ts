import { BlockInputEvents, Color, Graphics, Node, UITransform, view } from 'cc';

const HEX_RADIUS = 64;
/** How much of the sweep each cell takes to grow (0..1 of the whole); larger = softer front. */
const SPREAD = 0.35;
const FILL = new Color(20, 46, 104, 255);
const EDGE = new Color(48, 92, 178, 255);
const TIMES = { cover: 0.28, reveal: 0.34 };

/**
 * Full-screen honeycomb transition above every layer. cover() grows hexagons from the
 * centre until the screen is hidden; reveal() opens them again from the centre. While
 * it runs the node blocks all touches.
 */
export class Transition {
    private readonly node: Node;
    private readonly g: Graphics;
    private anim: { from: number; to: number; time: number; length: number; reveal: boolean; done: () => void } | null = null;
    /** 0 = clear, 1 = fully covered. */
    private amount = 0;

    public constructor(parent: Node) {
        this.node = new Node('Transition');
        this.node.layer = parent.layer;
        this.node.parent = parent;
        this.node.addComponent(UITransform);
        this.node.addComponent(BlockInputEvents);
        this.g = this.node.addComponent(Graphics);
        this.node.active = false;
    }

    public get busy(): boolean { return this.node.active; }
    public toTop(): void { this.node.setSiblingIndex(this.node.parent!.children.length - 1); }
    public get covered(): boolean { return this.amount >= 1; }

    public cover(): Promise<void> { return this.run(1, TIMES.cover, false); }
    public reveal(): Promise<void> { return this.run(0, TIMES.reveal, true); }

    /** Called every frame by GameBoot. */
    public update(dt: number): void {
        const a = this.anim;
        if (!a) return;
        a.time = Math.min(a.length, a.time + dt);
        const k = a.time / a.length, eased = k * k * (3 - 2 * k);
        this.amount = a.from + (a.to - a.from) * eased;
        this.draw(a.reveal);
        if (a.time >= a.length) {
            this.anim = null;
            if (this.amount <= 0) this.node.active = false;
            a.done();
        }
    }

    private run(to: number, length: number, reveal: boolean): Promise<void> {
        if (this.amount === to && !this.anim) { this.node.active = to > 0; if (to > 0) this.draw(reveal); return Promise.resolve(); }
        this.anim?.done();
        this.node.setSiblingIndex(this.node.parent!.children.length - 1);
        this.node.active = true;
        const size = view.getVisibleSize();
        this.node.getComponent(UITransform)!.setContentSize(size.width, size.height);
        return new Promise(done => { this.anim = { from: this.amount, to, time: 0, length, reveal, done }; });
    }

    /** Covering grows from the centre outwards; revealing shrinks the centre first. */
    private draw(reveal: boolean): void {
        const g = this.g, size = view.getVisibleSize(), r = HEX_RADIUS;
        const w = 1.5 * r, h = Math.sqrt(3) * r, cols = Math.ceil(size.width / 2 / w) + 1, rows = Math.ceil(size.height / 2 / h) + 1;
        const maxDist = Math.hypot(size.width / 2, size.height / 2) + r;
        g.clear();
        g.fillColor = FILL; g.strokeColor = EDGE; g.lineWidth = 4;
        for (let c = -cols; c <= cols; c++) for (let row = -rows; row <= rows; row++) {
            const x = c * w, y = row * h + (c & 1 ? h / 2 : 0), d = Math.hypot(x, y) / maxDist;
            const front = reveal ? 1 - d : d;
            const grow = Math.max(0, Math.min(1, (this.amount * (1 + SPREAD) - front) / SPREAD));
            if (grow <= 0) continue;
            const k = r * grow * 1.06; // slight overlap so a covered screen has no gaps
            for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, px = x + Math.cos(a) * k, py = y + Math.sin(a) * k; if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); }
            g.close();
        }
        g.fill();
        if (this.amount < 1) g.stroke();
    }
}
