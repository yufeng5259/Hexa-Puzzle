import { Color, game as engine, Game as Engine, Graphics, isValid, Mask, Node, Sprite, SpriteFrame, UIOpacity, UITransform, Vec3, view } from 'cc';
import { PresentationItem } from '../presentation/PresentationItem';
import type { PuzzleBoardPresentation } from '../puzzle/presentation/PuzzleBoardPresentation';
import type { PuzzleSessionSnapshot } from '../puzzle/session/PuzzleSession';
import { dialogScale } from '../ui/FitMath';
import { ScreenFit } from '../ui/ScreenFit';
import {
    barOffset, beePose, bounceScale, cellProgress, confettiPieces, confettoPose, failDim, failShake, fireworkFrame, FIREWORK_FRAMES, FIREWORK_STARTS,
    flashAlpha, glowPose, glowAlpha, outerRing, planWave, punchScale, ribbonScale, rimAlpha, shineProgress, winMarks,
    type Axial, type BoardTimings, type Confetto, type WavePlan,
} from './WinTimeline';

const GLOW = new Color(255, 246, 214, 255), GLOW_ALPHA = 110;
const SPARK = new Color(255, 204, 64, 255), SPARKS = 8;
const DIM = new Color(40, 28, 12, 255), DIM_ALPHA = 110;

interface Bounce { node: Node; base: Vec3; cell: number }

/** Win art (docs/v2/11 §2.2); a picture not loaded yet is simply not drawn. */
const ART = {
    rim: 'UI/特效/win/fx_win_hex_rim.png', shine: 'UI/特效/win/fx_win_shine.png', glow: 'UI/特效/fx_glow_burst.png', bee: '角色/bee_celebrate.png',
    confetti: [1, 2, 3, 4].map(i => `UI/特效/fx_confetti_0${i}.png`),
    firework: Array.from({ length: FIREWORK_FRAMES }, (_, i) => `UI/特效/win/fx_win_firework_0${i + 1}.png`),
};
/**
 * Sizes in design units (grown with the band scale on wide phones); glow relative to the shape. The rim
 * art's gold line runs at 85% of its canvas: two layers at these multiples of a cell put a thick line
 * on the cell outline, where the outer edges meet the dark background.
 */
const SIZE = { firework: 320, bee: [140, 146], shine: [200, 900], rim: [1.14, 1.2], glow: 1.5, ribbonGap: 24 };
const FLASH = new Color(255, 255, 255, 255);

/**
 * What the page hands to a win celebration. ribbon: the page's ribbon picture and its text, placed
 * above the shape and popped. coins: called once when the coins should fly, from a node at the shape
 * centre (late: the celebration was cut short, the show should land at once). bar: the bottom bar's
 * slide offset, 1 hidden below → 0 in place; called with 0 last, also when cut short.
 */
export interface WinCues {
    readonly ribbon: readonly Node[];
    readonly coins: ((from: Node, late: boolean) => void) | null;
    readonly bar: (offset: number) => void;
}
interface Running {
    kind: 'win' | 'fail' | 'fade';
    at: number; end: number;
    draw: (at: number) => void;
    /** Puts every touched node back on its stable pose. */
    restore: () => void;
    done: () => void;
}

/**
 * Board finishes of the puzzle page: the win celebration (docs/v2/10 §4.1, see win()), the failure
 * dim with one sway (09 §5), and the board fade used when leaving or restarting. Only visuals change:
 * cell coordinates and occupancy stay as saved, the board's punch scale and every decoration are put
 * back. One effect at a time; a new one, stop(), the app going to the background or the board going
 * away end the running one at its stable state.
 */
export class BoardFx {
    private current: Running | null = null;
    private overlay: Graphics | null = null;
    /** Failure dim stays on the board until clear(). */
    private dimmed = false;
    private readonly frames = new Map<string, SpriteFrame>();

    public constructor(private readonly board: PuzzleBoardPresentation, private readonly t: BoardTimings) {
        engine.on(Engine.EVENT_HIDE, this.stop, this);
    }
    public get busy(): boolean { return !!this.current; }
    /** Time into the running effect (0 when idle). */
    public get elapsed(): number { return this.current?.at ?? 0; }

    /** Loads the win art ahead of the final move, so the celebration never waits for a picture. */
    public preload(frame: (id: string) => Promise<SpriteFrame>): void {
        for (const id of [ART.rim, ART.shine, ART.glow, ART.bee, ...ART.confetti, ...ART.firework])
            if (!this.frames.has(id)) frame(id).then(f => this.frames.set(id, f), error => console.warn('win art', id, error));
    }

    /**
     * Win celebration of a completed snapshot (docs/v2/10 §4.1): board punch and white flash, the
     * outer ring lighting up with a shine sweep and the cell wave, then glow, ribbon, confetti,
     * fireworks and the bee; coins and the bottom bar come in on cue. Resolves when everything has
     * settled; stop() (a tap, the app hidden, the page gone) jumps to that state, firing the cues
     * not reached yet. Only visual nodes change; the ribbon stays shown.
     */
    public win(snapshot: PuzzleSessionSnapshot, cues: WinCues): Promise<void> {
        this.stop();
        const board = this.board, level = board.level, mount = board.boardMount, root = board.node;
        if (!level || !board.boardFit || !isValid(mount, true)) { cues.bar(0); return Promise.resolve(); }
        const cells: Axial[] = [], bounces: Bounce[] = [];
        let origin: Axial[] = [];
        const last = snapshot.placementOrder?.[snapshot.placementOrder.length - 1];
        for (const entry of board.pieceEntries()) {
            const at = snapshot.placements[entry.item.pieceId];
            if (!at || entry.node.parent !== mount) continue;
            const visuals = entry.item.cellsRoot?.children.filter(n => n.active) ?? [];
            const own = entry.item.cells.map(c => ({ q: c.q + at.q, r: c.r + at.r }));
            own.forEach((cell, i) => {
                const body = visuals[i]?.getComponent(PresentationItem)?.body?.node;
                if (body?.isValid) bounces.push({ node: body, base: body.scale.clone(), cell: cells.length });
                cells.push(cell);
            });
            if (entry.item.pieceId === last) origin = own;
        }
        const t = this.t, plan = planWave(cells, origin, t), marks = winMarks(t), radius = board.boardFit.radius;
        const sparks = Array.from({ length: Math.min(SPARKS, cells.length) }, (_, i) => Math.floor((i + 0.5) * cells.length / Math.min(SPARKS, cells.length)));
        const mountBase = mount!.scale.clone(), k = dialogScale(ScreenFit.current);
        const shape = this.shapeBox(level.targetCells, radius);
        const deco: Node[] = [];

        // Behind the board: the rotating glow.
        const glow = this.sprite(root, ART.glow, 1, 1);
        if (glow) {
            glow.setSiblingIndex(mount!.getSiblingIndex());
            const size = Math.max(shape.width, shape.height) * mount!.scale.x * SIZE.glow;
            glow.setPosition(this.toRoot(shape.centre)); glow.getComponent(UITransform)!.setContentSize(size, size);
            deco.push(glow);
        }
        // On the board, above the pieces: rims of the outer ring and the shine, clipped to the shape.
        const ring = outerRing(level.targetCells), rims = new Node('WinRims');
        rims.layer = mount!.layer; rims.parent = mount; rims.addComponent(UITransform);
        deco.push(rims);
        const rimNodes = ring.map(cell => SIZE.rim.map(k => {
            const n = this.sprite(rims, ART.rim, 2 * radius * k, Math.sqrt(3) * radius * k);
            const p = board.pointOfCell(cell);
            n?.setPosition(p.x, p.y, 0);
            return n;
        }));
        const clip = new Node('WinShine');
        clip.layer = mount!.layer; clip.parent = mount; clip.addComponent(UITransform);
        const stencil = clip.addComponent(Graphics), mask = clip.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_STENCIL;
        for (const cell of level.targetCells) this.hex(stencil, cell, radius, FLASH, 255);
        deco.push(clip);
        const diagonal = Math.hypot(shape.width, shape.height);
        const shine = this.sprite(clip, ART.shine, diagonal * SIZE.shine[0] / SIZE.shine[1], diagonal);
        if (shine) shine.angle = -25;
        // In front of everything on the page: flash, confetti, fireworks, bee.
        const front = new Node('WinFront'), visible = view.getVisibleSize();
        front.layer = root.layer; front.parent = root;
        front.addComponent(UITransform).setContentSize(visible.width, visible.height);
        deco.push(front);
        const flash = new Node('WinFlash');
        flash.layer = root.layer; flash.parent = front; flash.addComponent(UITransform);
        const flashG = flash.addComponent(Graphics);
        const frame = ScreenFit.current.frame, frameTop = frame.y + frame.height / 2;
        const top = this.toRoot(new Vec3(shape.centre.x, shape.top, 0)), bottom = this.toRoot(new Vec3(shape.centre.x, shape.bottom, 0));
        const pieces = confettiPieces(t.winConfettiCount, Math.random).map(c => ({ c, node: this.sprite(front, ART.confetti[c.frame], c.size * k, c.size * 0.6 * k) }));
        const corner = (c: Confetto) => new Vec3(c.side < 0 ? frame.x - frame.width / 2 + 30 * k : frame.x + frame.width / 2 - 30 * k, bottom.y, 0);
        const spots = [[-0.28, 90], [0.28, 60], [0.2, 190], [-0.18, 170]];
        const fireworks = FIREWORK_STARTS.map((startAt, i) => {
            const size = SIZE.firework * k * (i > 1 ? 0.75 : 1), [x, y] = spots[i];
            return { start: marks.celebrate + startAt, at: new Vec3(frame.x + x * frame.width, Math.min(top.y + y * k, frameTop - 260 * k), 0), node: this.sprite(front, ART.firework[0], size, size) };
        });
        // Ribbon above the shape, below the HUD band.
        const ribbonY = Math.min(top.y + (SIZE.ribbonGap + 70) * k, frameTop - 230 * k);
        const lead = cues.ribbon[0];
        const ribbons = cues.ribbon.filter(n => n.isValid).map(n => ({ node: n, base: n.scale.clone(), dy: n.position.y - lead.position.y }));
        for (const r of ribbons) { r.node.setPosition(frame.x, ribbonY + r.dy, r.node.position.z); r.node.active = true; r.node.setScale(0, 0, 1); }
        const bee = this.sprite(front, ART.bee, SIZE.bee[0] * k, SIZE.bee[1] * k);
        const beeHome = new Vec3(frame.x + 300 * k, ribbonY + 40 * k, 0), beeFrom = frame.x + frame.width / 2 + SIZE.bee[0] * k;
        const coinFrom = new Node('WinCoins');
        coinFrom.layer = root.layer; coinFrom.parent = front; coinFrom.addComponent(UITransform).setContentSize(10, 10);
        coinFrom.setPosition(this.toRoot(shape.centre));

        let coinsFired = false, barSettled = false;
        const fireCoins = (late: boolean) => {
            if (coinsFired) return;
            coinsFired = true;
            try { cues.coins?.(coinFrom, late); } catch (error) { console.error(error); }
        };
        const bar = (offset: number) => {
            if (barSettled) return;
            if (offset <= 0) barSettled = true;
            try { cues.bar(Math.max(0, offset)); } catch (error) { console.error(error); }
        };
        const opacity = (n: Node | null, a: number) => {
            if (!n?.isValid) return;
            n.active = a > 0.01;
            n.getComponent(UIOpacity)!.opacity = 255 * Math.max(0, Math.min(1, a));
        };

        return this.run('win', marks.end, at => {
            const p = punchScale(at, t);
            if (mount!.isValid) mount!.setScale(mountBase.x * p, mountBase.y * p, mountBase.z);
            flashG.clear();
            const fa = flashAlpha(at, t);
            if (fa > 0) {
                FLASH.a = Math.round(255 * fa); flashG.fillColor = FLASH;
                flashG.rect(-visible.width / 2, -visible.height / 2, visible.width, visible.height); flashG.fill();
            }
            for (const b of bounces) if (b.node.isValid) {
                const s = bounceScale(cellProgress(plan.cells[b.cell], plan, at));
                b.node.setScale(b.base.x * s, b.base.y * s, b.base.z);
            }
            this.drawWave(plan, sparks, at);
            if (mount!.isValid) { rims.setSiblingIndex(mount!.children.length - 1); clip.setSiblingIndex(mount!.children.length - 1); }
            rimNodes.forEach((layers, i) => { const a = rimAlpha(i, rimNodes.length, at, t); for (const n of layers) opacity(n, a); });
            const sp = shineProgress(at, t);
            if (shine?.isValid) {
                opacity(shine, sp >= 0 ? 1 : 0);
                shine.setPosition(shape.left - shape.width * 0.3 + shape.width * 1.6 * Math.max(0, sp), shape.centre.y, 0);
            }
            const g = glowPose(at, t);
            if (glow?.isValid) { opacity(glow, g.alpha); glow.setScale(g.scale, g.scale, 1); glow.angle = g.angle; }
            const rs = ribbonScale(at, t);
            for (const r of ribbons) if (r.node.isValid) r.node.setScale(r.base.x * rs, r.base.y * rs, r.base.z);
            for (const { c, node } of pieces) {
                const pose = confettoPose(c, at, t);
                opacity(node, pose ? pose.alpha : 0);
                if (pose && node) { const o = corner(c); node.setPosition(o.x + pose.x * k, o.y + pose.y * k, 0); node.angle = pose.angle; }
            }
            for (const f of fireworks) {
                const i = fireworkFrame(at, f.start);
                opacity(f.node, i >= 0 ? 1 : 0);
                const sf = i >= 0 ? this.frames.get(ART.firework[i]) : null;
                if (f.node && sf) { f.node.setPosition(f.at); f.node.getComponent(Sprite)!.spriteFrame = sf; }
            }
            const bp = beePose(at, t);
            opacity(bee, bp.alpha);
            bee?.setPosition(beeHome.x + (beeFrom - beeHome.x) * bp.offset, beeHome.y + 10 * k * bp.bob, 0);
            if (at >= marks.coins) fireCoins(false);
            if (at >= marks.bar) bar(barOffset(at, t));
        }, () => {
            fireCoins(true);
            bar(0);
            if (mount!.isValid) mount!.setScale(mountBase);
            for (const b of bounces) if (b.node.isValid) b.node.setScale(b.base);
            for (const r of ribbons) if (r.node.isValid) { r.node.active = true; r.node.setScale(r.base); }
            this.overlay?.clear();
            for (const n of deco) if (n.isValid) n.destroy();
        });
    }

    /** Failure: the board darkens and sways once; the dim stays until clear(). */
    public fail(): Promise<void> {
        this.stop();
        const mount = this.board.boardMount, level = this.board.level;
        if (!level || !this.board.boardFit || !isValid(mount, true)) return Promise.resolve();
        const base = mount!.position.clone(), cells = [...level.targetCells, ...level.obstacleCells];
        this.dimmed = true;
        return this.run('fail', this.t.failSeconds, at => {
            if (mount!.isValid) mount!.setPosition(base.x + failShake(at, this.t), base.y, base.z);
            this.drawHexes(cells, DIM, DIM_ALPHA * failDim(at, this.t), true);
        }, () => {
            if (mount!.isValid) mount!.setPosition(base);
            if (this.dimmed) this.drawHexes(cells, DIM, DIM_ALPHA, true);
        });
    }

    /** Board and tray fade out (leaving, or the old board of a restart); they stay hidden until fadeIn(). */
    public fadeOut(): Promise<void> { return this.fade(255, 0); }
    /** The new board of a restart starts invisible, before its first frame. */
    public hide(): void { this.stop(); for (const o of this.faded()) o.opacity = 0; }
    /** The new board of a restart comes in. */
    public fadeIn(): Promise<void> { return this.fade(this.opacity(), 255); }

    /** Removes the failure dim and any leftover overlay (a restart, leaving the page); a faded board stays faded. */
    public clear(): void {
        this.stop();
        this.dimmed = false;
        if (this.overlay?.isValid) this.overlay.node.destroy();
        this.overlay = null;
    }

    /** Ends the running effect at its stable state; its promise resolves. */
    public stop(): void {
        const r = this.current;
        if (!r) return;
        this.current = null;
        try { r.restore(); } catch (error) { console.error(error); }
        r.done();
    }
    public dispose(): void { this.clear(); engine.off(Engine.EVENT_HIDE, this.stop, this); }

    /** Called every frame by the puzzle page. */
    public update(dt: number): void {
        const r = this.current;
        if (!r) return;
        if (!isValid(this.board, true) || !this.board.node.activeInHierarchy) { this.stop(); return; }
        r.at += Math.max(0, dt);
        if (r.at >= r.end) { this.stop(); return; }
        r.draw(r.at);
    }

    private run(kind: Running['kind'], end: number, draw: (at: number) => void, restore: () => void): Promise<void> {
        return new Promise(done => {
            this.current = { kind, at: 0, end, draw, restore, done };
            if (end <= 0) this.stop(); else draw(0);
        });
    }
    private fade(from: number, to: number): Promise<void> {
        this.stop();
        const nodes = this.faded(), seconds = Math.max(0, this.t.boardFadeSeconds);
        const set = (v: number) => { for (const o of nodes) if (o.isValid) o.opacity = v; };
        return this.run('fade', seconds, at => set(from + (to - from) * Math.min(1, at / Math.max(1e-6, seconds))), () => set(to));
    }
    private opacity(): number { return this.faded()[0]?.opacity ?? 255; }
    /** The board cells (with the pieces on them) and the tray. */
    private faded(): UIOpacity[] {
        const b = this.board, nodes = [b.boardMount, b.trayScroll?.node ?? b.piecesMount].filter((n): n is Node => isValid(n, true));
        return nodes.map(n => n.getComponent(UIOpacity) ?? n.addComponent(UIOpacity));
    }

    /** Bounds of the target shape in board-mount space. */
    private shapeBox(cells: readonly Axial[], radius: number): { left: number; right: number; top: number; bottom: number; width: number; height: number; centre: Vec3 } {
        const pts = cells.map(c => this.board.pointOfCell(c));
        const left = Math.min(...pts.map(p => p.x)) - radius, right = Math.max(...pts.map(p => p.x)) + radius;
        const h = radius * Math.sqrt(3) / 2, bottom = Math.min(...pts.map(p => p.y)) - h, top = Math.max(...pts.map(p => p.y)) + h;
        return { left, right, top, bottom, width: right - left, height: top - bottom, centre: new Vec3((left + right) / 2, (top + bottom) / 2, 0) };
    }
    /** Board-mount point → page-root point. */
    private toRoot(p: Vec3): Vec3 {
        const world = this.board.boardMount!.getComponent(UITransform)!.convertToWorldSpaceAR(p);
        return this.board.node.getComponent(UITransform)!.convertToNodeSpaceAR(world);
    }
    /** A hidden sprite of preloaded win art; null when the picture is not loaded (that part is skipped). */
    private sprite(parent: Node, id: string, w: number, h: number): Node | null {
        const frame = this.frames.get(id);
        if (!frame) return null;
        const node = new Node(id.slice(id.lastIndexOf('/') + 1));
        node.layer = parent.layer; node.parent = parent;
        node.addComponent(UITransform).setContentSize(w, h);
        node.addComponent(UIOpacity).opacity = 0;
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.spriteFrame = frame;
        node.active = false;
        return node;
    }

    private drawWave(plan: WavePlan, sparks: readonly number[], at: number): void {
        const g = this.graphics(), board = this.board, radius = board.boardFit?.radius ?? 0;
        if (!g || !radius) return;
        g.clear();
        for (const c of plan.cells) {
            const a = glowAlpha(cellProgress(c, plan, at));
            if (a > 0.01) this.hex(g, c.cell, radius, GLOW, GLOW_ALPHA * a);
        }
        // A few gold four-point sparks pop above the cells as the wave passes them.
        for (const i of sparks) {
            const k = cellProgress(plan.cells[i], plan, at), s = Math.sin(Math.PI * k);
            if (s <= 0.01) continue;
            const p = board.pointOfCell(plan.cells[i].cell), size = radius * 0.45 * s, y = p.y + radius * 0.5 * k;
            SPARK.a = Math.round(255 * s); g.fillColor = SPARK;
            g.moveTo(p.x, y + size); g.lineTo(p.x + size * 0.25, y + size * 0.25); g.lineTo(p.x + size, y); g.lineTo(p.x + size * 0.25, y - size * 0.25);
            g.lineTo(p.x, y - size); g.lineTo(p.x - size * 0.25, y - size * 0.25); g.lineTo(p.x - size, y); g.lineTo(p.x - size * 0.25, y + size * 0.25);
            g.close(); g.fill();
        }
    }
    private drawHexes(cells: readonly Axial[], color: Color, alpha: number, clear: boolean): void {
        const g = this.graphics(), radius = this.board.boardFit?.radius ?? 0;
        if (!g || !radius) return;
        if (clear) g.clear();
        for (const cell of cells) this.hex(g, cell, radius, color, alpha);
    }
    private hex(g: Graphics, cell: Axial, radius: number, color: Color, alpha: number): void {
        const p = this.board.pointOfCell(cell);
        color.a = Math.max(0, Math.min(255, Math.round(alpha)));
        g.fillColor = color;
        for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3, x = p.x + Math.cos(a) * radius, y = p.y + Math.sin(a) * radius;
            if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.close(); g.fill();
    }
    /** One overlay above the placed pieces, created on first use and kept last among the board's children. */
    private graphics(): Graphics | null {
        const mount = this.board.boardMount;
        if (!isValid(mount, true)) return null;
        if (!this.overlay?.isValid) {
            const node = new Node('BoardFx');
            node.layer = mount!.layer; node.parent = mount;
            const ui = mount!.getComponent(UITransform)!, own = node.addComponent(UITransform);
            own.setContentSize(ui.width, ui.height); own.setAnchorPoint(ui.anchorX, ui.anchorY);
            this.overlay = node.addComponent(Graphics);
        }
        this.overlay.node.setSiblingIndex(mount!.children.length - 1);
        return this.overlay;
    }
}
