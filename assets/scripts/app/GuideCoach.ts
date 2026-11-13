import { Color, Graphics, Label, Mask, Node, Sprite, SpriteFrame, Tween, tween, UIOpacity, UITransform, Vec3, view } from 'cc';
import type { Game } from '../core/Game';
import { guideStep, type GuideStep } from '../core/Guide';
import { approach, HandLoop, type DragMotion, type Point } from '../features/ui/GuideMotion';
import type { Navigator } from './Navigator';

/** Guide copy keyed by GuideSteps.textKey. */
const TEXT: Record<string, string> = {
    'guide.drag': '按住拼块，拖到发光的位置',
    'guide.home': '金币到手啦，回家建造吧',
    'guide.build': '点这里进入建造',
    'guide.upgrade': '花金币升级这座建筑',
    'guide.construct': '施工中…',
    'guide.welcome': '领取欢迎礼物',
};
/** P2 art (docs/v2/05_美术补充任务.md). Each piece is optional: until delivered the placeholder is used. */
const ART = {
    hand: 'UI/引导/guide_hand_normal.png', handPressed: 'UI/引导/guide_hand_pressed.png',
    bubble: 'UI/引导/guide_bubble.png', tail: 'UI/引导/guide_bubble_tail.png', ring: 'UI/引导/guide_ring.png',
    toast: 'UI/通用/toast_bg.png',
};
/** Fingertip pixel [20,36] in the 140×200 hand canvas (manifest anchor, top-left origin). */
const HAND = { width: 140, height: 200, tipX: 20 / 140, tipY: 36 / 200 };
/** The tail's open top edge overlaps the bubble bottom by this much (manifest attach.overlapPixels). */
const TAIL = { width: 40, height: 28, overlap: 14 };
const BUBBLE_GAP = 64;
const PULSE = 1.08;
const RING_PAD = 18;
const TEXT_PAD = { x: 36, y: 22 };
/** Dim layer: final opacity, fade speed (opacity/s) and how long a new spotlight waits for the page to settle. */
const DIM = { alpha: 150, rate: 900, settle: 0.15, holePad: 12, holeRadius: 22, hexScale: 1.04 };

export type HandMotion = Partial<DragMotion>;
/** A spotlight hole: a box in guide-layer space (buttons), or hex cell centres in world space (puzzle pieces and targets). */
export type Hole = { readonly box: { x: number; y: number; width: number; height: number } } | { readonly hexes: readonly Point[]; readonly radius: number };
/** First-level teaching drag. Every provider returns live world positions, or null while they are settling. */
export interface Lesson { from(): Point | null; to(): Point | null; holes(): Hole[] | null; motion?: HandMotion }

/**
 * First-run guide on the scene's guide layer: dim mask with holes, ring, hand and
 * text bubble. Every position is read from the live nodes each frame, so a tray
 * that re-flows or a page that re-lays out is followed. Where the player is in the
 * guide always comes from core/Guide; pages ask allows() before acting (the mask
 * is visual only and never blocks input).
 */
export class GuideCoach {
    private pulsing: { node: Node; scale: Vec3 } | null = null;
    private parts: Node[] = [];
    private bubble: Label | null = null;
    private target: { node: Node; rowId: string; side: 'above' | 'left'; key: string } | null = null;
    private lesson: Lesson | null = null;
    private hand: { sprite: Sprite; opacity: UIOpacity; loop: HandLoop; pressed: boolean | null } | null = null;
    private ring: Node | null = null;
    private mask: { node: Node; holes: Graphics; dim: Graphics; alpha: number; key: string } | null = null;
    private settle = 0;
    private paused = false;
    private flashTimer: ReturnType<typeof setTimeout> | null = null;

    public constructor(private readonly game: Game, private readonly layer: Node, private readonly nav: Navigator, private readonly dialogLayer: Node) {}

    public get step(): GuideStep { return guideStep(this.game.state, this.game.rules); }
    public get active(): boolean { return this.step !== 'done'; }
    public row(id: string) { return this.game.config.guide.find(r => r.id === id) ?? null; }
    public text(rowId: string): string { return TEXT[this.row(rowId)?.textKey ?? ''] ?? ''; }

    /** Whether an action may run now; while the guide is on only its target (and settings) respond. */
    public allows(page: 'home' | 'build' | 'puzzle' | 'result', actionId: string): boolean {
        const step = this.step;
        if (step === 'done') return true;
        if (/settings|hud_btn_square_purple|hud_btn_square_blue_2/.test(actionId) && page !== 'result') return true;
        switch (page) {
            case 'home': return step === 'firstPuzzle' ? actionId === 'home_play_btn' : step === 'goBuild' && actionId === 'home_btn_build';
            case 'build': return step === 'goBuild' && actionId === 'upgrade:' + this.game.rules.guideBuildingId;
            case 'puzzle': return false;
            case 'result': return actionId === 'btn_grey';
        }
    }

    /** Spotlights a control: hole, ring (or pulse), tapping hand and a text bubble. side 'left' keeps bottom-bar bubbles off other controls. */
    public point(target: Node, rowId: string, side: 'above' | 'left' = 'above'): void {
        if (this.target?.node === target && this.target.rowId === rowId) return;
        this.clear();
        if (!target.getComponent(UITransform) || !this.layer.isValid) return;
        this.target = { node: target, rowId, side, key: '' };
        if (this.nav.hasFrame(ART.ring)) {
            this.ring = this.sprite('GuideRing', ART.ring, 10, 10, true).node;
            tween(this.ring).repeatForever(tween(this.ring).to(0.45, { scale: new Vec3(PULSE, PULSE, 1) }).to(0.45, { scale: new Vec3(1, 1, 1) })).start();
        } else {
            this.pulsing = { node: target, scale: target.scale.clone() };
            const s = this.pulsing.scale;
            tween(target).repeatForever(tween(target).to(0.45, { scale: new Vec3(s.x * PULSE, s.y * PULSE, s.z) }).to(0.45, { scale: s })).start();
        }
        this.ensureMask();
        if (this.nav.hasFrame(ART.hand)) this.makeHand(new HandLoop(() => this.box(target) && this.tapPoint(target), null));
        this.settle = DIM.settle;
    }

    /** Starts (or replaces) the first-level drag lesson. */
    public teach(lesson: Lesson): void {
        if (this.lesson === lesson) return;
        this.clear();
        if (!this.layer.isValid) return;
        this.lesson = lesson;
        this.ensureMask();
        if (this.nav.hasFrame(ART.hand)) this.makeHand(new HandLoop(() => this.local(lesson.from()), () => this.local(lesson.to()), lesson.motion));
        this.settle = DIM.settle;
    }
    public get teaching(): Lesson | null { return this.lesson; }

    /** While the player drags (or a dialog covers the page) the spotlight steps back. */
    public setPaused(paused: boolean): void {
        if (this.paused === paused) return;
        this.paused = paused;
        if (!paused) { this.hand?.loop.restart(); this.settle = DIM.settle; }
    }

    /** Called every frame by GameBoot. */
    public update(dt: number): void {
        if (!this.target && !this.lesson) return;
        if (this.target && !this.target.node.isValid) { this.clear(); return; }
        const covered = this.nav.dialogOpen && !!this.target && !this.inDialog(this.target.node) || this.nav.dialogOpen && !!this.lesson;
        const hold = this.paused || covered;
        this.settle = hold ? DIM.settle : Math.max(0, this.settle - dt);
        const holes = hold ? null : this.target ? this.targetHoles() : this.lesson!.holes();
        const showing = !hold && this.settle <= 0 && !!holes;
        if (this.mask) {
            if (holes) this.drawHoles(holes);
            this.paintDim(approach(this.mask.alpha, showing ? DIM.alpha : 0, DIM.rate, dt));
        }
        if (this.target) this.layoutTarget(showing);
        if (this.hand) {
            const pose = showing ? this.hand.loop.step(dt) : null;
            const node = this.hand.sprite.node;
            node.active = !!pose?.visible;
            if (pose?.visible) {
                node.setPosition(pose.at.x, pose.at.y, 0);
                this.hand.opacity.opacity = pose.opacity;
                if (this.hand.pressed !== pose.pressed) {
                    this.hand.pressed = pose.pressed;
                    this.frame(this.hand.sprite, pose.pressed && this.nav.hasFrame(ART.handPressed) ? ART.handPressed : ART.hand);
                }
            } else if (!showing) this.hand.loop.restart();
        }
    }

    /** A short notice (help text, locked entry, level info) that disappears by itself. */
    public flash(text: string, seconds = 2.5): void {
        this.clear();
        const label = this.say(text, new Vec3(0, 0, 0), false);
        this.flashTimer = setTimeout(() => { this.flashTimer = null; if (this.bubble === label) this.clear(); }, seconds * 1000);
    }

    public clear(): void {
        if (this.flashTimer) { clearTimeout(this.flashTimer); this.flashTimer = null; }
        if (this.pulsing) {
            Tween.stopAllByTarget(this.pulsing.node);
            if (this.pulsing.node.isValid) this.pulsing.node.setScale(this.pulsing.scale);
            this.pulsing = null;
        }
        this.parts.forEach(node => { Tween.stopAllByTarget(node); if (node.isValid) node.destroy(); });
        this.parts = [];
        this.bubble = null; this.target = null; this.lesson = null; this.hand = null; this.ring = null; this.mask = null;
        this.paused = false;
    }

    // ---- spotlight ---------------------------------------------------------

    /** Ring, bubble follow the target; re-laid out only when its box moved. */
    private layoutTarget(showing: boolean): void {
        const t = this.target!, box = this.box(t.node);
        for (const node of this.parts) if (node !== this.mask?.node && node !== this.hand?.sprite.node) node.active = showing;
        if (!box) return;
        const key = [box.x, box.y, box.width, box.height].map(Math.round).join(',');
        if (key === t.key) return;
        t.key = key;
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
        if (this.ring) { this.ring.setPosition(cx, cy, 0); this.ring.getComponent(UITransform)!.setContentSize(box.width + 2 * RING_PAD, box.height + 2 * RING_PAD); }
        // The bubble is rebuilt in place; it belongs to this target only.
        this.parts = this.parts.filter(n => { if (/^Guide(Text|Bubble|Tail)$/.test(n.name)) { n.destroy(); return false; } return true; });
        const text = this.text(t.rowId);
        if (t.side === 'left') {
            const w = Math.min(600, measure(text, 36)) + 2 * TEXT_PAD.x;
            this.say(text, new Vec3(box.x - RING_PAD - 16 - w / 2, cy, 0), true, false);
        } else {
            const half = this.layer.getComponent(UITransform)!.width / 2 - 200;
            this.say(text, new Vec3(Math.max(-half, Math.min(half, cx)), box.y + box.height + BUBBLE_GAP, 0), true);
        }
        for (const node of this.parts) if (node !== this.mask?.node && node !== this.hand?.sprite.node) node.active = showing;
    }
    private targetHoles(): Hole[] | null {
        const box = this.box(this.target!.node);
        return box ? [{ box: { x: box.x - DIM.holePad, y: box.y - DIM.holePad, width: box.width + 2 * DIM.holePad, height: box.height + 2 * DIM.holePad } }] : null;
    }
    private tapPoint(target: Node): Point | null {
        const box = this.box(target);
        return box && { x: box.x + box.width * 0.65, y: box.y + box.height * 0.35 };
    }
    /** Target box in guide-layer space, or null while it is hidden. */
    private box(node: Node): { x: number; y: number; width: number; height: number } | null {
        if (!node.isValid || !node.activeInHierarchy) return null;
        const b = node.getComponent(UITransform)!.getBoundingBoxToWorld(), a = this.local({ x: b.x, y: b.y })!, c = this.local({ x: b.x + b.width, y: b.y + b.height })!;
        return { x: a.x, y: a.y, width: c.x - a.x, height: c.y - a.y };
    }
    private inDialog(node: Node): boolean {
        for (let n: Node | null = node; n; n = n.parent) if (n === this.dialogLayer) return true;
        return false;
    }

    /** Full-screen dim with holes: an inverted stencil mask whose Graphics draws the holes. */
    private ensureMask(): void {
        if (this.mask) return;
        const node = this.make('GuideMask', 10, 10);
        node.setSiblingIndex(0);
        const holes = node.addComponent(Graphics);
        const mask = node.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_STENCIL;
        mask.inverted = true;
        const size = view.getVisibleSize(), dim = new Node('Dim');
        dim.layer = this.layer.layer; dim.parent = node;
        dim.addComponent(UITransform).setContentSize(size.width * 1.5, size.height * 1.5);
        this.mask = { node, holes, dim: dim.addComponent(Graphics), alpha: -1, key: '' };
        this.paintDim(0);
    }
    /** Graphics ignores UIOpacity, so the fade is the fill colour's own alpha. */
    private paintDim(alpha: number): void {
        const m = this.mask!, a = Math.round(alpha);
        if (a === m.alpha) return;
        m.alpha = a;
        const size = view.getVisibleSize(), g = m.dim;
        g.clear();
        if (!a) return;
        g.fillColor = new Color(0, 0, 0, a);
        g.rect(-size.width * 0.75, -size.height * 0.75, size.width * 1.5, size.height * 1.5);
        g.fill();
    }
    private drawHoles(holes: Hole[]): void {
        const m = this.mask!;
        const key = holes.map(h => 'box' in h ? [h.box.x, h.box.y, h.box.width, h.box.height].map(Math.round).join(',') : h.hexes.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(';') + '/' + Math.round(h.radius)).join('|');
        if (key === m.key) return;
        m.key = key;
        const g = m.holes;
        g.clear();
        for (const hole of holes) {
            if ('box' in hole) g.roundRect(hole.box.x, hole.box.y, hole.box.width, hole.box.height, DIM.holeRadius);
            else for (const c of hole.hexes) {
                const p = this.local(c)!, r = hole.radius * DIM.hexScale;
                for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
                g.close();
            }
            g.fill();
        }
    }

    // ---- pieces --------------------------------------------------------------

    /** Text with its background: guide bubble + tail, or toast capsule; outlined text until delivered. */
    private say(text: string, at: Vec3, guide: boolean, tail = true): Label {
        const art = guide ? ART.bubble : ART.toast, framed = this.nav.hasFrame(art);
        const background = framed ? this.sprite(guide ? 'GuideBubble' : 'Toast', art, 10, 10, true) : null;
        const node = this.make('GuideText', 600, 60);
        node.setPosition(at);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = 36; label.lineHeight = 44; label.isBold = true;
        label.overflow = Label.Overflow.RESIZE_HEIGHT;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        if (background) {
            label.color = guide ? new Color(91, 58, 22, 255) : new Color(255, 255, 255, 255);
            label.updateRenderData(true);
            const h = node.getComponent(UITransform)!.height + 2 * TEXT_PAD.y, w = Math.min(600, measure(text, 36)) + 2 * TEXT_PAD.x;
            background.node.getComponent(UITransform)!.setContentSize(w, h);
            background.node.setPosition(at);
            if (guide && tail && this.nav.hasFrame(ART.tail)) this.sprite('GuideTail', ART.tail, TAIL.width, TAIL.height, false).node.setPosition(at.x, at.y - h / 2 - TAIL.height / 2 + TAIL.overlap, 0);
        } else {
            label.color = new Color(255, 255, 255, 255);
            label.enableOutline = true; label.outlineColor = new Color(96, 52, 12, 255); label.outlineWidth = 4;
        }
        this.bubble = label;
        return label;
    }
    private makeHand(loop: HandLoop): void {
        const sprite = this.sprite('GuideHand', ART.hand, HAND.width, HAND.height, false);
        sprite.node.getComponent(UITransform)!.setAnchorPoint(HAND.tipX, 1 - HAND.tipY);
        sprite.node.active = false;
        this.hand = { sprite, opacity: sprite.node.addComponent(UIOpacity), loop, pressed: null };
    }
    private sprite(name: string, assetId: string, w: number, h: number, sliced: boolean): Sprite {
        const sprite = this.make(name, w, h).addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        if (sliced) sprite.type = Sprite.Type.SLICED;
        this.frame(sprite, assetId);
        return sprite;
    }
    private frame(sprite: Sprite, assetId: string): void {
        this.nav.loadFrame(assetId).then((f: SpriteFrame) => { if (sprite.isValid) sprite.spriteFrame = f; }, error => console.error(error));
    }
    private make(name: string, w: number, h: number): Node {
        const node = new Node(name);
        node.layer = this.layer.layer;
        node.parent = this.layer;
        node.addComponent(UITransform).setContentSize(w, h);
        this.parts.push(node);
        return node;
    }
    private local(world: Point | null): Point | null {
        if (!world) return null;
        const p = this.layer.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(world.x, world.y, 0));
        return { x: p.x, y: p.y };
    }
}

/** Rough single-line width of CJK-heavy text, enough to size a background. */
function measure(text: string, size: number): number {
    let w = 0;
    for (const ch of text) w += ch.charCodeAt(0) > 255 ? size : size * 0.55;
    return w;
}
