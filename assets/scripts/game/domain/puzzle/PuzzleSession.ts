import { HexCell, LevelDefinition } from './LevelDefinition';
import { PuzzleModel } from './PuzzleModel';

export type PuzzleSessionStatus = 'active' | 'completed' | 'failed';
export interface PuzzleSessionSnapshot {
    readonly attemptId: string;
    readonly levelId: string;
    readonly moves: number;
    readonly status: PuzzleSessionStatus;
    /** Translation added to every local cell of the identified piece. */
    readonly placements: Readonly<Record<string, HexCell>>;
    readonly selectedPieceId: string | null;
    readonly revision: number;
}
export type PuzzleSnapshot = PuzzleSessionSnapshot;

function freezeLevel(level: LevelDefinition): LevelDefinition {
    const cells = (items: readonly HexCell[]) => Object.freeze(items.map(cell => Object.freeze({ q: cell.q, r: cell.r })));
    return Object.freeze({ ...level, targetCells: cells(level.targetCells), obstacleCells: cells(level.obstacleCells),
        pieces: Object.freeze(level.pieces.map(piece => Object.freeze({ ...piece, cells: cells(piece.cells), targetCells: cells(piece.targetCells) }))) });
}

/** One in-memory attempt. No engine, persistence, rewards, or page lifetime ownership. */
export class PuzzleSession {
    readonly level: LevelDefinition;
    readonly attemptId: string;
    private readonly model: PuzzleModel;
    private moves = 0;
    private status: PuzzleSessionStatus = 'active';
    private selectedPieceId: string | null = null;
    private revision = 0;
    private placementOrder: string[] = [];
    private readonly listeners = new Set<(snapshot: PuzzleSessionSnapshot) => void>();

    constructor(level: LevelDefinition, attemptId: string) {
        if (typeof attemptId !== 'string' || !attemptId.trim()) throw new Error('PuzzleSession requires an attemptId');
        this.level = freezeLevel(level);
        this.attemptId = attemptId;
        this.model = new PuzzleModel(this.level);
    }

    /** Rebuild a saved attempt (F013): replays placements, then restores the saved move count. */
    restore(placements: Readonly<Record<string, HexCell>>, moves: number): void {
        for (const [pieceId, translation] of Object.entries(placements)) {
            if (!this.model.place(pieceId, translation)) throw new Error('Saved placement is invalid: ' + pieceId);
            this.placementOrder.push(pieceId);
        }
        this.moves = moves;
        if (this.model.completed) this.status = 'completed';
        else if (this.level.mode === 'challenge' && this.level.moveLimit !== null && moves >= this.level.moveLimit) this.status = 'failed';
    }

    get snapshot(): PuzzleSessionSnapshot {
        return Object.freeze({ attemptId: this.attemptId, levelId: this.level.id, moves: this.moves, status: this.status,
            placements: this.model.placements, selectedPieceId: this.selectedPieceId, revision: this.revision });
    }

    canPlace(pieceId: string, translation: HexCell): boolean {
        return this.status === 'active' && this.model.canPlace(pieceId, translation);
    }

    place(pieceId: string, translation: HexCell): boolean {
        if (this.status !== 'active' || !this.model.place(pieceId, translation)) return false;
        this.placementOrder = this.placementOrder.filter(id => id !== pieceId);
        this.placementOrder.push(pieceId);
        this.selectedPieceId = null;
        this.commitMove();
        return true;
    }

    /** Explicit ID, then selected placed piece, otherwise the most recently placed piece. */
    returnPiece(pieceId?: string): boolean {
        if (this.status !== 'active') return false;
        const chosen = pieceId !== undefined ? pieceId : this.selectedPieceId !== null && this.model.isPlaced(this.selectedPieceId)
            ? this.selectedPieceId : this.placementOrder[this.placementOrder.length - 1];
        if (chosen === undefined || !this.model.returnPiece(chosen)) return false;
        this.placementOrder = this.placementOrder.filter(id => id !== chosen);
        this.selectedPieceId = null;
        this.commitMove();
        return true;
    }

    select(pieceId: string | null): void {
        if (this.status !== 'active' || this.selectedPieceId === pieceId || (pieceId !== null && !this.model.hasPiece(pieceId))) return;
        this.selectedPieceId = pieceId;
        this.changed();
    }

    /** No initial notification; subscribing never changes the attempt. */
    subscribe(listener: (snapshot: PuzzleSessionSnapshot) => void): () => void {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    private commitMove(): void {
        this.moves++;
        // A fill on the final allowed move wins before the exhaustion check.
        if (this.model.completed) this.status = 'completed';
        else if (this.level.mode === 'challenge' && this.level.moveLimit !== null && this.moves >= this.level.moveLimit) this.status = 'failed';
        this.changed();
    }

    private changed(): void {
        this.revision++;
        const snapshot = this.snapshot;
        for (const listener of Array.from(this.listeners)) listener(snapshot);
    }
}
