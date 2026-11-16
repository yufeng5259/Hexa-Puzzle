import { Color, game as engine, Game as Engine, Label, LabelOutline, Node, Sprite, SpriteFrame, UIOpacity, UITransform, Vec3 } from 'cc';
import {
    badgeScale, boardDim, burstFrame, clearProgress, confetti, confettoPose, floatPose, floatText, ghostAlpha, ghostScale,
    hammerPose, lineGlow, planHammer, planPlace, planResult, planSwap, popIn, pulse, rolledScore, scoreArrived, scorePulse, settleScale, shatter, slideIn, swapOut,
    type EndlessTimings, type PlaceInput, type ResultInput, type ResultPlan,
} from './EndlessTimeline';

/** Pictures the effects use; any of them may be missing (the timing still runs, that picture is just not drawn). */
export interface EndlessArt {
    readonly glow: SpriteFrame | null;
    readonly burst: readonly SpriteFrame[];
    readonly confetti: readonly SpriteFrame[];
    readonly hammer: SpriteFrame | null;
}
export interface BoardCell { readonly base: Sprite; readonly overlay: Sprite }

/** The S20 parts one placement animates. Cues switch the page from the pre-placement copy to the saved state. */
export interface PlaceShow extends PlaceInput {
    readonly cells: ReadonlyMap<string, BoardCell>;
    /** Board mount (cell parent) and the page root the "+score" floats in. */
    readonly mount: Node;
    readonly root: Node;
    readonly placed: readonly string[];
    readonly lineCount: number;
    readonly scoreNode: Node | null;
    /** The saved board shows (cleared cells empty). */
    readonly onClear: () => void;
    /** The saved tray shows; returns the slot nodes to slide in. */
    readonly onRefill: () => readonly (Node | null)[];
    /** The saved score shows. */
    readonly onScore: () => void;
}
/** "换一手": the old tray pieces shrink out, then the saved tray shows and its dealt slots pop in. */
export interface SwapShow {
    readonly slots: readonly number[];
    readonly old: readonly (Node | null)[];
    /** The saved tray shows; returns the slot nodes. */
    readonly onSwap: () => readonly (Node | null)[];
}
/** "单格锤": the hammer drops on the cell; at the hit the saved board shows and the old cell shatters. */
export interface HammerShow {
    readonly cell: BoardCell;
    readonly mount: Node;
    readonly onHit: () => void;
}
export interface ResultShow extends ResultInput {
    readonly scoreLabel: Label;
    readonly badge: readonly Node[];
    readonly notice: Node | null;
    /** Confetti parent (the dialog). */
    readonly layer: Node;
}

const CONFETTI = 10, CONFETTO = 26;
const FLOAT = { size: 46, color: new Color(255, 226, 92, 255), outline: new Color(122, 66, 10, 255) };
const DIM = 0.42;
/** fx_build_hammer is 133×105. */
const HAMMER_ASPECT = 105 / 133;

interface Cue { at: number; fn: () => void; fired: boolean }
interface Running { at: number; end: number; input: number; draw: (at: number) => void; cues: Cue[]; restore: () => void; done: () => void }

/**
 * Endless board effects (docs/v2/09 §7.1, §8). Shows only what a placement already saved:
 * the page keeps a copy of the board from before the move on screen, and this player's cues
 * switch it to the saved board, tray and score at the right moments. One effect at a time; a
 * new one, stop(), the app going to the background or the board going away fire every
 * remaining cue at once and leave the stable saved state on screen.
 */
export class EndlessFx {
    private current: Running | null = null;

    public constructor(private readonly t: EndlessTimings, private readonly art: () => EndlessArt) {
        engine.on(Engine.EVENT_HIDE, this.stop, this);
    }
    public get busy(): boolean { return !!this.current; }
    /** Dragging waits for this (the end of a "+score" float does not hold it). */
    public get locked(): boolean { return !!this.current && this.current.at < this.current.input; }
    public get elapsed(): number { return this.current?.at ?? 0; }

    /** One saved placement; resolves when the board has settled. */
    public place(show: PlaceShow): Promise<void> {
        this.stop();
        const plan = planPlace(show, this.t), art = this.art(), temp: Node[] = [];
        const placed = show.placed.map(k => show.cells.get(k)?.base.node).filter((n): n is Node => !!n?.isValid);
        const clearing = plan.cells.map(c => {
            const cell = show.cells.get(c.key);
            return cell?.base.isValid ? { plan: c, cell, ghost: null as Sprite | null, burst: null as Sprite | null } : null;
        }).filter((c): c is NonNullable<typeof c> => !!c);
        const float = plan.score ? this.label(show.root, floatText(show.score, show.lineCount)) : null;
        if (float) temp.push(float.node);
        const from = float ? this.centre(show, plan.cells.length ? plan.cells.map(c => c.key) : show.placed) : null;
        let slides: { node: Node; base: Vec3; opacity: UIOpacity; start: number }[] = [];
        const cues: Cue[] = [
            {
                at: plan.highlight?.end ?? 0, fired: false, fn: () => {
                    // The old cell art lives on as a ghost while the saved (empty) cell shows below it.
                    for (const c of clearing) {
                        c.ghost = this.cellSprite(show.mount, c.cell.base, c.cell.base.spriteFrame);
                        c.burst = art.burst.length ? this.cellSprite(show.mount, c.cell.base, null) : null;
                        temp.push(c.ghost.node); if (c.burst) temp.push(c.burst.node);
                    }
                    show.onClear();
                },
            },
            {
                at: plan.clearEnd, fired: false, fn: () => {
                    const nodes = show.onRefill();
                    slides = plan.refill.map(r => {
                        const node = nodes[r.slot];
                        if (!node?.isValid) return null;
                        return { node, base: node.position.clone(), opacity: node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity), start: r.start };
                    }).filter((s): s is NonNullable<typeof s> => !!s);
                },
            },
            { at: plan.score?.end ?? 0, fired: false, fn: () => show.onScore() },
        ];
        const scoreBase = show.scoreNode?.isValid ? show.scoreNode.scale.clone() : null;
        return this.run(plan.end, plan.inputEnd, cues, at => {
            const s = settleScale(plan, at);
            for (const n of placed) if (n.isValid) n.setScale(s, s, 1);
            for (const c of clearing) {
                const glow = lineGlow(c.plan, plan, at), k = clearProgress(c.plan, plan, at), overlay = c.cell.overlay;
                if (overlay.isValid && art.glow) {
                    overlay.node.active = glow > 0.01;
                    if (overlay.spriteFrame !== art.glow) overlay.spriteFrame = art.glow;
                    overlay.color = new Color(255, 255, 255, Math.round(255 * Math.min(1, glow)));
                }
                if (c.ghost?.isValid) {
                    const g = ghostScale(k);
                    c.ghost.node.setScale(g, g, 1);
                    c.ghost.color = new Color(255, 255, 255, Math.round(255 * ghostAlpha(k)));
                }
                if (c.burst?.isValid) {
                    const f = burstFrame(k);
                    c.burst.node.active = f >= 0;
                    if (f >= 0) c.burst.spriteFrame = art.burst[Math.min(f, art.burst.length - 1)];
                }
            }
            for (const sl of slides) if (sl.node.isValid) {
                const p = slideIn(sl.start, plan, at);
                sl.node.setPosition(sl.base.x, sl.base.y + p.dy, sl.base.z);
                sl.opacity.opacity = Math.round(255 * p.alpha);
            }
            if (float?.isValid && from) {
                const pose = floatPose(plan, at);
                float.node.active = !!pose;
                if (pose) { float.node.setPosition(from.x, from.y + pose.dy, 0); float.color = alpha(FLOAT.color, pose.alpha); }
            }
            if (scoreBase && show.scoreNode?.isValid && scoreArrived(plan, at)) {
                const p = scorePulse(plan, at);
                show.scoreNode.setScale(scoreBase.x * p, scoreBase.y * p, scoreBase.z);
            }
        }, () => {
            for (const n of placed) if (n.isValid) n.setScale(1, 1, 1);
            for (const c of clearing) if (c.cell.overlay.isValid) { c.cell.overlay.node.active = false; c.cell.overlay.color = Color.WHITE; }
            for (const sl of slides) if (sl.node.isValid) { sl.node.setPosition(sl.base); sl.opacity.opacity = 255; }
            if (scoreBase && show.scoreNode?.isValid) show.scoreNode.setScale(scoreBase);
            for (const n of temp) if (n.isValid) n.destroy();
        });
    }

    /** One saved swap; resolves when the new tray has settled. Input waits for the whole show. */
    public swap(show: SwapShow): Promise<void> {
        this.stop();
        const plan = planSwap(show.slots, this.t);
        const old = show.slots.map(i => show.old[i]).filter((n): n is Node => !!n?.isValid)
            .map(node => ({ node, base: node.scale.clone(), opacity: node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity) }));
        let fresh: { node: Node; base: Vec3; start: number }[] = [];
        const cues: Cue[] = [{
            at: plan.outEnd, fired: false, fn: () => {
                const nodes = show.onSwap();
                fresh = plan.slots.map(s => {
                    const node = nodes[s.slot];
                    return node?.isValid ? { node, base: node.scale.clone(), start: s.start } : null;
                }).filter((x): x is NonNullable<typeof x> => !!x);
            },
        }];
        return this.run(plan.end, plan.end, cues, at => {
            const o = swapOut(plan, at);
            for (const x of old) if (x.node.isValid) { x.node.setScale(x.base.x * o.scale, x.base.y * o.scale, x.base.z); x.opacity.opacity = Math.round(255 * o.alpha); }
            for (const x of fresh) if (x.node.isValid) { const k = popIn(x.start, plan.inSeconds, at); x.node.setScale(x.base.x * k, x.base.y * k, x.base.z); }
        }, () => { for (const x of fresh) if (x.node.isValid) x.node.setScale(x.base); });
    }

    /** One saved hammer hit; resolves when the shatter has faded. */
    public hammer(show: HammerShow): Promise<void> {
        this.stop();
        const plan = planHammer(this.t), art = this.art(), temp: Node[] = [], base = show.cell.base;
        if (!base.isValid) { show.onHit(); return Promise.resolve(); }
        const size = base.node.getComponent(UITransform)!.width, at0 = base.node.position.clone();
        const hammer = art.hammer ? this.cellSprite(show.mount, base, art.hammer) : null;
        if (hammer) { hammer.node.getComponent(UITransform)!.setContentSize(size * 1.4, size * 1.4 * HAMMER_ASPECT); temp.push(hammer.node); }
        const hit: { ghost: Sprite | null; burst: Sprite | null } = { ghost: null, burst: null };
        const cues: Cue[] = [{
            at: plan.hit, fired: false, fn: () => {
                // The old cell art lives on as a shattering ghost over the saved (empty) cell.
                hit.ghost = this.cellSprite(show.mount, base, base.spriteFrame);
                hit.burst = art.burst.length ? this.cellSprite(show.mount, base, null) : null;
                temp.push(hit.ghost.node); if (hit.burst) temp.push(hit.burst.node);
                if (hammer?.isValid) hammer.node.setSiblingIndex(show.mount.children.length - 1);
                show.onHit();
            },
        }];
        return this.run(plan.end, plan.end, cues, at => {
            if (hammer?.isValid) {
                const p = hammerPose(plan, at);
                hammer.node.setPosition(at0.x + size * 0.35, at0.y + size * 0.35 + p.dy, 0);
                hammer.node.angle = p.angle;
                hammer.color = alpha(Color.WHITE, p.alpha);
            }
            const k = shatter(plan, at);
            if (hit.ghost?.isValid) { hit.ghost.node.setScale(1 + 0.3 * k, 1 + 0.3 * k, 1); hit.ghost.color = alpha(Color.WHITE, 1 - k); }
            if (hit.burst?.isValid) {
                const f = burstFrame(k);
                hit.burst.node.active = f >= 0;
                if (f >= 0) hit.burst.spriteFrame = art.burst[Math.min(f, art.burst.length - 1)];
            }
        }, () => { for (const n of temp) if (n.isValid) n.destroy(); });
    }

    /** Before S21: an ended game's board and tray dim (and stay dim); an abandoned one fades out. */
    public board(nodes: readonly Node[], cells: Iterable<BoardCell>, input: ResultInput): Promise<void> {
        this.stop();
        const plan = planResult(input, this.t), sprites = [...cells].map(c => c.base);
        const opacity = nodes.filter(n => n.isValid).map(n => n.getComponent(UIOpacity) ?? n.addComponent(UIOpacity));
        const draw = (at: number) => {
            const d = boardDim(plan, at);
            if (input.abandoned) { for (const o of opacity) if (o.isValid) o.opacity = Math.round(255 * (1 - d)); return; }
            const v = Math.round(255 * (1 - DIM * d));
            for (const s of sprites) if (s.isValid) s.color = new Color(v, v, v, 255);
        };
        return this.run(plan.board, plan.board, [], draw, () => draw(Infinity));
    }

    /** S21 after its pop-in started: score roll, record badge with confetti, stage notice pulse. */
    public result(show: ResultShow): Promise<void> {
        this.stop();
        const plan: ResultPlan = planResult(show, this.t), art = this.art(), temp: Node[] = [];
        const badges = show.badge.filter(n => n.isValid).map(n => ({ node: n, base: n.scale.clone() }));
        const centre = badges[0] ? show.layer.getComponent(UITransform)!.convertToNodeSpaceAR(badges[0].node.worldPosition) : null;
        const pieces = plan.badge && centre && art.confetti.length ? confetti(CONFETTI).map(c => {
            const s = this.free(show.layer, art.confetti[c.frame % art.confetti.length], CONFETTO);
            temp.push(s.node);
            return { c, s };
        }) : [];
        const notice = show.notice?.isValid ? { node: show.notice, base: show.notice.scale.clone() } : null;
        const draw = (at: number) => {
            if (show.scoreLabel.isValid) show.scoreLabel.string = rolledScore(plan, show.score, at).toLocaleString('en-US');
            const b = badgeScale(plan, at);
            for (const x of badges) if (x.node.isValid) { x.node.active = b > 0; x.node.setScale(x.base.x * b, x.base.y * b, x.base.z); }
            if (plan.badge && centre) {
                const k = (at - plan.badge.start) / (plan.badge.end - plan.badge.start);
                for (const p of pieces) if (p.s.isValid) {
                    const pose = confettoPose(p.c, k);
                    p.s.node.active = k > 0 && pose.alpha > 0;
                    p.s.node.setPosition(centre.x + pose.x, centre.y + pose.y, 0);
                    p.s.node.angle = pose.angle;
                    p.s.color = alpha(Color.WHITE, pose.alpha);
                }
            }
            if (notice?.node.isValid && plan.notice) { const p = pulse(at - plan.notice.start); notice.node.setScale(notice.base.x * p, notice.base.y * p, notice.base.z); }
        };
        return this.run(plan.end, plan.end, [], draw, () => {
            draw(Infinity);
            for (const x of badges) if (x.node.isValid) { x.node.active = !!plan.badge; x.node.setScale(x.base); }
            if (notice?.node.isValid) notice.node.setScale(notice.base);
            for (const n of temp) if (n.isValid) n.destroy();
        });
    }

    /** Ends the running effect at its stable state; every remaining cue fires, its promise resolves. */
    public stop(): void {
        const r = this.current;
        if (!r) return;
        this.current = null;
        for (const cue of r.cues) this.fire(cue);
        try { r.restore(); } catch (error) { console.error(error); }
        r.done();
    }
    public dispose(): void { this.stop(); engine.off(Engine.EVENT_HIDE, this.stop, this); }

    /** Called every frame by the endless page. */
    public update(dt: number): void {
        const r = this.current;
        if (!r) return;
        r.at += Math.max(0, dt);
        for (const cue of r.cues) if (!cue.fired && r.at >= cue.at) this.fire(cue);
        if (this.current !== r) return; // a cue ended it
        if (r.at >= r.end) { this.stop(); return; }
        try { r.draw(r.at); } catch (error) { console.error(error); this.stop(); }
    }

    private run(end: number, input: number, cues: Cue[], draw: (at: number) => void, restore: () => void): Promise<void> {
        return new Promise(done => {
            const r: Running = { at: 0, end, input, draw, cues, restore, done };
            this.current = r;
            for (const cue of cues) if (cue.at <= 0) this.fire(cue);
            if (end <= 0) this.stop(); else if (this.current === r) draw(0);
        });
    }
    private fire(cue: Cue): void {
        if (cue.fired) return;
        cue.fired = true;
        try { cue.fn(); } catch (error) { console.error(error); }
    }

    /** A sprite over a board cell (same size and place), last among the mount's children. */
    private cellSprite(mount: Node, base: Sprite, frame: SpriteFrame | null): Sprite {
        const ui = base.node.getComponent(UITransform)!, node = new Node('EndlessFx');
        node.layer = mount.layer; node.parent = mount;
        node.addComponent(UITransform).setContentSize(ui.width, ui.height);
        node.setPosition(base.node.position);
        const s = node.addComponent(Sprite);
        s.sizeMode = Sprite.SizeMode.CUSTOM;
        s.spriteFrame = frame;
        return s;
    }
    private free(parent: Node, frame: SpriteFrame, size: number): Sprite {
        const node = new Node('confetto');
        node.layer = parent.layer; node.parent = parent; node.active = false;
        node.addComponent(UITransform).setContentSize(size, size);
        const s = node.addComponent(Sprite);
        s.sizeMode = Sprite.SizeMode.CUSTOM; s.spriteFrame = frame;
        return s;
    }
    private label(parent: Node, text: string): Label {
        const node = new Node('EndlessScoreFloat');
        node.layer = parent.layer; node.parent = parent; node.active = false;
        node.addComponent(UITransform).setContentSize(420, 70);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = label.lineHeight = FLOAT.size;
        label.isBold = true;
        label.color = FLOAT.color;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        const outline = node.addComponent(LabelOutline);
        outline.color = FLOAT.outline; outline.width = 4;
        return label;
    }
    /** Centre of the given cells in the page root's space. */
    private centre(show: PlaceShow, keys: readonly string[]): Vec3 {
        const root = show.root.getComponent(UITransform)!, sum = new Vec3();
        let n = 0;
        for (const k of keys) {
            const node = show.cells.get(k)?.base.node;
            if (!node?.isValid) continue;
            Vec3.add(sum, sum, root.convertToNodeSpaceAR(node.worldPosition)); n++;
        }
        return n ? sum.multiplyScalar(1 / n) : sum;
    }
}

function alpha(c: Color, a: number): Color { return new Color(c.r, c.g, c.b, Math.round(Math.max(0, Math.min(1, a)) * 255)); }
