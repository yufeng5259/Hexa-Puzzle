import { BlockInputEvents, Color, game as engine, Game as Engine, Label, Node, Sprite, SpriteFrame, UIOpacity, UITransform, Vec3, view } from 'cc';
import type { Reward } from '../../core/Rules';
import { dialogScale } from '../ui/FitMath';
import { ScreenFit } from '../ui/ScreenFit';
import {
    cardScale, chestIntro, planReward, pulseScale, REWARD_FADE, rewardItems, RewardRun, rolledValue,
    type ArrivalPlan, type EndReason, type ParticlePlan, type RewardKind, type RewardTimings,
} from './RewardTimeline';

/** A visible HUD element a reward kind flies to; its label rolls to the real value. */
export interface RewardTarget {
    readonly node: Node;
    readonly label?: Label | null;
    /** The value the HUD shows now (saved value minus rewards still waiting to be shown); the show rolls it up by its amount. */
    readonly value: () => number;
    readonly format?: (value: number) => string;
}
export interface RewardShow {
    /** The saved reward of one transaction (or one merged display). */
    readonly reward: Reward;
    /** The view the show belongs to; it ends at once when that view is hidden or destroyed. */
    readonly owner: Node;
    /** Generated cards pop up above this node. */
    readonly from: Node;
    /** Reward elements a dialog already shows; they pop in place of a generated card. */
    readonly sources?: Partial<Record<RewardKind, Node>>;
    readonly targets: (kind: RewardKind) => RewardTarget | null;
    /** Daily chest: shakes, switches to its open picture (open()) with a glow, then the cards come out. */
    readonly chest?: { readonly node: Node; readonly open: () => void };
    /** false: taps do not fast-forward (the first guided win plays once in full). */
    readonly skippable?: boolean;
    /** Also told about every tap on the show (the puzzle win fast-forwards its own timeline too). */
    readonly onTap?: () => void;
}

const ICON: Record<RewardKind, string> = { coins: 'UI/图标/icon_coin.png', energy: 'UI/图标/icon_energy.png', hints: 'UI/图标/icon_hint.png' };
const PARTICLE: Record<RewardKind, string> = { coins: 'UI/特效/fx_coin_fly.png', energy: ICON.energy, hints: ICON.hints };
const ART = { card: 'UI/HUD/hud_capsule_light.png', check: 'UI/通用/mark_check.png', glow: 'UI/特效/fx_glow_burst.png' };
const CARD = { width: 176, height: 72, gap: 16, lift: 110, icon: 56, particle: 44, check: 40, margin: 12 };
const TEXT = new Color(0x6b, 0x3f, 0x12, 255);
/** Scatter radius around the card and the height of the flight arc (design units). */
const SPREAD = { min: 24, max: 60 }, ARC = 140;
const CHEST = { angle: 5, grow: 0.05, glow: 460 };

interface Card { node: Node; base: Vec3 | null; at: Vec3; check: Node | null }
interface Flight { node: Node; plan: ParticlePlan; from: Vec3; spread: Vec3; to: Vec3 }
interface Hit { arrival: ArrivalPlan; target: RewardTarget; base: Vec3; from: number; to: number }
interface Running {
    show: RewardShow; root: Node; run: RewardRun | null;
    cards: Card[]; flights: Flight[]; hits: Hit[];
    chest: { base: Vec3; angle: number; glow: Node | null; opened: boolean; settled: boolean } | null;
    done: () => void;
}

/**
 * Reward player on the effects layer (above dialogs, below the page transition). It only
 * presents a reward that is already saved: cards pop, particles fly to the visible HUD target
 * of each kind (kinds without one keep their card, ticked), the target pulses once and its value
 * rolls. A tap after skipAfter, the timeout, the app going to the background or the owner view
 * going away all end it at once with every value back on the real one. One show at a time.
 */
export class RewardFx {
    private current: Running | null = null;

    public constructor(private readonly layer: Node, private readonly frame: (id: string) => Promise<SpriteFrame>, private readonly t: RewardTimings) {
        engine.on(Engine.EVENT_HIDE, this.settle, this);
    }

    public get busy(): boolean { return !!this.current; }
    /** A HUD label the running show is rolling; page repaints leave it alone until the show ends. */
    public holds(label: Label | null | undefined): boolean { return !!label && !!this.current?.hits.some(h => h.target.label === label); }

    /** Resolves when the show has ended for any reason; nothing to show resolves at once. */
    public play(show: RewardShow): Promise<void> {
        this.settle();
        const items = rewardItems(show.reward), targets = new Map<RewardKind, RewardTarget>();
        for (const item of items) {
            const target = show.targets(item.kind);
            if (target?.node.isValid && target.node.activeInHierarchy) targets.set(item.kind, target);
        }
        const plan = planReward(items, kind => targets.has(kind), this.t, show.chest ? chestIntro(this.t) : 0);
        return new Promise<void>(done => {
            const root = this.root();
            const r: Running = { show, root, run: null, cards: [], flights: [], hits: [], chest: null, done };
            this.current = r;
            const run = new RewardRun(plan, this.t, reason => this.finish(r, reason));
            if (run.finished) return;
            r.run = run;
            root.on(Node.EventType.TOUCH_END, () => { if (show.skippable !== false) run.skip(); show.onTap?.(); });
            this.build(r, targets);
            this.draw(r, 0);
        });
    }

    /** Ends the running show now (values aligned, decorations removed). */
    public settle(): void { this.current?.run?.cancel(); }

    /** Called every frame by GameBoot (through the Navigator). */
    public update(dt: number): void {
        const r = this.current;
        if (!r?.run) return;
        if (!r.show.owner.isValid || !r.show.owner.activeInHierarchy) { r.run.cancel(); return; }
        r.run.step(dt);
        if (!r.run.finished) this.draw(r, r.run.elapsed);
    }

    private root(): Node {
        const root = new Node('RewardShow');
        root.layer = this.layer.layer; root.parent = this.layer;
        const size = view.getVisibleSize();
        root.addComponent(UITransform).setContentSize(size.width, size.height);
        root.addComponent(BlockInputEvents); // one tap fast-forwards; nothing below acts twice meanwhile
        root.addComponent(UIOpacity);
        return root;
    }

    private build(r: Running, targets: Map<RewardKind, RewardTarget>): void {
        const { show, root } = r, plan = r.run!.plan, fit = ScreenFit.current, k = dialogScale(fit);
        if (show.chest?.node.isValid) {
            const node = show.chest.node, glow = this.sprite(root, ART.glow, CHEST.glow * k, CHEST.glow * k);
            glow.setPosition(this.local(root, node)); glow.active = false;
            r.chest = { base: node.scale.clone(), angle: node.angle, glow, opened: false, settled: false };
        }
        const generated = plan.cards.filter(c => !show.sources?.[c.item.kind]?.isValid);
        const above = this.local(root, show.from), w = (CARD.width + CARD.gap) * k;
        const half = fit.frame.width / 2 - (CARD.width / 2 + CARD.margin) * k;
        plan.cards.forEach(card => {
            const kind = card.item.kind, source = show.sources?.[kind];
            let entry: Card;
            if (source?.isValid) entry = { node: source, base: source.scale.clone(), at: this.local(root, source), check: null };
            else {
                const i = generated.indexOf(card);
                const x = Math.max(fit.frame.x - half, Math.min(fit.frame.x + half, above.x + (i - (generated.length - 1) / 2) * w));
                const at = new Vec3(x, above.y + CARD.lift * k, 0);
                entry = { node: this.card(root, kind, card.item.amount, k), base: null, at, check: null };
                entry.node.setPosition(at);
            }
            if (!card.flies) {
                // Generated cards are already sized with k; dialog elements carry their own scale.
                const ui = entry.node.getComponent(UITransform)!, s = entry.base ? Math.abs(entry.base.x) : 1;
                const dx = ui.width / 2 * s, dy = ui.height / 2 * s;
                entry.check = this.sprite(root, ART.check, CARD.check * k, CARD.check * k);
                entry.check.setPosition(entry.at.x + dx - 6 * k, entry.at.y + dy - 6 * k, 0);
                entry.check.active = false;
            }
            r.cards.push(entry);
        });
        const ends = new Map([...targets].map(([kind, target]) => [kind, this.local(root, target.node)]));
        for (const p of plan.particles) {
            const card = plan.cards[p.card], from = r.cards[p.card].at, angle = Math.random() * Math.PI * 2;
            const radius = (SPREAD.min + Math.random() * (SPREAD.max - SPREAD.min)) * k;
            const node = this.sprite(root, PARTICLE[card.item.kind], CARD.particle * k, CARD.particle * k);
            node.active = false;
            r.flights.push({ node, plan: p, from, spread: new Vec3(from.x + Math.cos(angle) * radius, from.y + Math.sin(angle) * radius, 0), to: ends.get(card.item.kind)! });
        }
        for (const arrival of plan.arrivals) {
            const target = targets.get(arrival.kind)!, amount = plan.cards.find(c => c.item.kind === arrival.kind)!.item.amount;
            const from = target.value(), hit: Hit = { arrival, target, base: target.node.scale.clone(), from, to: from + amount };
            r.hits.push(hit);
            this.show(hit, hit.from);
        }
    }

    private draw(r: Running, at: number): void {
        const plan = r.run!.plan, t = this.t;
        const chest = r.chest, node = r.show.chest?.node;
        if (chest && node?.isValid && at < plan.intro) {
            if (at < t.chestShakeSeconds) {
                const k = at / Math.max(1e-6, t.chestShakeSeconds);
                node.angle = chest.angle + CHEST.angle * Math.sin(k * Math.PI * 6);
                node.setScale(chest.base.x * (1 + CHEST.grow * k), chest.base.y * (1 + CHEST.grow * k), chest.base.z);
            } else {
                this.open(r);
                const k = (at - t.chestShakeSeconds) / Math.max(1e-6, t.chestOpenSeconds), s = 1 + CHEST.grow * (1 - k) + 0.06 * Math.sin(Math.PI * k);
                node.angle = chest.angle;
                node.setScale(chest.base.x * s, chest.base.y * s, chest.base.z);
            }
        } else if (chest && !chest.settled) { this.open(r); this.restoreChest(r); }
        if (chest?.glow?.isValid && chest.opened) {
            const g = Math.min(1, (at - t.chestShakeSeconds) / (t.chestOpenSeconds + 0.5));
            chest.glow.setScale(0.5 + 0.9 * Math.min(1, g * 1.5), 0.5 + 0.9 * Math.min(1, g * 1.5), 1);
            chest.glow.getComponent(UIOpacity)!.opacity = 255 * (1 - g);
            chest.glow.active = g < 1;
        }
        plan.cards.forEach((card, i) => {
            const c = r.cards[i], s = cardScale(card, t, at);
            if (!c.node.isValid) return;
            if (c.base) { const k = s || 1; c.node.setScale(c.base.x * k, c.base.y * k, c.base.z); }
            else { c.node.active = s > 0; c.node.setScale(s, s, 1); }
            if (c.check?.isValid) c.check.active = at >= plan.settled;
        });
        for (const f of r.flights) {
            const p = f.plan, live = at >= p.born && at < p.land;
            f.node.active = live;
            if (!live) continue;
            const scatterEnd = p.born + t.scatterSeconds;
            if (at < scatterEnd) {
                const k = 1 - Math.pow(1 - (at - p.born) / Math.max(1e-6, t.scatterSeconds), 2);
                f.node.setPosition(f.from.x + (f.spread.x - f.from.x) * k, f.from.y + (f.spread.y - f.from.y) * k, 0);
            } else {
                const raw = (at - scatterEnd) / Math.max(1e-6, p.land - scatterEnd), k = raw * raw * (3 - 2 * raw), u = 1 - k;
                // Quadratic arc: the control point sits above the middle of the path.
                const cx = (f.spread.x + f.to.x) / 2, cy = Math.max(f.spread.y, f.to.y) + ARC;
                f.node.setPosition(u * u * f.spread.x + 2 * u * k * cx + k * k * f.to.x, u * u * f.spread.y + 2 * u * k * cy + k * k * f.to.y, 0);
                const s = 1 - 0.3 * k;
                f.node.setScale(s, s, 1);
            }
        }
        for (const hit of r.hits) {
            const node = hit.target.node, s = pulseScale(hit.arrival, t, at);
            if (node.isValid) node.setScale(hit.base.x * s, hit.base.y * s, hit.base.z);
            this.show(hit, rolledValue(hit.from, hit.to, hit.arrival, at));
        }
        const fade = Math.max(0, Math.min(1, (plan.end - at) / REWARD_FADE));
        r.root.getComponent(UIOpacity)!.opacity = 255 * fade;
    }

    private finish(r: Running, _reason: EndReason): void {
        if (this.current === r) this.current = null;
        if (r.chest) { this.open(r); this.restoreChest(r); }
        r.cards.forEach(c => { if (c.base && c.node.isValid) c.node.setScale(c.base); });
        for (const hit of r.hits) {
            if (hit.target.node.isValid) hit.target.node.setScale(hit.base);
            this.show(hit, hit.to);
        }
        if (r.root.isValid) r.root.destroy();
        r.done();
    }

    private open(r: Running): void {
        const chest = r.chest;
        if (!chest || chest.opened) return;
        chest.opened = true;
        if (chest.glow?.isValid) chest.glow.active = true;
        try { r.show.chest!.open(); } catch (error) { console.error(error); }
    }
    private restoreChest(r: Running): void {
        const node = r.show.chest?.node, chest = r.chest;
        if (!node?.isValid || !chest) return;
        chest.settled = true;
        node.angle = chest.angle;
        node.setScale(chest.base);
    }
    private show(hit: Hit, value: number): void {
        const label = hit.target.label;
        if (label?.isValid) label.string = hit.target.format ? hit.target.format(value) : String(value);
    }

    /** Centre of a node in the show's space (pictures may have any anchor). */
    private local(root: Node, node: Node): Vec3 {
        const ui = node.getComponent(UITransform);
        const world = ui ? ui.convertToWorldSpaceAR(new Vec3((0.5 - ui.anchorX) * ui.width, (0.5 - ui.anchorY) * ui.height, 0)) : node.worldPosition.clone();
        return root.getComponent(UITransform)!.convertToNodeSpaceAR(world);
    }
    private card(root: Node, kind: RewardKind, amount: number, k: number): Node {
        const node = this.sprite(root, ART.card, CARD.width * k, CARD.height * k, false);
        node.getComponent(Sprite)!.type = Sprite.Type.SLICED;
        const icon = this.sprite(node, ICON[kind], CARD.icon * k, CARD.icon * k);
        icon.setPosition(-CARD.width * k / 2 + 40 * k, 0, 0);
        const text = new Node('amount');
        text.layer = node.layer; text.parent = node;
        text.addComponent(UITransform).setContentSize(100 * k, CARD.height * k);
        text.setPosition(22 * k, 0, 0);
        const label = text.addComponent(Label);
        label.string = `+${amount}`;
        label.fontSize = label.lineHeight = Math.round(36 * k);
        label.isBold = true;
        label.color = TEXT;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        return node;
    }
    /** fit: the picture keeps its proportions inside w × h (icons); otherwise it fills the box. */
    private sprite(parent: Node, assetId: string, w: number, h: number, fit = true): Node {
        const node = new Node(assetId.slice(assetId.lastIndexOf('/') + 1));
        node.layer = parent.layer; node.parent = parent;
        const ui = node.addComponent(UITransform);
        ui.setContentSize(w, h);
        node.addComponent(UIOpacity);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        // A missing picture leaves an empty node; the show still ends on time.
        this.frame(assetId).then(f => {
            if (!sprite.isValid) return;
            sprite.spriteFrame = f;
            const r = f.originalSize.width / f.originalSize.height;
            if (fit && r > 0) ui.setContentSize(Math.min(w, h * r), Math.min(h, w / r));
        }, error => console.error(error));
        return node;
    }
}
