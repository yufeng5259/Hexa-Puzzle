export interface PiecePickBounds { minX: number; maxX: number; minY: number; maxY: number }
export interface PiecePickCandidate {
  id: string;
  bounds: PiecePickBounds;
  onCell: boolean;
  distanceSquared: number;
}

// Design-space units, independent of the small tray sprite scale.
export const PIECE_PICK_PADDING = 12;

/** Visible cells win over empty bounding-box regions, then proximity breaks ties. */
export function pickPiece(
  point: { x: number; y: number },
  candidates: readonly PiecePickCandidate[],
): string | null {
  let selected: string | null = null;
  let bestRank = Infinity;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const bounds = candidate.bounds;
    const dx = Math.max(bounds.minX - point.x, 0, point.x - bounds.maxX);
    const dy = Math.max(bounds.minY - point.y, 0, point.y - bounds.maxY);
    if (dx * dx + dy * dy > PIECE_PICK_PADDING * PIECE_PICK_PADDING) continue;
    const rank = candidate.onCell ? 0 : dx === 0 && dy === 0 ? 1 : 2;
    if (rank < bestRank || (rank === bestRank && candidate.distanceSquared <= bestDistance)) {
      selected = candidate.id;
      bestRank = rank;
      bestDistance = candidate.distanceSquared;
    }
  }
  return selected;
}
