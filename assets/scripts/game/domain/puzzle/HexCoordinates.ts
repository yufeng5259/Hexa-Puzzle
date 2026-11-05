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
