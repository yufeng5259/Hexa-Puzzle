import { HexCell } from './LevelDefinition';

/** Flat-top hex corners in half-radius / half-height lattice units (x = ix·R/2, y = iy·√3R/2). */
const CORNERS: readonly [number, number][] = [[2, 0], [1, 1], [-1, 1], [-2, 0], [-1, -1], [1, -1]];

export interface LatticeEdge { a: [number, number]; b: [number, number]; }

/**
 * Outline of a cell set: edges shared by two cells cancel, leaving the outer border and inner holes
 * (block.hex.v1 boundaryEdges, arts/游戏素材/运行组件/block_hex_runtime.js).
 */
export function boundaryEdges(cells: readonly HexCell[]): LatticeEdge[] {
    const edges = new Map<string, LatticeEdge>();
    for (const { q, r } of cells) {
        const vertices = CORNERS.map(([x, y]) => [3 * q + x, 2 * r + q + y] as [number, number]);
        for (let i = 0; i < 6; i++) {
            const a = vertices[i], b = vertices[(i + 1) % 6];
            const id = [a.join(','), b.join(',')].sort().join('|');
            if (edges.has(id)) edges.delete(id);
            else edges.set(id, { a, b });
        }
    }
    return Array.from(edges.values());
}

/** Lattice point to layout point for hex radius R (same frame as PuzzleLayout.axialPoint). */
export function latticePoint(p: readonly [number, number], radius: number): { x: number; y: number } {
    return { x: p[0] * radius / 2, y: p[1] * Math.sqrt(3) * radius / 2 };
}
