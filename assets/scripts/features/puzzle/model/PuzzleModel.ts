import { HexCell, LevelDefinition } from '../data/LevelDefinition';

const key = (cell: HexCell): string => cell.q + ',' + cell.r;
const valid = (cell: HexCell): boolean => !!cell && Number.isSafeInteger(cell.q) && Number.isSafeInteger(cell.r);

/** Pure axial occupancy. Source answer positions never constrain a player's solution. */
export class PuzzleModel {
    private readonly targets: Set<string>;
    private readonly obstacles: Set<string>;
    private readonly pieces: Map<string, readonly HexCell[]>;
    private readonly placed = new Map<string, HexCell>();
    /** Board cell -> occupying piece. Maintained incrementally so drag previews stay O(piece cells). */
    private readonly occupancy = new Map<string, string>();

    constructor(level: LevelDefinition | PuzzleModel) {
        if (level instanceof PuzzleModel) {
            // Static level sets are immutable and shared; only placement state is copied.
            this.targets = level.targets; this.obstacles = level.obstacles; this.pieces = level.pieces;
            level.placed.forEach((cell, id) => this.placed.set(id, cell));
            level.occupancy.forEach((id, cell) => this.occupancy.set(cell, id));
            return;
        }
        this.targets = new Set(level.targetCells.map(key));
        this.obstacles = new Set(level.obstacleCells.map(key));
        this.pieces = new Map(level.pieces.map(piece => [piece.id, piece.cells.map(cell => ({ q: cell.q, r: cell.r }))]));
    }

    clone(): PuzzleModel { return new PuzzleModel(this); }
    hasPiece(pieceId: string): boolean { return this.pieces.has(pieceId); }
    isPlaced(pieceId: string): boolean { return this.placed.has(pieceId); }

    canPlace(pieceId: string, translation: HexCell): boolean {
        const cells = this.pieces.get(pieceId);
        if (!cells || !valid(translation)) return false;
        return cells.every(cell => {
            const translated = { q: cell.q + translation.q, r: cell.r + translation.r };
            if (!valid(translated)) return false;
            const address = key(translated), owner = this.occupancy.get(address);
            return this.targets.has(address) && !this.obstacles.has(address) && (owner === undefined || owner === pieceId);
        });
    }

    /** Returns true only when a legal placement changes the board. */
    place(pieceId: string, translation: HexCell): boolean {
        if (!this.canPlace(pieceId, translation)) return false;
        const old = this.placed.get(pieceId);
        if (old && old.q === translation.q && old.r === translation.r) return false;
        this.returnPiece(pieceId);
        const anchor = { q: translation.q, r: translation.r };
        this.placed.set(pieceId, anchor);
        for (const cell of this.pieces.get(pieceId)!) this.occupancy.set(key({ q: cell.q + anchor.q, r: cell.r + anchor.r }), pieceId);
        return true;
    }

    returnPiece(pieceId: string): boolean {
        const anchor = this.placed.get(pieceId);
        if (!anchor) return false;
        for (const cell of this.pieces.get(pieceId)!) this.occupancy.delete(key({ q: cell.q + anchor.q, r: cell.r + anchor.r }));
        return this.placed.delete(pieceId);
    }

    get placements(): Readonly<Record<string, HexCell>> {
        const result: Record<string, HexCell> = {};
        for (const [id, cell] of this.placed) Object.defineProperty(result, id, {
            value: Object.freeze({ ...cell }), enumerable: true
        });
        return Object.freeze(result);
    }

    /** Pieces only occupy legal target cells, so full occupancy equals full coverage. */
    get completed(): boolean {
        return this.targets.size > 0 && this.occupancy.size === this.targets.size;
    }
}
