import { TILE_HEIGHT } from '../data/LevelTypes';
import { gridToPoint2 } from './HexGrid';
import type { PlacementPreview, PuzzleModel } from './PuzzleModel';

// Board-local units make the magnetic range proportional to the visible cells.
export const SNAP_ENTER_DISTANCE = TILE_HEIGHT * 0.52;
export const SNAP_EXIT_DISTANCE = TILE_HEIGHT * 0.66;
export const SNAP_SWITCH_MARGIN = TILE_HEIGHT * 0.12;

type SnapModel = Pick<PuzzleModel, 'getPiece' | 'targetCells' | 'previewPlacement'>;
interface Origin { x: number; y: number }

function distance(preview: PlacementPreview, origin: Origin): number {
  return Math.hypot(preview.translation.x2 / 2 - origin.x, preview.translation.y2 / 2 - origin.y);
}

/** Select a nearby legal translation without preferring the authored solution. */
export function resolveSnap(
  model: SnapModel,
  pieceId: string,
  origin: Origin,
  previous: PlacementPreview | null,
  release = false,
): PlacementPreview | null {
  const piece = model.getPiece(pieceId);
  if (!piece?.localPoints.length || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return null;

  let held: PlacementPreview | null = null;
  if (previous?.valid && previous.cells.length && distance(previous, origin) <= SNAP_EXIT_DISTANCE) {
    const fresh = model.previewPlacement(pieceId, previous.cells[0], 0);
    if (fresh.valid && fresh.translation.x2 === previous.translation.x2
      && fresh.translation.y2 === previous.translation.y2) held = fresh;
  }
  // A release cannot silently substitute a different position for the shown one.
  if (release && previous) return held;

  let best: PlacementPreview | null = null;
  let bestDistance = SNAP_ENTER_DISTANCE;
  const first = piece.localPoints[0];
  // Every legal placement maps its first cell to one target cell. Enumerating
  // those anchors also finds the next nearest legal candidate beside obstacles.
  for (const anchor of model.targetCells) {
    const point = gridToPoint2(anchor);
    const candidateDistance = Math.hypot((point.x2 - first.x2) / 2 - origin.x,
      (point.y2 - first.y2) / 2 - origin.y);
    if (candidateDistance > SNAP_ENTER_DISTANCE || (best && candidateDistance >= bestDistance)) continue;
    const candidate = model.previewPlacement(pieceId, anchor, 0);
    if (!candidate.valid) continue;
    best = candidate;
    bestDistance = candidateDistance;
  }
  if (held && (!best || bestDistance + SNAP_SWITCH_MARGIN >= distance(held, origin))) return held;
  return best;
}
