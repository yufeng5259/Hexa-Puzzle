import type { LevelData, LevelPieceData } from '../data/LevelTypes';
import { coordKey, gridToPoint2, point2ToGrid, type GridCoord, type GridPoint2 } from './HexGrid';

export type PieceId = string;
export type PlacementFailure = 'unknown-piece' | 'already-placed' | 'no-cells' | 'off-grid' | 'outside-target' | 'duplicate-cell' | 'occupied';
export interface PieceDefinition { id: PieceId; textureName: string; source: LevelPieceData; targetCells: GridCoord[]; localPoints: GridPoint2[] }
export interface PlacementPreview { valid: boolean; failure?: PlacementFailure; cells: GridCoord[]; translation: GridPoint2; correctlyMatched: boolean }
export interface PieceState { id: PieceId; textureName: string; placed: boolean; cells: GridCoord[]; correctlyMatched: boolean }
export interface PuzzleSnapshot { pieces: PieceState[]; occupied: Record<string, PieceId>; remainingHints: string[]; won: boolean }

function cloneCoord(coord: GridCoord): GridCoord { return { tx: coord.tx, ty: coord.ty }; }

export class PuzzleModel {
  public readonly pieces: readonly PieceDefinition[];
  public readonly targetCells: readonly GridCoord[];
  public readonly obstacleCells: readonly GridCoord[];
  private readonly pieceById = new Map<PieceId, PieceDefinition>();
  private readonly targetKeys = new Set<string>();
  private readonly targetTexture = new Map<string, string>();
  private readonly occupied = new Map<string, PieceId>();
  private readonly placements = new Map<PieceId, PieceState>();
  private remainingHints: string[];

  public constructor(level: LevelData) {
    const movable = level.filter((piece) => piece.type === 'edit_game_elements' && piece.texureName !== '4_png');
    const obstacles = level.filter((piece) => piece.type === 'edit_game_elements' && piece.texureName === '4_png');
    this.pieces = movable.map((source, index) => {
      const targetCells = source.data.map(cloneCoord);
      const origin = gridToPoint2({ tx: source.tx, ty: source.ty });
      const localPoints = targetCells.map((coord) => { const point = gridToPoint2(coord); return { x2: point.x2 - origin.x2, y2: point.y2 - origin.y2 }; });
      return { id: `piece-${index}-${source.texureName}`, textureName: source.texureName, source, targetCells, localPoints };
    });
    const obstacleCells: GridCoord[] = [];
    for (const piece of obstacles) for (const cell of piece.data) obstacleCells.push(cloneCoord(cell));
    this.obstacleCells = obstacleCells;
    const targetCells: GridCoord[] = [];
    for (const piece of this.pieces) for (const cell of piece.targetCells) targetCells.push(cloneCoord(cell));
    this.targetCells = targetCells;
    for (const piece of this.pieces) {
      if (this.pieceById.has(piece.id)) throw new Error(`重复拼块ID: ${piece.id}`);
      this.pieceById.set(piece.id, piece);
      for (const cell of piece.targetCells) {
        const key = coordKey(cell);
        if (this.targetKeys.has(key)) throw new Error(`目标格重复: ${key}`);
        this.targetKeys.add(key);
        this.targetTexture.set(key, piece.textureName);
      }
    }
    this.remainingHints = this.pieces.map((piece) => piece.textureName);
  }

  public getPiece(id: PieceId): PieceDefinition | undefined { return this.pieceById.get(id); }

  public beginMove(pieceId: PieceId): boolean {
    const placement = this.placements.get(pieceId);
    if (!placement) return this.pieceById.has(pieceId);
    for (const cell of placement.cells) this.occupied.delete(coordKey(cell));
    this.placements.delete(pieceId);
    if (placement.correctlyMatched && this.remainingHints.indexOf(placement.textureName) < 0) this.remainingHints.push(placement.textureName);
    return true;
  }

  public previewPlacement(pieceId: PieceId, anchorCell: GridCoord, anchorIndex = 0): PlacementPreview {
    const piece = this.pieceById.get(pieceId);
    if (!piece) return { valid: false, failure: 'unknown-piece', cells: [], translation: { x2: 0, y2: 0 }, correctlyMatched: false };
    if (this.placements.has(pieceId)) return { valid: false, failure: 'already-placed', cells: [], translation: { x2: 0, y2: 0 }, correctlyMatched: false };
    if (!piece.localPoints.length || !piece.localPoints[anchorIndex]) return { valid: false, failure: 'no-cells', cells: [], translation: { x2: 0, y2: 0 }, correctlyMatched: false };
    const anchorPoint = gridToPoint2(anchorCell);
    const translation = { x2: anchorPoint.x2 - piece.localPoints[anchorIndex].x2, y2: anchorPoint.y2 - piece.localPoints[anchorIndex].y2 };
    const cells: GridCoord[] = [];
    const keys = new Set<string>();
    for (const local of piece.localPoints) {
      const cell = point2ToGrid({ x2: local.x2 + translation.x2, y2: local.y2 + translation.y2 });
      if (!cell) return { valid: false, failure: 'off-grid', cells: [], translation, correctlyMatched: false };
      const key = coordKey(cell);
      if (!this.targetKeys.has(key)) return { valid: false, failure: 'outside-target', cells: [], translation, correctlyMatched: false };
      if (keys.has(key)) return { valid: false, failure: 'duplicate-cell', cells: [], translation, correctlyMatched: false };
      if (this.occupied.has(key)) return { valid: false, failure: 'occupied', cells: [], translation, correctlyMatched: false };
      keys.add(key); cells.push(cloneCoord(cell));
    }
    return { valid: true, cells, translation, correctlyMatched: cells.every((cell) => this.targetTexture.get(coordKey(cell)) === piece.textureName) };
  }

  public findPlacement(pieceId: PieceId, preferredAnchor?: GridCoord): PlacementPreview | null {
    const piece = this.pieceById.get(pieceId);
    if (!piece || this.placements.has(pieceId)) return null;
    const candidates = preferredAnchor ? [preferredAnchor, ...this.targetCells.filter((cell) => coordKey(cell) !== coordKey(preferredAnchor))] : this.targetCells;
    for (const anchor of candidates) for (let index = 0; index < piece.localPoints.length; index += 1) {
      const preview = this.previewPlacement(pieceId, anchor, index);
      if (preview.valid) return preview;
    }
    return null;
  }

  public place(pieceId: PieceId, preview: PlacementPreview): boolean {
    const piece = this.pieceById.get(pieceId);
    if (!piece || !preview.valid || this.placements.has(pieceId)) return false;
    const fresh = this.previewFromTranslation(piece, preview.translation);
    if (!fresh.valid) return false;
    const state: PieceState = { id: piece.id, textureName: piece.textureName, placed: true, cells: fresh.cells.map(cloneCoord), correctlyMatched: fresh.correctlyMatched };
    for (const cell of state.cells) this.occupied.set(coordKey(cell), pieceId);
    this.placements.set(pieceId, state);
    if (state.correctlyMatched) this.remainingHints = this.remainingHints.filter((texture) => texture !== piece.textureName);
    return true;
  }

  private previewFromTranslation(piece: PieceDefinition, translation: GridPoint2): PlacementPreview {
    const cells: GridCoord[] = [];
    const keys = new Set<string>();
    for (const local of piece.localPoints) {
      const cell = point2ToGrid({ x2: local.x2 + translation.x2, y2: local.y2 + translation.y2 });
      if (!cell) return { valid: false, failure: 'off-grid', cells: [], translation, correctlyMatched: false };
      const key = coordKey(cell);
      if (!this.targetKeys.has(key)) return { valid: false, failure: 'outside-target', cells: [], translation, correctlyMatched: false };
      if (keys.has(key)) return { valid: false, failure: 'duplicate-cell', cells: [], translation, correctlyMatched: false };
      if (this.occupied.has(key)) return { valid: false, failure: 'occupied', cells: [], translation, correctlyMatched: false };
      keys.add(key); cells.push(cell);
    }
    return { valid: true, cells, translation, correctlyMatched: cells.every((cell) => this.targetTexture.get(coordKey(cell)) === piece.textureName) };
  }

  public returnToTray(pieceId: PieceId): boolean { return this.beginMove(pieceId); }
  public nextHint(): { textureName: string; pieceId: PieceId; cells: GridCoord[] } | null {
    while (this.remainingHints.length) {
      const textureName = this.remainingHints[this.remainingHints.length - 1];
      const piece = this.pieces.find((item) => item.textureName === textureName);
      if (piece && !this.placements.get(piece.id)?.correctlyMatched) return { textureName, pieceId: piece.id, cells: piece.targetCells.map(cloneCoord) };
      this.remainingHints.pop();
    }
    return null;
  }
  public get isWon(): boolean { return this.occupied.size === this.targetCells.length && this.placements.size === this.pieces.length; }
  public reset(): void { this.occupied.clear(); this.placements.clear(); this.remainingHints = this.pieces.map((piece) => piece.textureName); }
  public snapshot(): PuzzleSnapshot {
    return {
      pieces: this.pieces.map((piece) => this.placements.get(piece.id) ?? { id: piece.id, textureName: piece.textureName, placed: false, cells: [], correctlyMatched: false }).map((state) => ({ ...state, cells: state.cells.map(cloneCoord) })),
      occupied: this.occupiedRecord(), remainingHints: [...this.remainingHints], won: this.isWon,
    };
  }

  private occupiedRecord(): Record<string, PieceId> {
    const result: Record<string, PieceId> = {};
    this.occupied.forEach((pieceId, key) => { result[key] = pieceId; });
    return result;
  }
}
