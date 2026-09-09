import type { GameMode, LevelData, LevelMetadata } from '../data/LevelTypes';
import type { AttemptSave } from '../data/SaveTypes';
import { coordKey, type GridCoord } from '../model/HexGrid';
import { PuzzleModel, type PieceId, type PlacementPreview, type PuzzleSnapshot } from '../model/PuzzleModel';
import { scoreCompletion, type ScoringResult, type ScoringTargets } from './ScoringRules';
import { SessionStats, type DropOutcome, type SessionStatsSnapshot } from './SessionStats';

export interface HintSelection { pieceId: PieceId; textureName: string; cells: GridCoord[]; conflictingPieceIds: PieceId[] }
export interface GameplaySessionSnapshot {
  stats: SessionStatsSnapshot;
  score: ScoringResult;
  won: boolean;
  status: 'active' | 'failed' | 'completed';
  remainingMoves: number | null;
  continuesUsed: number;
  bonusMoves: number;
  hintRefills: number;
  activeHint: HintSelection | null;
}
export interface CompletionSnapshot extends GameplaySessionSnapshot { completionToken: string }
type AttemptIdentity = Pick<AttemptSave, 'attemptId' | 'mapId' | 'levelId' | 'mode' | 'contentVersion'>;

export class GameplaySession {
  public readonly model: PuzzleModel;
  private readonly stats = new SessionStats();
  private readonly metadata: LevelMetadata | null;
  private readonly targets: Partial<ScoringTargets> | null;
  private completion: CompletionSnapshot | null = null;
  private drag: { pieceId: PieceId; before: PuzzleSnapshot; placed: boolean } | null = null;
  private activeHintPieceId: PieceId | null = null;
  private continuesUsed = 0;
  private bonusMoves = 0;
  private hintRefills = 0;

  public constructor(private readonly level: LevelData, configuration?: LevelMetadata | Partial<ScoringTargets> | null, restoredAttempt?: AttemptSave) {
    this.model = new PuzzleModel(level);
    this.metadata = configuration && 'mode' in configuration ? configuration : null;
    this.targets = configuration && !('mode' in configuration) ? configuration : null;
    if (this.metadata && (this.metadata.pieceCount !== this.pieceCount || !Number.isSafeInteger(this.metadata.perfectMoveTarget) || this.metadata.perfectMoveTarget !== this.pieceCount || (this.metadata.mode === 'challenge' && (!Number.isSafeInteger(this.metadata.moveLimit) || this.metadata.moveLimit! < this.pieceCount)))) throw new Error('Invalid gameplay metadata');
    if (restoredAttempt) this.restoreAttempt(restoredAttempt);
  }

  public get pieceCount(): number { return this.model.pieces.length; }
  public get mode(): GameMode { return this.metadata?.mode ?? 'relaxed'; }
  private get remainingMoves(): number | null { return this.mode === 'challenge' ? Math.max(0, this.metadata!.moveLimit! + this.bonusMoves - this.stats.snapshot().moves) : null; }
  private get status(): 'active' | 'failed' | 'completed' { return this.stats.snapshot().completed || (!this.drag && this.model.isWon) ? 'completed' : this.remainingMoves === 0 ? 'failed' : 'active'; }

  public beginMove(pieceId: PieceId): boolean {
    if (this.status !== 'active' || this.drag) return false;
    const before = this.model.snapshot();
    if (!this.model.beginMove(pieceId)) return false;
    this.drag = { pieceId, before, placed: false };
    return true;
  }

  public previewPlacement(pieceId: PieceId, preview: PlacementPreview): boolean {
    if (!this.drag || this.drag.pieceId !== pieceId || this.drag.placed || !preview.valid) return false;
    this.drag.placed = this.model.place(pieceId, preview);
    return this.drag.placed;
  }

  public findPlacement(pieceId: PieceId, anchor: GridCoord, anchorIndex: number): PlacementPreview { return this.model.previewPlacement(pieceId, anchor, anchorIndex); }

  public recordDrop(outcome: DropOutcome): GameplaySessionSnapshot {
    const drag = this.drag;
    if (!drag) return this.snapshot();
    if (outcome === 'cancelled' || outcome === 'invalid-return' || !drag.placed) {
      this.model.restore(drag.before);
      this.stats.recordDrop(outcome === 'cancelled' ? 'cancelled' : 'invalid-return');
    } else {
      const previous = drag.before.pieces.find((piece) => piece.id === drag.pieceId)!;
      const current = this.model.snapshot().pieces.find((piece) => piece.id === drag.pieceId)!;
      const same = previous.placed && previous.cells.map(coordKey).sort().join('|') === current.cells.map(coordKey).sort().join('|');
      this.stats.recordDrop(same ? 'same-position' : 'correct');
    }
    this.drag = null;
    this.afterMove();
    return this.snapshot();
  }

  public cancelMove(): GameplaySessionSnapshot { return this.recordDrop('cancelled'); }

  public returnToTray(pieceId: PieceId): boolean {
    if (this.status !== 'active') return false;
    if (this.drag && this.drag.pieceId !== pieceId) return false;
    const before = this.drag ? this.drag.before : this.model.snapshot();
    const previous = before.pieces.find((piece) => piece.id === pieceId);
    if (!previous) return false;
    if (this.drag) this.model.restore(before);
    this.drag = null;
    if (!previous.placed) return false;
    this.model.returnToTray(pieceId);
    this.stats.recordDrop('tray-return');
    this.afterMove();
    return true;
  }

  private afterMove(): void {
    if (this.model.isWon) this.stats.markCompleted();
    if (this.activeHintPieceId && (this.model.isWon || this.hintResolved(this.activeHintPieceId))) this.activeHintPieceId = null;
  }

  private hintResolved(pieceId: PieceId): boolean {
    const piece = this.model.getPiece(pieceId);
    const state = this.model.snapshot().pieces.find((item) => item.id === pieceId);
    return !!piece && !!state && state.placed && state.cells.map(coordKey).sort().join('|') === piece.targetCells.map(coordKey).sort().join('|');
  }

  private hintFor(pieceId: PieceId): HintSelection | null {
    const piece = this.model.getPiece(pieceId);
    if (!piece || this.hintResolved(pieceId)) return null;
    const occupied = this.model.snapshot().occupied;
    const conflictingPieceIds: PieceId[] = [];
    for (const cell of piece.targetCells) {
      const occupant = occupied[coordKey(cell)];
      if (occupant && occupant !== pieceId && conflictingPieceIds.indexOf(occupant) < 0) conflictingPieceIds.push(occupant);
    }
    return { pieceId, textureName: piece.textureName, cells: piece.targetCells.map((cell) => ({ ...cell })), conflictingPieceIds };
  }

  public getHintCandidate(): HintSelection | null {
    if (this.status !== 'active' || this.drag) return null;
    if (this.activeHintPieceId) return this.hintFor(this.activeHintPieceId);
    for (let index = this.model.pieces.length - 1; index >= 0; index -= 1) {
      const hint = this.hintFor(this.model.pieces[index].id);
      if (hint) return hint;
    }
    return null;
  }

  public activateHint(pieceId?: PieceId): { hint: HintSelection | null; newlyActivated: boolean } {
    const candidate = this.getHintCandidate();
    if (!candidate || this.activeHintPieceId) return { hint: candidate, newlyActivated: false };
    const hint = pieceId ? this.hintFor(pieceId) : candidate;
    if (!hint) return { hint: null, newlyActivated: false };
    this.activeHintPieceId = hint.pieceId;
    this.stats.recordHintUse();
    return { hint, newlyActivated: true };
  }

  public cancelHint(): void { if (this.status === 'active' && !this.drag) this.activeHintPieceId = null; }
  public recordHintUse(): GameplaySessionSnapshot { if (this.status === 'active' && !this.drag) this.stats.recordHintUse(); return this.snapshot(); }

  public toAttemptSave(identity: AttemptIdentity): AttemptSave {
    return { ...identity, status: this.status === 'failed' ? 'failed' : 'active', moves: this.stats.snapshot().moves, errors: this.stats.snapshot().errors, hintsUsed: this.stats.snapshot().hintsUsed, continuesUsed: this.continuesUsed, bonusMoves: this.bonusMoves, hintRefills: this.hintRefills, activeHintPieceId: this.activeHintPieceId, puzzle: this.drag ? this.drag.before : this.model.snapshot() };
  }

  public restoreAttempt(attempt: AttemptSave): void {
    if (!this.metadata || attempt.levelId !== this.metadata.levelId || attempt.mode !== this.mode || attempt.contentVersion !== this.metadata.contentVersion || !attempt.attemptId || !attempt.mapId) throw new Error('Invalid attempt content identity');
    if ([attempt.moves, attempt.errors, attempt.hintsUsed, attempt.continuesUsed, attempt.bonusMoves, attempt.hintRefills].some((value) => !Number.isSafeInteger(value) || value < 0) || attempt.continuesUsed > 1 || attempt.hintRefills > 2 || attempt.bonusMoves !== attempt.continuesUsed * 3 || (this.mode === 'relaxed' && attempt.continuesUsed !== 0)) throw new Error('Invalid attempt counters');
    const limit = this.mode === 'challenge' ? this.metadata.moveLimit! + attempt.bonusMoves : null;
    if (limit !== null && attempt.moves > limit) throw new Error('Invalid attempt move budget');
    const expectedStatus = !attempt.puzzle.won && limit !== null && attempt.moves === limit ? 'failed' : 'active';
    if (attempt.status !== expectedStatus) throw new Error('Invalid attempt status');
    const candidate = new PuzzleModel(this.level);
    candidate.restore(attempt.puzzle);
    if (attempt.activeHintPieceId !== null) {
      const piece = candidate.getPiece(attempt.activeHintPieceId);
      const state = candidate.snapshot().pieces.find((item) => item.id === attempt.activeHintPieceId);
      if (!piece || !state || attempt.hintsUsed === 0 || candidate.isWon || (state.placed && state.cells.map(coordKey).sort().join('|') === piece.targetCells.map(coordKey).sort().join('|'))) throw new Error('Invalid attempt active hint');
    }
    this.model.restore(attempt.puzzle);
    this.stats.restore({ moves: attempt.moves, errors: attempt.errors, hintsUsed: attempt.hintsUsed, completed: this.model.isWon, committed: false });
    this.continuesUsed = attempt.continuesUsed;
    this.bonusMoves = attempt.bonusMoves;
    this.hintRefills = attempt.hintRefills;
    this.activeHintPieceId = attempt.activeHintPieceId;
    this.drag = null;
    this.completion = null;
  }

  public reset(): GameplaySessionSnapshot {
    if (this.status === 'completed') return this.snapshot();
    this.model.reset(); this.stats.reset(); this.drag = null; this.activeHintPieceId = null;
    this.continuesUsed = 0; this.bonusMoves = 0; this.hintRefills = 0;
    return this.snapshot();
  }

  public complete(): CompletionSnapshot {
    if (this.completion) return this.completion;
    if (!this.model.isWon || this.drag) throw new Error('Cannot complete an unfinished gameplay session');
    this.stats.markCommitted();
    const snapshot = this.snapshot();
    this.completion = { ...snapshot, completionToken: `${Date.now()}-${this.pieceCount}-${snapshot.stats.moves}-${snapshot.stats.hintsUsed}` };
    return this.completion;
  }

  public snapshot(): GameplaySessionSnapshot {
    const stats = this.stats.snapshot();
    return { stats, score: scoreCompletion({ completed: stats.completed, pieceCount: this.pieceCount, hintsUsed: stats.hintsUsed, errors: stats.errors, moves: stats.moves, continuesUsed: this.continuesUsed, perfectMoveTarget: this.metadata?.perfectMoveTarget, mode: this.mode, targets: this.targets }), won: this.model.isWon && !this.drag, status: this.status, remainingMoves: this.remainingMoves, continuesUsed: this.continuesUsed, bonusMoves: this.bonusMoves, hintRefills: this.hintRefills, activeHint: this.activeHintPieceId ? this.hintFor(this.activeHintPieceId) : null };
  }
}
