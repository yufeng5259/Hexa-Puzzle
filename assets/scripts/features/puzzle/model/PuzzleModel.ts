import { HexCell, LevelDefinition } from '../data/LevelDefinition';

const key = (cell: HexCell): string => cell.q + ',' + cell.r;
const valid = (cell: HexCell): boolean => !!cell && Number.isSafeInteger(cell.q) && Number.isSafeInteger(cell.r);

/** Pure axial occupancy. Source answer positions never constrain a player's solution. */
export class PuzzleModel {
    private readonly targets: Set<string>;
    private readonly obstacles: Set<string>;
    private readonly pieces = new Map<string, readonly HexCell[]>();
    private readonly placed = new Map<string, HexCell>();

    constructor(level: LevelDefinition) {
        this.targets = new Set(level.targetCells.map(key));
        this.obstacles = new Set(level.obstacleCells.map(key));
        for (const piece of level.pieces) this.pieces.set(piece.id, piece.cells.map(cell => ({ q: cell.q, r: cell.r })));
    }

    hasPiece(pieceId: string): boolean { return this.pieces.has(pieceId); }
    isPlaced(pieceId: string): boolean { return this.placed.has(pieceId); }

    canPlace(pieceId: string, translation: HexCell): boolean {
        const cells = this.pieces.get(pieceId);
        if (!cells || !valid(translation)) return false;
        const occupied = new Set<string>();
        for (const [otherId, anchor] of this.placed) {
            if (otherId === pieceId) continue;
            for (const cell of this.pieces.get(otherId)!) occupied.add(key({ q: cell.q + anchor.q, r: cell.r + anchor.r }));
        }
        return cells.every(cell => {
            const translated = { q: cell.q + translation.q, r: cell.r + translation.r };
            if (!valid(translated)) return false;
            const address = key(translated);
            return this.targets.has(address) && !this.obstacles.has(address) && !occupied.has(address);
        });
    }

    /** Returns true only when a legal placement changes the board. */
    place(pieceId: string, translation: HexCell): boolean {
        if (!this.canPlace(pieceId, translation)) return false;
        const old = this.placed.get(pieceId);
        if (old && old.q === translation.q && old.r === translation.r) return false;
        this.placed.set(pieceId, { q: translation.q, r: translation.r });
        return true;
    }

    returnPiece(pieceId: string): boolean { return this.placed.delete(pieceId); }

    get placements(): Readonly<Record<string, HexCell>> {
        const result: Record<string, HexCell> = {};
        for (const [id, cell] of this.placed) Object.defineProperty(result, id, {
            value: Object.freeze({ ...cell }), enumerable: true
        });
        return Object.freeze(result);
    }

    get completed(): boolean {
        const occupied = new Set<string>();
        for (const [id, anchor] of this.placed) for (const cell of this.pieces.get(id)!) {
            occupied.add(key({ q: cell.q + anchor.q, r: cell.r + anchor.r }));
        }
        return this.targets.size > 0 && occupied.size === this.targets.size && Array.from(this.targets).every(cell => occupied.has(cell));
    }
}
