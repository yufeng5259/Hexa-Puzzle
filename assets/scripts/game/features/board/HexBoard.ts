import { Color, Component, Graphics, instantiate, Node, NodePool, Prefab, UITransform, Vec3, _decorator } from 'cc';
import { boundaryEdges, latticePoint } from '../../domain/puzzle/HexOutline';
import { HexCell } from '../../domain/puzzle/LevelDefinition';
import { axialPoint, fitCells, nearestAxial, Point2 } from '../../domain/puzzle/PuzzleLayout';
import { BoardCell } from './BoardCell';
import { PieceCell } from './PieceCell';

const { ccclass, property } = _decorator;

/** Radius the BoardCell / PieceCell prefabs are authored at (135×117 cell). */
export const CELL_RADIUS = 67.5;
const PADDING = 24;
const FLOOR = new Color(226, 178, 112, 255);
const RIM = new Color(132, 82, 38, 255);
const key = (c: HexCell): string => c.q + ',' + c.r;

/** A movable piece: a node of PieceCells laid out at board radius, anchor cell (0,0) at the node origin. */
export interface PieceShape {
    node: Node;
    cells: readonly HexCell[];
    color: number;
}

/**
 * 六角棋盘：按格子集合适配到容器，木纹底与木边在 Frame 上画一次（block.hex.v1 的边界算法），
 * 格子与拼块用对象池。坐标：axial（q, r），平顶六角，与 PuzzleLayout 一致。
 */
@ccclass('HexBoard')
export class HexBoard extends Component {
    @property(Graphics) frame: Graphics = null!;
    @property(Node) cells: Node = null!;
    @property(Node) pieces: Node = null!;
    @property(Prefab) cellPrefab: Prefab = null!;
    @property(Prefab) piecePrefab: Prefab = null!;

    radius = CELL_RADIUS;
    private offset: Point2 = { x: 0, y: 0 };
    private readonly cellPool = new NodePool();
    private readonly piecePool = new NodePool();
    private readonly boardCells = new Map<string, BoardCell>();
    private hinted: string[] = [];

    /** Fit `cells` into this node, draw the frame and lay out the grooves. */
    build(cells: readonly HexCell[], obstacles: readonly HexCell[] = []): void {
        this.clear();
        const size = this.node.getComponent(UITransform)!.contentSize;
        const fit = fitCells(cells, size.width, size.height, PADDING);
        this.radius = fit.radius;
        const raw = axialPoint(cells[0], this.radius);
        this.offset = { x: raw.x - fit.centers[0].x, y: raw.y - fit.centers[0].y };
        this.drawFrame(cells);
        const blocked = new Set(obstacles.map(key));
        for (const cell of cells) {
            const node = this.cellPool.get() ?? instantiate(this.cellPrefab);
            node.parent = this.cells;
            node.setScale(this.radius / CELL_RADIUS, this.radius / CELL_RADIUS, 1);
            const p = this.pointOf(cell);
            node.setPosition(p.x, p.y);
            const view = node.getComponent(BoardCell)!;
            view.setState(blocked.has(key(cell)) ? 'obstacle' : 'groove');
            this.boardCells.set(key(cell), view);
        }
    }

    /** Board-local point of a cell center. */
    pointOf(cell: HexCell): Point2 {
        const p = axialPoint(cell, this.radius);
        return { x: p.x - this.offset.x, y: p.y - this.offset.y };
    }

    /** Nearest axial cell to a board-local point (may lie outside the board). */
    cellAt(local: Point2): HexCell {
        return nearestAxial({ x: local.x + this.offset.x, y: local.y + this.offset.y }, this.radius);
    }

    /** Board-local point for a UI-space (touch) location. */
    toLocal(ui: Vec3): Point2 {
        const p = this.node.getComponent(UITransform)!.convertToNodeSpaceAR(ui);
        return { x: p.x, y: p.y };
    }

    setHint(cells: readonly HexCell[]): void {
        for (const k of this.hinted) this.boardCells.get(k)!.setHint(false);
        this.hinted = cells.map(key);
        for (const k of this.hinted) this.boardCells.get(k)!.setHint(true);
    }

    /** New piece node (cells relative to its anchor), parented to `parent`. */
    createShape(cells: readonly HexCell[], color: number, parent: Node): PieceShape {
        const node = new Node('Piece');
        node.layer = this.node.layer;
        node.addComponent(UITransform);
        node.parent = parent;
        for (const cell of cells) {
            const part = this.piecePool.get() ?? instantiate(this.piecePrefab);
            part.parent = node;
            part.setScale(this.radius / CELL_RADIUS, this.radius / CELL_RADIUS, 1);
            const p = axialPoint(cell, this.radius);
            part.setPosition(p.x, p.y);
            part.getComponent(PieceCell)!.setLook(color, false);
        }
        return { node, cells, color };
    }

    setLanded(shape: PieceShape, landed: boolean): void {
        for (const part of shape.node.children) part.getComponent(PieceCell)!.setLook(shape.color, landed);
    }

    releaseShape(shape: PieceShape): void {
        for (const part of shape.node.children.slice()) this.piecePool.put(part);
        shape.node.destroy();
    }

    /** Place a shape so its anchor sits on `cell`. */
    placeShape(shape: PieceShape, cell: HexCell): void {
        shape.node.parent = this.pieces;
        shape.node.setScale(1, 1, 1);
        const p = this.pointOf(cell);
        shape.node.setPosition(p.x, p.y);
        this.setLanded(shape, true);
    }

    clear(): void {
        for (const view of this.boardCells.values()) this.cellPool.put(view.node);
        this.boardCells.clear();
        this.hinted = [];
        this.frame.clear();
    }

    onDestroy(): void {
        this.cellPool.clear();
        this.piecePool.clear();
    }

    private drawFrame(cells: readonly HexCell[]): void {
        const g = this.frame;
        const R = this.radius;
        g.fillColor = FLOOR;
        for (const cell of cells) {
            const c = this.pointOf(cell);
            for (let i = 0; i < 6; i++) {
                const a = Math.PI / 3 * i;
                const x = c.x + R * 1.04 * Math.cos(a), y = c.y + R * 1.04 * Math.sin(a);
                if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
            }
            g.close();
        }
        g.fill();
        g.strokeColor = RIM;
        g.lineWidth = Math.max(4, R * 0.22);
        g.lineCap = Graphics.LineCap.ROUND;
        for (const edge of boundaryEdges(cells)) {
            const a = latticePoint(edge.a, R), b = latticePoint(edge.b, R);
            g.moveTo(a.x - this.offset.x, a.y - this.offset.y);
            g.lineTo(b.x - this.offset.x, b.y - this.offset.y);
        }
        g.stroke();
    }
}
