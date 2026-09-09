export interface TrayPieceBounds { id: string; minX: number; maxX: number; minY: number; maxY: number }
export interface TrayLayout { scale: number; items: { id: string; x: number; y: number }[] }

export function layoutTray(pieces: TrayPieceBounds[], width: number, height: number, maximumScale: number): TrayLayout {
  if (!pieces.length) return { scale: maximumScale, items: [] };
  const gap = 18;
  let best: TrayLayout = { scale: 0, items: [] };
  for (let columns = 1; columns <= pieces.length; columns++) {
    const rows: TrayPieceBounds[][] = [];
    for (let offset = 0; offset < pieces.length; offset += columns) rows.push(pieces.slice(offset, offset + columns));
    const rowWidths = rows.map((row) => row.reduce((sum, piece) => sum + piece.maxX - piece.minX, 0));
    const rowHeights = rows.map((row) => Math.max(...row.map((piece) => piece.maxY - piece.minY)));
    const scale = Math.min(maximumScale,
      ...rows.map((row, index) => (width - (row.length - 1) * gap) / rowWidths[index]),
      (height - (rows.length - 1) * gap) / rowHeights.reduce((sum, value) => sum + value, 0));
    if (scale <= 0 || scale < best.scale) continue;
    const items: TrayLayout['items'] = [];
    let top = (rowHeights.reduce((sum, value) => sum + value * scale, 0) + (rows.length - 1) * gap) / 2;
    rows.forEach((row, index) => {
      const centerY = top - rowHeights[index] * scale / 2;
      let left = -(rowWidths[index] * scale + (row.length - 1) * gap) / 2;
      for (const piece of row) {
        items.push({ id: piece.id, x: left - piece.minX * scale, y: centerY - (piece.minY + piece.maxY) * scale / 2 });
        left += (piece.maxX - piece.minX) * scale + gap;
      }
      top -= rowHeights[index] * scale + gap;
    });
    best = { scale, items };
  }
  if (!best.items.length) throw new Error('Tray has no usable layout');
  return best;
}
