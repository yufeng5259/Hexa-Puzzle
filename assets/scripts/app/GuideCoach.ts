import { Color, Label, Node, Sprite, SpriteFrame, Tween, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import type { Game } from '../core/Game';
import { guideStep, type GuideStep } from '../core/Guide';
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
/** Fingertip position inside the 140×200 hand canvas (manifest anchor, top-left origin). */
const HAND = { width: 140, height: 200, tipX: 0.18, tipY: 0.06 };
const BUBBLE_GAP = 64;
const PULSE = 1.08;
const RING_PAD = 18;
const TEXT_PAD = { x: 36, y: 22 };

export interface HandMotion { sourceHold?: number; pressDuration?: number; dragDuration?: number; destinationHold?: number; fadeDuration?: number; loopDelay?: number }

/**
 * First-run guide pointer on the scene's guide layer. Where the player is in the
 * guide always comes from core/Guide (real clear, build and claim records), so a
 * restart resumes at the right step. Feature pages ask allows() before acting.
 */
export class GuideCoach {
    private pulsing: { node: Node; scale: Vec3 } | null = null;
    /** Everything this coach created on the guide layer; cleared together. */
    private parts: Node[] = [];
    private bubble: Label | null = null;
    private target: Node | null = null;
    private flashTimer: ReturnType<typeof setTimeout> | null = null;

    public constructor(private readonly game: Game, private readonly layer: Node, private readonly nav: Navigator) {}

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

    /** Points at a node: ring (or pulse), tapping hand when delivered, and a text bubble above it. */
    public point(target: Node, rowId: string): void {
        if (this.target === target && this.bubble?.isValid) return;
        this.clear();
        const ui = target.getComponent(UITransform);
        if (!ui || !this.layer.isValid) return;
        this.target = target;
        const center = this.local(ui.convertToWorldSpaceAR(new Vec3((0.5 - ui.anchorX) * ui.width, (0.5 - ui.anchorY) * ui.height, 0)));
        if (this.nav.hasFrame(ART.ring)) {
            const ring = this.sprite('GuideRing', ART.ring, ui.width + 2 * RING_PAD, ui.height + 2 * RING_PAD, true);
            ring.node.setPosition(center);
            tween(ring.node).repeatForever(tween(ring.node).to(0.45, { scale: new Vec3(PULSE, PULSE, 1) }).to(0.45, { scale: new Vec3(1, 1, 1) })).start();
        } else {
            this.pulsing = { node: target, scale: target.scale.clone() };
            const s = this.pulsing.scale;
            tween(target).repeatForever(tween(target).to(0.45, { scale: new Vec3(s.x * PULSE, s.y * PULSE, s.z) }).to(0.45, { scale: s })).start();
        }
        if (this.nav.hasFrame(ART.hand)) this.tapHand(new Vec3(center.x + ui.width * 0.15, center.y - ui.height * 0.15, 0));
        const top = this.local(ui.convertToWorldSpaceAR(new Vec3(0, ui.height * (1 - ui.anchorY) + BUBBLE_GAP, 0)));
        const half = this.layer.getComponent(UITransform)!.width / 2 - 200;
        this.say(this.text(rowId), new Vec3(Math.max(-half, Math.min(half, top.x)), top.y, 0), true);
    }

    /**
     * Teaching drag: the hand presses on the piece, slides to the target and lifts, on a loop.
     * Positions are world points. Without hand art the board's own target pulse is the cue.
     */
    public drag(from: Vec3, to: Vec3, motion: HandMotion = {}): void {
        this.clearHand();
        if (!this.nav.hasFrame(ART.hand) || !this.layer.isValid) return;
        const a = this.local(from), b = this.local(to);
        const hand = this.hand(a), opacity = hand.node.addComponent(UIOpacity);
        const m = { sourceHold: 0.25, pressDuration: 0.15, dragDuration: 0.9, destinationHold: 0.2, fadeDuration: 0.2, loopDelay: 0.25, ...motion };
        const down = this.nav.hasFrame(ART.handPressed) ? ART.handPressed : ART.hand;
        tween(hand.node).repeatForever(tween(hand.node)
            .call(() => { hand.node.setPosition(a); opacity.opacity = 255; this.frame(hand, ART.hand); })
            .delay(m.sourceHold).call(() => this.frame(hand, down)).delay(m.pressDuration)
            .to(m.dragDuration, { position: b }, { easing: 'sineInOut' })
            .delay(m.destinationHold).call(() => { this.frame(hand, ART.hand); tween(opacity).to(m.fadeDuration, { opacity: 0 }).start(); })
            .delay(m.fadeDuration + m.loopDelay)).start();
    }
    public clearHand(): void {
        this.parts = this.parts.filter(node => {
            if (node.name !== 'GuideHand') return node.isValid;
            this.destroy(node);
            return false;
        });
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
        this.parts.forEach(node => this.destroy(node));
        this.parts = [];
        this.bubble = null; this.target = null;
    }

    /** Text with its background: guide bubble + tail, or toast capsule; outlined text until delivered. */
    private say(text: string, at: Vec3, guide: boolean): Label {
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
            if (guide && this.nav.hasFrame(ART.tail)) this.sprite('GuideTail', ART.tail, 40, 28, false).node.setPosition(at.x, at.y - h / 2 - 12, 0);
        } else {
            label.color = new Color(255, 255, 255, 255);
            label.enableOutline = true; label.outlineColor = new Color(96, 52, 12, 255); label.outlineWidth = 4;
        }
        this.bubble = label;
        return label;
    }

    private tapHand(at: Vec3): void {
        const hand = this.hand(at), down = this.nav.hasFrame(ART.handPressed) ? ART.handPressed : ART.hand;
        tween(hand.node).repeatForever(tween(hand.node)
            .call(() => this.frame(hand, ART.hand)).to(0.35, { position: new Vec3(at.x + 10, at.y - 10, 0) })
            .call(() => this.frame(hand, down)).delay(0.18)
            .call(() => this.frame(hand, ART.hand)).to(0.35, { position: at }).delay(0.2)).start();
    }
    /** Hand sprite whose fingertip sits on the given layer point. */
    private hand(tip: Vec3): Sprite {
        const sprite = this.sprite('GuideHand', ART.hand, HAND.width, HAND.height, false);
        sprite.node.getComponent(UITransform)!.setAnchorPoint(HAND.tipX, 1 - HAND.tipY);
        sprite.node.setPosition(tip);
        return sprite;
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
    private destroy(node: Node): void {
        Tween.stopAllByTarget(node);
        const opacity = node.isValid ? node.getComponent(UIOpacity) : null;
        if (opacity) Tween.stopAllByTarget(opacity);
        if (node.isValid) node.destroy();
    }
    private local(world: Vec3): Vec3 { return this.layer.getComponent(UITransform)!.convertToNodeSpaceAR(world); }
}

/** Rough single-line width of CJK-heavy text, enough to size a background. */
function measure(text: string, size: number): number {
    let w = 0;
    for (const ch of text) w += ch.charCodeAt(0) > 255 ? size : size * 0.55;
    return w;
}
