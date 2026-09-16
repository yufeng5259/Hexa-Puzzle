interface Point { x: number; y: number }
export interface TrayDropBounds { minX: number; maxX: number; minY: number; maxY: number }

// Game-root design units, independent of the size used to lay out tray pieces.
export const TRAY_DROP_PADDING = 12;

export function isTrayDrop(pointer: Point, cells: readonly Point[], bounds: TrayDropBounds, hasBoardCandidate = false): boolean {
  const finite = (point: Point) => Number.isFinite(point.x) && Number.isFinite(point.y);
  if (!cells.length || !finite(pointer) || !cells.every(finite)
    || ![bounds.minX, bounds.maxX, bounds.minY, bounds.maxY].every(Number.isFinite)
    || bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) return false;
  const contains = (point: Point) => point.x >= bounds.minX - TRAY_DROP_PADDING
    && point.x <= bounds.maxX + TRAY_DROP_PADDING
    && point.y >= bounds.minY - TRAY_DROP_PADDING && point.y <= bounds.maxY + TRAY_DROP_PADDING;
  // A lifted piece can be inside while the finger is below the panel. Count real
  // cells rather than the node pivot or empty corners of an irregular shape.
  // Finger position alone must not override a legal board snap: a long piece
  // held near its bottom can cover the board while its lifted finger is in the tray.
  return cells.filter(contains).length >= Math.ceil(cells.length / 2)
    || (!hasBoardCandidate && contains(pointer));
}
