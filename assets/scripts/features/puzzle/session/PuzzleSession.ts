import { HexCell, LevelDefinition } from '../data/LevelDefinition';
import { PuzzleModel } from '../model/PuzzleModel';

export type PuzzleSessionStatus = 'active' | 'completed' | 'failed';
export interface PuzzleSessionSnapshot {
    readonly attemptId: string;
    readonly levelId: string;
    readonly moves: number;
    readonly status: PuzzleSessionStatus;
    readonly placements: Readonly<Record<string, HexCell>>;
    readonly selectedPieceId: string | null;
    readonly revision: number;
    readonly placementOrder?: readonly string[];
    readonly activeHintPieceId?: string | null;
}
export type PuzzleSnapshot = PuzzleSessionSnapshot;
export interface PuzzleHint { readonly pieceId: string; readonly cells: readonly HexCell[]; readonly conflictingPieceIds: readonly string[] }

/** Pure attempt. A persistence hook must accept a candidate before it becomes observable. */
function immutable<T>(value: T): T {
    if(value && typeof value === 'object') { Object.keys(value).forEach(key=>immutable((value as Record<string, unknown>)[key])); Object.freeze(value); }
    return value;
}
export class PuzzleSession {
    readonly level: LevelDefinition;
    readonly attemptId: string;
    public beforeCommit: ((candidate: PuzzleSessionSnapshot) => void) | null = null;
    private state: PuzzleSessionSnapshot;
    private readonly listeners = new Set<(snapshot: PuzzleSessionSnapshot) => void>();
    constructor(level: LevelDefinition, attemptId: string) {
        if (!attemptId?.trim()) throw new Error('PuzzleSession requires an attemptId');
        this.level = immutable(JSON.parse(JSON.stringify(level)) as LevelDefinition);
        this.attemptId = attemptId;
        this.state = this.freeze({ attemptId, levelId: level.id, moves: 0, status: 'active', placements: {}, selectedPieceId: null, revision: 0, placementOrder: [], activeHintPieceId: null });
    }
    get snapshot(): PuzzleSessionSnapshot { return this.freeze(this.state); }
    serialize(): PuzzleSessionSnapshot { return this.state; }
    restore(snapshot: PuzzleSessionSnapshot): void {
        this.validate(snapshot);
        this.state = this.freeze(snapshot);
    }
    private model(snapshot = this.state): PuzzleModel {
        const model = new PuzzleModel(this.level);
        for (const [id, cell] of Object.entries(snapshot.placements)) {
            if (!model.place(id, cell)) throw new Error('Invalid saved puzzle placement: ' + id);
        }
        return model;
    }
    private validate(value: PuzzleSessionSnapshot): void {
        if (!value || value.attemptId !== this.attemptId || value.levelId !== this.level.id
            || !Number.isSafeInteger(value.moves) || value.moves < 0 || !Number.isSafeInteger(value.revision) || value.revision < 0
            || !['active', 'completed', 'failed'].includes(value.status) || !value.placements || typeof value.placements !== 'object') throw new Error('Invalid saved puzzle identity or counters');
        const model = this.model(value);
        const expected = model.completed ? 'completed' : this.level.mode === 'challenge' && value.moves >= this.level.moveLimit! ? 'failed' : 'active';
        if (value.status !== expected) throw new Error('Invalid saved puzzle status');
        if (this.level.mode === 'challenge' && value.moves > this.level.moveLimit!) throw new Error('Invalid saved move budget');
        const order = value.placementOrder || Object.keys(value.placements);
        if (new Set(order).size !== order.length || order.length !== Object.keys(value.placements).length || order.some(id => !value.placements[id])) throw new Error('Invalid saved placement order');
        if (value.selectedPieceId !== null && !model.hasPiece(value.selectedPieceId)) throw new Error('Invalid selected piece');
        if (value.activeHintPieceId && !model.hasPiece(value.activeHintPieceId)) throw new Error('Invalid active hint');
    }
    private freeze(value: PuzzleSessionSnapshot): PuzzleSessionSnapshot {
        const placements: Record<string, HexCell> = {};
        for (const [id, cell] of Object.entries(value.placements)) Object.defineProperty(placements, id, { value: Object.freeze({ ...cell }), enumerable: true });
        return Object.freeze({ ...value, placements: Object.freeze(placements), placementOrder: Object.freeze([...(value.placementOrder || Object.keys(placements))]), activeHintPieceId: value.activeHintPieceId || null });
    }
    canPlace(pieceId: string, translation: HexCell): boolean { return this.state.status === 'active' && this.model().canPlace(pieceId, translation); }
    place(pieceId: string, translation: HexCell): boolean {
        if (this.state.status !== 'active') return false;
        const model = this.model();
        if (!model.place(pieceId, translation)) return false;
        const order = [...(this.state.placementOrder || [])].filter(id => id !== pieceId); order.push(pieceId);
        let hint = this.state.activeHintPieceId || null;
        if (hint === pieceId && this.correct(pieceId, model.placements) || model.completed) hint = null;
        this.commit({ ...this.state, placements: model.placements, placementOrder: order, selectedPieceId: null, activeHintPieceId: hint }, true);
        return true;
    }
    returnPiece(pieceId?: string): boolean {
        if (this.state.status !== 'active') return false;
        const order = this.state.placementOrder || [];
        const chosen = pieceId !== undefined ? pieceId : (this.state.selectedPieceId && this.state.placements[this.state.selectedPieceId] ? this.state.selectedPieceId : order[order.length - 1]);
        const model = this.model();
        if (!chosen || !model.returnPiece(chosen)) return false;
        this.commit({ ...this.state, placements: model.placements, placementOrder: order.filter(id => id !== chosen), selectedPieceId: null }, true);
        return true;
    }
    select(pieceId: string | null): void {
        if (this.state.status !== 'active' || this.state.selectedPieceId === pieceId || pieceId !== null && !this.model().hasPiece(pieceId)) return;
        this.commit({ ...this.state, selectedPieceId: pieceId }, false);
    }
    hintCandidate(): PuzzleHint | null {
        if (this.state.status !== 'active') return null;
        const piece = this.level.pieces.find(part => part.id === this.state.activeHintPieceId)
            || [...this.level.pieces].reverse().find(part => !this.correct(part.id, this.state.placements));
        if (!piece) return null;
        const target = new Set(piece.targetCells.map(cell => cell.q + ',' + cell.r));
        const conflictingPieceIds = this.level.pieces.filter(other => other.id !== piece.id && this.state.placements[other.id]
            && other.cells.some(cell => target.has((cell.q + this.state.placements[other.id].q) + ',' + (cell.r + this.state.placements[other.id].r)))).map(other => other.id);
        return { pieceId: piece.id, cells: piece.targetCells, conflictingPieceIds };
    }
    activateHint(): PuzzleHint | null {
        const hint = this.hintCandidate();
        if (!hint || this.state.activeHintPieceId) return hint;
        this.commit({ ...this.state, activeHintPieceId: hint.pieceId }, false);
        return hint;
    }
    subscribe(listener: (snapshot: PuzzleSessionSnapshot) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
    private correct(id: string, placements: Readonly<Record<string, HexCell>>): boolean {
        const piece = this.level.pieces.find(part => part.id === id), anchor = placements[id];
        if (!piece || !anchor) return false;
        const keys = new Set(piece.targetCells.map(cell => cell.q + ',' + cell.r));
        return piece.cells.every(cell => keys.has((cell.q + anchor.q) + ',' + (cell.r + anchor.r)));
    }
    private commit(value: PuzzleSessionSnapshot, countMove: boolean): void {
        const moves = value.moves + (countMove ? 1 : 0), model = this.model(value);
        const status = model.completed ? 'completed' : this.level.mode === 'challenge' && moves >= this.level.moveLimit! ? 'failed' : 'active';
        const candidate = this.freeze({ ...value, moves, status, revision: this.state.revision + 1 });
        this.beforeCommit?.(candidate);
        this.state = candidate;
        for (const listener of Array.from(this.listeners)) listener(candidate);
    }
}
