import { coordKey, type GridCoord } from '../model/HexGrid';

/** Matches CellVisual's clockwise edges: top, upper-right, lower-right, bottom, lower-left, upper-left. */
export function exposedBoardEdges(coord: GridCoord, occupied: ReadonlySet<string>): boolean[] {
  const upperRow = coord.ty - (coord.tx % 2 === 0 ? 1 : 0);
  const lowerRow = upperRow + 1;
  return [
    { tx: coord.tx, ty: coord.ty - 1 },
    { tx: coord.tx + 1, ty: upperRow },
    { tx: coord.tx + 1, ty: lowerRow },
    { tx: coord.tx, ty: coord.ty + 1 },
    { tx: coord.tx - 1, ty: lowerRow },
    { tx: coord.tx - 1, ty: upperRow },
  ].map((neighbor) => !occupied.has(coordKey(neighbor)));
}
