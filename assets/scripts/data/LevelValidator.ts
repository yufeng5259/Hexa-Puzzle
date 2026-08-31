import { BOARD_COLUMNS, BOARD_ROWS, type LevelCatalog, type LevelData, type LevelMapDefinition, type LevelPieceData } from './LevelTypes';

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
      if (!integer(piece.tx) || !integer(piece.ty)) issues.push({ path: base, message: '拼块tx/ty必须是整数' });
      if (piece.type !== 'edit_game_elements' && piece.type !== 'edit_non_elements') issues.push({ path: `${base}.type`, message: '未知元素类型' });
      if (typeof piece.texureName !== 'string' || !texturePattern.test(piece.texureName)) issues.push({ path: `${base}.texureName`, message: '纹理键必须为1_png至18_png' });
      else textures.add(piece.texureName);
      if (!Array.isArray(piece.data) || piece.data.length === 0) { issues.push({ path: `${base}.data`, message: '拼块单元不能为空' }); return; }
      statistics.cells += piece.data.length;
      const occupied = new Set<string>();
      piece.data.forEach((cell, cellIndex) => {
        const cellPath = `${base}.data[${cellIndex}]`;
        if (!integer(cell.tx) || !integer(cell.ty) || !Number.isFinite(cell.x) || !Number.isFinite(cell.y)) issues.push({ path: cellPath, message: '单元坐标无效' });
        if (integer(cell.tx) && integer(cell.ty) && (cell.tx < 0 || cell.tx >= BOARD_COLUMNS || cell.ty < 0 || cell.ty >= BOARD_ROWS)) issues.push({ path: cellPath, message: '单元超出9 x 6棋盘' });
        const key = `${cell.tx},${cell.ty}`;
        if (occupied.has(key)) issues.push({ path: cellPath, message: '拼块内单元坐标重复' });
        occupied.add(key);
      });
    });
  });
  statistics.textureNames = [...textures].sort((a, b) => Number.parseInt(a) - Number.parseInt(b));
  return { issues, statistics };
}

export function validateCatalog(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const catalog = value as Partial<LevelCatalog>;
  if (!catalog || catalog.version !== 1 || !Array.isArray(catalog.categories)) return [{ path: '$', message: '目录版本或categories无效' }];
  const ids = new Set<string>();
  for (const category of catalog.categories) for (const map of category.maps || []) {
    if (!map.id || ids.has(map.id)) issues.push({ path: `map.${map.id}`, message: '地图ID为空或重复' });
    ids.add(map.id);
    if (!Number.isInteger(map.levelCount) || map.levelCount <= 0 || !map.resource) issues.push({ path: `map.${map.id}`, message: '地图数量或资源路径无效' });
  }
  return issues;
}

export function assertValidLevels(value: unknown, definition: LevelMapDefinition): LevelData[] {
  const result = validateLevels(value, definition.levelCount);
  if (result.issues.length) throw new Error(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  return value as LevelData[];
}
