import { BOARD_COLUMNS, BOARD_ROWS, TILE_HEIGHT, TILE_OVERLAP_X, TILE_WIDTH } from '../data/LevelTypes';

export interface GridCoord { tx: number; ty: number }
export interface GridPoint2 { x2: number; y2: number }

const spacingX = TILE_WIDTH - TILE_OVERLAP_X;

export function coordKey(coord: GridCoord): string { return `${coord.tx},${coord.ty}`; }
export function pointKey(point: GridPoint2): string { return `${point.x2},${point.y2}`; }
export function isBoardCoord(coord: GridCoord): boolean {
  return Number.isInteger(coord.tx) && Number.isInteger(coord.ty) && coord.tx >= 0 && coord.tx < BOARD_COLUMNS && coord.ty >= 0 && coord.ty < BOARD_ROWS;
}
export function gridToPoint2(coord: GridCoord): GridPoint2 {
  return { x2: coord.tx * spacingX * 2, y2: coord.ty * TILE_HEIGHT * 2 + (coord.tx % 2 === 0 ? 0 : TILE_HEIGHT) };
}

export const BOARD_COORDS: readonly GridCoord[] = Object.freeze(Array.from({ length: BOARD_COLUMNS * BOARD_ROWS }, (_, index) => ({ tx: Math.floor(index / BOARD_ROWS), ty: index % BOARD_ROWS })));
const pointLookup = new Map(BOARD_COORDS.map((coord) => [pointKey(gridToPoint2(coord)), coord]));
export function point2ToGrid(point: GridPoint2): GridCoord | null { return pointLookup.get(pointKey(point)) ?? null; }

export function nearestGrid(point: { x: number; y: number }): GridCoord {
  let nearest = BOARD_COORDS[0];
  let distance = Number.POSITIVE_INFINITY;
  for (const coord of BOARD_COORDS) {
    const candidate = gridToPoint2(coord);
    const dx = candidate.x2 / 2 - point.x;
    const dy = candidate.y2 / 2 - point.y;
    const current = dx * dx + dy * dy;
    if (current < distance) { distance = current; nearest = coord; }
  }
  return nearest;
}
