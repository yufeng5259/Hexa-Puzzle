import { BOARD_COLUMNS, BOARD_ROWS, type LevelCatalog, type LevelData, type LevelMapDefinition, type LevelMetadata, type LevelPieceData } from './LevelTypes';

export interface ValidationIssue { path: string; message: string }
export interface LevelStatistics { levels: number; pieces: number; cells: number; textureNames: string[] }

const texturePattern = /^(?:[1-9]|1[0-8])_png$/;

function integer(value: unknown): value is number {
  return Number.isInteger(value);
}

export function validateLevels(value: unknown, expectedCount?: number): { issues: ValidationIssue[]; statistics: LevelStatistics } {
  const issues: ValidationIssue[] = [];
  const statistics: LevelStatistics = { levels: 0, pieces: 0, cells: 0, textureNames: [] };
  const textures = new Set<string>();
  if (!Array.isArray(value)) return { issues: [{ path: '$', message: '关卡文件必须是数组' }], statistics };
  statistics.levels = value.length;
  if (expectedCount !== undefined && value.length !== expectedCount) issues.push({ path: '$', message: `应有${expectedCount}关，实际${value.length}关` });
  value.forEach((level, levelIndex) => {
    if (!Array.isArray(level) || level.length === 0) { issues.push({ path: `$[${levelIndex}]`, message: '关卡必须包含至少一个拼块' }); return; }
    statistics.pieces += level.length;
    level.forEach((piece: Partial<LevelPieceData>, pieceIndex) => {
      const base = `$[${levelIndex}][${pieceIndex}]`;
      if (!piece || typeof piece !== 'object') { issues.push({ path: base, message: 'Invalid piece object' }); return; }
      if (!integer(piece.tx) || !integer(piece.ty)) issues.push({ path: base, message: '拼块tx/ty必须是整数' });
      if (piece.type !== 'edit_game_elements' && piece.type !== 'edit_non_elements') issues.push({ path: `${base}.type`, message: '未知元素类型' });
      if (typeof piece.texureName !== 'string' || !texturePattern.test(piece.texureName)) issues.push({ path: `${base}.texureName`, message: '纹理键必须为1_png至18_png' });
      else textures.add(piece.texureName);
      if (!Array.isArray(piece.data) || piece.data.length === 0) { issues.push({ path: `${base}.data`, message: '拼块单元不能为空' }); return; }
      statistics.cells += piece.data.length;
      const occupied = new Set<string>();
      piece.data.forEach((cell, cellIndex) => {
        const cellPath = `${base}.data[${cellIndex}]`;
        if (!cell || typeof cell !== 'object') { issues.push({ path: cellPath, message: 'Invalid cell object' }); return; }
        if (!integer(cell.tx) || !integer(cell.ty) || !Number.isFinite(cell.x) || !Number.isFinite(cell.y)) issues.push({ path: cellPath, message: '单元坐标无效' });
        if (integer(cell.tx) && integer(cell.ty) && (cell.tx < 0 || cell.tx >= BOARD_COLUMNS || cell.ty < 0 || cell.ty >= BOARD_ROWS)) issues.push({ path: cellPath, message: '单元超出9 x 6棋盘' });
        const key = `${cell.tx},${cell.ty}`;
        if (occupied.has(key)) issues.push({ path: cellPath, message: '拼块内单元坐标重复' });
        occupied.add(key);
      });
    });
  });
  statistics.textureNames = Array.from(textures).sort((a, b) => Number.parseInt(a) - Number.parseInt(b));
  return { issues, statistics };
}

export function validateCatalog(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const catalog = value as Partial<LevelCatalog>;
  if (!catalog || catalog.version !== 1 || !Array.isArray(catalog.categories)) return [{ path: '$', message: '目录版本或categories无效' }];
  const ids = new Set<string>();
  const levelIds = new Set<string>();
  for (const category of catalog.categories) {
    if (!category || !Array.isArray(category.maps)) { issues.push({ path: 'categories', message: 'Invalid map category' }); continue; }
    for (const map of category.maps) {
      if (!map || typeof map !== 'object') { issues.push({ path: 'categories.maps', message: 'Invalid map definition' }); continue; }
      if (typeof map.id !== 'string' || !map.id || ids.has(map.id)) issues.push({ path: `map.${map.id}`, message: '地图ID为空或重复' });
      ids.add(map.id);
      if (!Number.isInteger(map.levelCount) || map.levelCount <= 0 || typeof map.resource !== 'string' || !map.resource) issues.push({ path: `map.${map.id}`, message: '地图数量或资源路径无效' });
      if (map.mode !== undefined && map.mode !== 'relaxed' && map.mode !== 'challenge') issues.push({ path: `map.${map.id}.mode`, message: 'Invalid game mode' });
      if (map.pageSize !== undefined && (!integer(map.pageSize) || map.pageSize < 1 || map.pageSize > 20)) issues.push({ path: `map.${map.id}.pageSize`, message: 'Invalid page size' });
      if (map.metadataResource !== undefined && (typeof map.metadataResource !== 'string' || !map.metadataResource)) issues.push({ path: `map.${map.id}.metadataResource`, message: 'Missing metadata resource' });
      if (map.levelIds !== undefined) {
        if (!Array.isArray(map.levelIds) || map.levelIds.length !== map.levelCount) {
          issues.push({ path: `map.${map.id}.levelIds`, message: 'Level IDs must match the catalog count' });
        } else for (const id of map.levelIds) {
          if (typeof id !== 'string' || !id || levelIds.has(id)) issues.push({ path: `map.${map.id}.levelIds`, message: 'Empty or duplicate stable level ID' });
          levelIds.add(id);
        }
      }
    }
  }
  return issues;
}

export function validateLevelMetadata(value: unknown, map: LevelMapDefinition, levels: LevelData[]): ValidationIssue[] {
  if (!Array.isArray(value) || value.length !== map.levelCount) return [{ path: '$', message: 'Metadata count does not match catalog' }];
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  value.forEach((raw, index) => {
    const base = `$[${index}]`;
    if (!raw || typeof raw !== 'object') { issues.push({ path: base, message: 'Invalid metadata object' }); return; }
    const entry = raw as Partial<LevelMetadata>;
    const pieces = (levels[index] ?? []).filter((piece) => piece.type === 'edit_game_elements' && piece.texureName !== '4_png');
    if (typeof entry.levelId !== 'string' || !entry.levelId || ids.has(entry.levelId) || (map.levelIds && entry.levelId !== map.levelIds[index])) issues.push({ path: `${base}.levelId`, message: 'Stable level ID mismatch' });
    if (entry.levelId) ids.add(entry.levelId);
    if ((entry.mode !== 'relaxed' && entry.mode !== 'challenge') || entry.mode !== map.mode || !integer(entry.contentVersion) || entry.contentVersion < 1) issues.push({ path: base, message: 'Invalid mode or content version' });
    if (entry.pieceCount !== pieces.length || entry.perfectMoveTarget !== pieces.length) issues.push({ path: base, message: 'Piece count or perfect target mismatch' });
    if (entry.mode === 'relaxed' ? entry.moveLimit !== null : !integer(entry.moveLimit) || entry.moveLimit < pieces.length) issues.push({ path: `${base}.moveLimit`, message: 'Invalid move budget' });
    if (!Array.isArray(entry.solutionWitness) || entry.solutionWitness.length !== pieces.length) {
      issues.push({ path: `${base}.solutionWitness`, message: 'Witness must place every movable piece' });
      return;
    }
    const witnessed = new Set<string>();
    for (const step of entry.solutionWitness) {
      const pieceIndex = step && pieces.findIndex((piece, i) => step.pieceId === `piece-${i}-${piece.texureName}`);
      if (!step || pieceIndex === undefined || pieceIndex < 0 || witnessed.has(step.pieceId) || !integer(step.anchorIndex) || step.anchorIndex < 0 || step.anchorIndex >= pieces[pieceIndex].data.length
        || !step.anchor || !integer(step.anchor.tx) || !integer(step.anchor.ty) || step.anchor.tx < 0 || step.anchor.tx >= BOARD_COLUMNS || step.anchor.ty < 0 || step.anchor.ty >= BOARD_ROWS) {
        issues.push({ path: `${base}.solutionWitness`, message: 'Invalid witness step' });
      } else witnessed.add(step.pieceId);
    }
  });
  return issues;
}

export function assertValidLevels(value: unknown, definition: LevelMapDefinition): LevelData[] {
  const result = validateLevels(value, definition.levelCount);
  if (result.issues.length) throw new Error(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  return value as LevelData[];
}
