import { HexCell, LevelMode } from './LevelDefinition';

/** Odd-column offset coordinates in the original source to axial coordinates. */
export function offsetToAxial(tx: number, ty: number): HexCell {
    if (!Number.isSafeInteger(tx) || !Number.isSafeInteger(ty)) throw new Error('Hex coordinates must be safe integers');
    return { q: tx, r: ty - Math.floor(tx / 2) };
}

export function mainlineNumberFor(mode: LevelMode, index: number): number | null {
    if (!Number.isSafeInteger(index) || index < 1) return null;
    if (mode === 'classic' && index <= 80) return Math.floor((index - 1) / 5) * 6 + (index - 1) % 5 + 1;
    if (mode === 'challenge' && index <= 16) return index * 6;
    return null;
}

/**
 * Hex symmetry t (0–11) of an axial cell: 0 = identity, 1–5 = rotations by 60°·t, 6–11 = mirrored
 * (q, r) → (q, −q−r) and then rotated by 60°·(t−6). A symmetry keeps every solution valid.
 */
export function transformCell(cell: HexCell, t: number): HexCell {
    if (!Number.isSafeInteger(t) || t < 0 || t > 11) throw new Error('Hex transform must be 0..11');
    let q = cell.q, r = cell.r;
    if (t >= 6) r = -q - r;
    for (let i = 0; i < t % 6; i++) { const s = -q - r; q = -r; r = -s; }
    return { q: q + 0, r: r + 0 };
}
