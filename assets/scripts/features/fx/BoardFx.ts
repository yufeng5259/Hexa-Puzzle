import { Color, game as engine, Game as Engine, Graphics, isValid, Node, UIOpacity, UITransform, Vec3 } from 'cc';
import { PresentationItem } from '../presentation/PresentationItem';
import type { PuzzleBoardPresentation } from '../puzzle/presentation/PuzzleBoardPresentation';
import type { PuzzleSessionSnapshot } from '../puzzle/session/PuzzleSession';
import {
    bounceScale, cellProgress, failDim, failShake, glowAlpha, planWave,
    type Axial, type BoardTimings, type WavePlan,
} from './WinTimeline';

const GLOW = new Color(255, 246, 214, 255), GLOW_ALPHA = 150;
const SPARK = new Color(255, 204, 64, 255), SPARKS = 8;
const DIM = new Color(40, 28, 12, 255), DIM_ALPHA = 110;

interface Bounce { node: Node; base: Vec3; cell: number }
interface Running {
    kind: 'win' | 'fail' | 'fade';
    at: number; end: number;
    draw: (at: number) => void;
    /** Puts every touched node back on its stable pose. */
    restore: () => void;
    done: () => void;
}

/**
 * Board finishes of the puzzle page (docs/v2/09 §5): the win wave (glow from the last piece by hex
 * distance, cell art bouncing, a few gold sparks), the failure dim with one sway, and the board
 * fade used when leaving or restarting. Only visual children change: cell coordinates, occupancy
 * and the board root scale stay as saved. One effect at a time; a new one, stop(), the app going
 * to the background or the board going away end the running one at its stable state.
 */
export class BoardFx {
    private current: Running | null = null;
    private overlay: Graphics | null = null;
    /** Failure dim stays on the board until clear(). */
    private dimmed = false;

    public constructor(private readonly board: PuzzleBoardPresentation, private readonly t: BoardTimings) {
        engine.on(Engine.EVENT_HIDE, this.stop, this);
    }
    public get busy(): boolean { return !!this.current; }
    /** Time into the running effect (0 when idle). */
    public get elapsed(): number { return this.current?.at ?? 0; }

    /** Win celebration of a completed snapshot; resolves when the board has settled. */
    public win(snapshot: PuzzleSessionSnapshot): Promise<void> {
        this.stop();
        const board = this.board, level = board.level, mount = board.boardMount;
        if (!level || !board.boardFit || !isValid(mount, true)) return Promise.resolve();
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
        const plan = planWave(cells, origin, this.t);
        const sparks = Array.from({ length: Math.min(SPARKS, cells.length) }, (_, i) => Math.floor((i + 0.5) * cells.length / Math.min(SPARKS, cells.length)));
        return this.run('win', plan.end, at => {
            for (const b of bounces) if (b.node.isValid) {
                const s = bounceScale(cellProgress(plan.cells[b.cell], plan, at));
                b.node.setScale(b.base.x * s, b.base.y * s, b.base.z);
            }
            this.drawWave(plan, sparks, at);
        }, () => {
            for (const b of bounces) if (b.node.isValid) b.node.setScale(b.base);
            this.overlay?.clear();
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
