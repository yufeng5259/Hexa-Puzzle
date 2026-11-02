/** Shared display/hit-test coordinates. Flat-top axial cells; positive y points up. */
export interface AxialCell { q: number; r: number; }
export interface Point2 { x: number; y: number; }
export interface HexFit { radius: number; width: number; height: number; centers: Point2[]; }
export interface TrayFit { columns: number; rows: number; radius: number; pieces: (HexFit & { position: Point2 })[]; }
const ROOT3 = Math.sqrt(3);

export function axialPoint(cell: AxialCell, radius: number): Point2 {
    return { x: 1.5 * radius * cell.q, y: ROOT3 * radius * (cell.r + cell.q / 2) };
}
export function axialFromPoint(point: Point2, radius: number): Point2 {
    if (!(radius > 0)) throw new Error('PuzzleLayout: radius must be positive');
    return { x: point.x * 2 / (3 * radius), y: point.y / (ROOT3 * radius) - point.x / (3 * radius) };
}
/** Cube rounding keeps all six edges symmetric, including negative coordinates. */
export function nearestAxial(point: Point2, radius: number): AxialCell {
    const axial = axialFromPoint(point, radius), x = axial.x, z = axial.y, y = -x - z;
    let q = Math.round(x), r = Math.round(z), s = Math.round(y);
    const dx = Math.abs(q - x), dz = Math.abs(r - z), dy = Math.abs(s - y);
    if (dx > dy && dx > dz) q = -s - r;
    else if (dy > dz) s = -q - r;
    else r = -q - s;
    return { q: q === 0 ? 0 : q, r: r === 0 ? 0 : r };
}
/** Exact flat-top hex containment, rather than its rectangular touch bounds. */
export function insideHex(point: Point2, radius: number): boolean {
    const x = Math.abs(point.x), y = Math.abs(point.y), epsilon = 1e-7;
    return x <= radius + epsilon && y <= ROOT3 * radius / 2 + epsilon
        && ROOT3 * x + y <= ROOT3 * radius + epsilon;
}
export function pieceCenter(cells: readonly AxialCell[], radius: number): Point2 {
    const raw = axialPoint(cells[0], radius), centered = centeredCells(cells, radius).centers[0];
    return { x: raw.x - centered.x, y: raw.y - centered.y };
}
export function assertCells(cells: readonly AxialCell[]): void {
    if (!cells.length || cells.some(cell => !Number.isSafeInteger(cell.q) || !Number.isSafeInteger(cell.r))
        || new Set(cells.map(cell => `${cell.q},${cell.r}`)).size !== cells.length) {
        throw new Error('PuzzleLayout: cells must be nonempty unique integer axial coordinates');
    }
}
export function centeredCells(cells: readonly AxialCell[], radius: number): HexFit {
    assertCells(cells);
    if (!(radius > 0) || !Number.isFinite(radius)) throw new Error('PuzzleLayout: radius must be finite and positive');
    const points = cells.map(cell => axialPoint(cell, radius));
    const minX = Math.min(...points.map(p => p.x)) - radius, maxX = Math.max(...points.map(p => p.x)) + radius;
    const minY = Math.min(...points.map(p => p.y)) - ROOT3 * radius / 2, maxY = Math.max(...points.map(p => p.y)) + ROOT3 * radius / 2;
    return { radius, width: maxX - minX, height: maxY - minY,
        centers: points.map(p => ({ x: p.x - (minX + maxX) / 2, y: p.y - (minY + maxY) / 2 })) };
}
export function fitCells(cells: readonly AxialCell[], width: number, height: number, padding = 0): HexFit {
    const unit = centeredCells(cells, 1);
    if (![width, height, padding].every(Number.isFinite) || padding < 0 || width <= padding * 2 || height <= padding * 2) {
        throw new Error('PuzzleLayout: bounds must be finite, positive and larger than padding');
    }
    return centeredCells(cells, Math.min((width - padding * 2) / unit.width, (height - padding * 2) / unit.height));
}
/** Shared radius preserves piece proportions; vacant final-row slots stay empty. */
export function fitTray(pieces: readonly { cells: readonly AxialCell[] }[], width: number, height: number, gap = 12, padding = 8): TrayFit {
    if (!pieces.length || pieces.length > 7) throw new Error('PuzzleLayout: tray supports one through seven pieces');
    const columns = pieces.length <= 3 ? pieces.length : pieces.length === 7 ? 4 : 3;
    const rows = pieces.length <= 3 ? 1 : 2;
    if (![width, height, gap, padding].every(Number.isFinite) || gap < 0 || padding < 0) throw new Error('PuzzleLayout: invalid tray dimensions');
    const slotWidth = (width - 2 * padding - gap * (columns - 1)) / columns;
    const slotHeight = (height - 2 * padding - gap * (rows - 1)) / rows;
    const radius = Math.min(...pieces.map(piece => fitCells(piece.cells, slotWidth, slotHeight).radius));
    return { columns, rows, radius, pieces: pieces.map((piece, i) => ({ ...centeredCells(piece.cells, radius),
        position: { x: -width / 2 + padding + slotWidth / 2 + (i % columns) * (slotWidth + gap),
            y: height / 2 - padding - slotHeight / 2 - Math.floor(i / columns) * (slotHeight + gap) } })) };
}
