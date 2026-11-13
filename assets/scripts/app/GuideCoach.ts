import { Color, Label, Node, Tween, tween, UITransform, Vec3 } from 'cc';
import type { Game } from '../core/Game';
import { guideStep, type GuideStep } from '../core/Guide';

/** Guide copy keyed by GuideSteps.textKey. */
const TEXT: Record<string, string> = {
    'guide.drag': '按住拼块，拖到发光的位置',
    'guide.home': '金币到手啦，回家建造吧',
    'guide.build': '点这里进入建造',
    'guide.upgrade': '花金币升级这座建筑',
    'guide.construct': '施工中…',
    'guide.welcome': '领取欢迎礼物',
};
const BUBBLE_GAP = 64;
const PULSE = 1.08;

/**
 * First-run guide pointer on the scene's guide layer. Where the player is in the
 * guide always comes from core/Guide (real clear, build and claim records), so a
 * restart resumes at the right step. Feature pages ask allows() before acting.
 * Placeholder look: a pulsing target and a text bubble (no hand art delivered yet).
 */
export class GuideCoach {
    private pulsing: { node: Node; scale: Vec3 } | null = null;
    private bubble: Label | null = null;

    public constructor(private readonly game: Game, private readonly layer: Node) {}

    public get step(): GuideStep { return guideStep(this.game.state, this.game.rules); }
    public get active(): boolean { return this.step !== 'done'; }
    public row(id: string) { return this.game.config.guide.find(r => r.id === id) ?? null; }

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

    /** Points at a node with the text of a GuideSteps row; replaces any previous pointer. */
    public point(target: Node, rowId: string): void {
        if (this.pulsing?.node === target && this.bubble?.isValid) return;
        this.clear();
        const ui = target.getComponent(UITransform);
        if (!ui || !this.layer.isValid) return;
        this.pulsing = { node: target, scale: target.scale.clone() };
        const s = this.pulsing.scale;
        tween(target).repeatForever(tween(target).to(0.45, { scale: new Vec3(s.x * PULSE, s.y * PULSE, s.z) }).to(0.45, { scale: s })).start();
        const label = this.label(TEXT[this.row(rowId)?.textKey ?? ''] ?? '');
        const world = ui.convertToWorldSpaceAR(new Vec3(0, ui.height * (1 - ui.anchorY) + BUBBLE_GAP, 0));
        const local = this.layer.getComponent(UITransform)!.convertToNodeSpaceAR(world);
        const half = this.layer.getComponent(UITransform)!.width / 2 - 200;
        label.node.setPosition(Math.max(-half, Math.min(half, local.x)), local.y, 0);
    }
    /** A text-only hint (e.g. while the guide waits for construction). */
    public say(rowId: string): void {
        this.clear();
        this.label(TEXT[this.row(rowId)?.textKey ?? ''] ?? '').node.setPosition(0, 0, 0);
    }
    /** A short notice (help text, locked entry) that disappears by itself. */
    public flash(text: string, seconds = 2.5): void {
        this.clear();
        const label = this.label(text);
        label.node.setPosition(0, 0, 0);
        setTimeout(() => { if (this.bubble === label) this.clear(); }, seconds * 1000);
    }
    public text(rowId: string): string { return TEXT[this.row(rowId)?.textKey ?? ''] ?? ''; }

    public clear(): void {
        if (this.pulsing) {
            Tween.stopAllByTarget(this.pulsing.node);
            if (this.pulsing.node.isValid) this.pulsing.node.setScale(this.pulsing.scale);
            this.pulsing = null;
        }
        if (this.bubble?.isValid) this.bubble.node.destroy();
        this.bubble = null;
    }

    private label(text: string): Label {
        const node = new Node('GuideBubble');
        node.layer = this.layer.layer;
        node.parent = this.layer;
        node.addComponent(UITransform).setContentSize(640, 60);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = 36;
        label.lineHeight = 44;
        label.overflow = Label.Overflow.RESIZE_HEIGHT;
        label.isBold = true;
        label.color = new Color(255, 255, 255, 255);
        label.enableOutline = true;
        label.outlineColor = new Color(96, 52, 12, 255);
        label.outlineWidth = 4;
        this.bubble = label;
        return label;
    }
}
