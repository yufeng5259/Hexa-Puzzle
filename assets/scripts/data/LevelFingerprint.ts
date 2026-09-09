import type { HexCellData, LevelData } from './LevelTypes';

type Point = readonly [number, number];

function point(cell: Pick<HexCellData, 'tx' | 'ty'>): Point {
  return [cell.tx, cell.ty * 2 + ((cell.tx % 2) + 2) % 2];
}

function normalize(points: Point[], origin?: Point): Point[] {
  if (!points.length) return [];
  const x = origin?.[0] ?? Math.min(...points.map((value) => value[0]));
  const y = origin?.[1] ?? Math.min(...points.map((value) => value[1]));
  return points.map(([px, py]): Point => [px - x, py - y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

// Doubled hex coordinates retain fixed orientation while ignoring presentation and translation.
export function puzzleFingerprint(level: LevelData): string {
  const active = level.filter((piece) => piece.type === 'edit_game_elements');
  const movable = active.filter((piece) => piece.texureName !== '4_png');
  const board: Point[] = [];
  const obstacles: Point[] = [];
  for (const piece of active) {
    const destination = piece.texureName === '4_png' ? obstacles : board;
    for (const cell of piece.data) destination.push(point(cell));
  }
  const all = [...board, ...obstacles];
  const origin: Point = all.length ? [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1]))] : [0, 0];
  return JSON.stringify({
    board: normalize(board, origin),
    obstacles: normalize(obstacles, origin),
    pieces: movable.map((piece) => JSON.stringify(normalize(piece.data.map(point)))).sort(),
  });
}
