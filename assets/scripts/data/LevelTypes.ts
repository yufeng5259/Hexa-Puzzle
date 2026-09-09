export const BOARD_COLUMNS = 9;
export const BOARD_ROWS = 6;
export const TILE_WIDTH = 115;
export const TILE_HEIGHT = 103;
export const TILE_OVERLAP_X = 26;
export const DRAG_SCALE = 0.83;
export const TRAY_SCALE = 0.4;

export type LevelElementType = 'edit_game_elements' | 'edit_non_elements';

export interface HexCellData {
  x: number;
  y: number;
  tx: number;
  ty: number;
}

export interface LevelPieceData {
  tx: number;
  ty: number;
  data: HexCellData[];
  texureName: string;
  x: number;
  y: number;
  type: LevelElementType;
}

export type LevelData = LevelPieceData[];

export type GameMode = 'relaxed' | 'challenge';

export interface SolutionStep {
  pieceId: string;
  anchor: { tx: number; ty: number };
  anchorIndex: number;
}

export interface LevelMetadata {
  levelId: string;
  mode: GameMode;
  contentVersion: number;
  pieceCount: number;
  moveLimit: number | null;
  perfectMoveTarget: number;
  solutionWitness: SolutionStep[];
}

export interface LevelMapDefinition {
  id: string;
  name: string;
  description: string;
  levelCount: number;
  resource: string;
  mode?: GameMode;
  pageSize?: number;
  metadataResource?: string;
  levelIds?: string[];
}

export interface LevelCategoryDefinition {
  id: string;
  name: string;
  maps: LevelMapDefinition[];
}

export interface LevelCatalog {
  version: number;
  categories: LevelCategoryDefinition[];
}
