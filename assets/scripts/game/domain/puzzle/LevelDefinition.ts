/** Immutable source question data. These contracts contain no player state. */
export interface HexCell { readonly q: number; readonly r: number; }
export type LevelMode = 'classic' | 'challenge';
export interface LevelPieceDefinition {
    readonly id: string;
    readonly textureName: string;
    readonly cells: readonly HexCell[];
    readonly targetCells: readonly HexCell[];
}
export interface LevelDefinition {
    readonly id: string;
    readonly mode: LevelMode;
    readonly index: number;
    readonly mainlineNumber: number | null;
    readonly pieces: readonly LevelPieceDefinition[];
    readonly targetCells: readonly HexCell[];
    readonly obstacleCells: readonly HexCell[];
    readonly moveLimit: number | null;
}
export interface LevelCatalogData {
    readonly schema: 'hexa.level-catalog.v1';
    readonly sources: readonly { readonly path: string; readonly sha256: string }[];
    readonly levels: readonly LevelDefinition[];
}
