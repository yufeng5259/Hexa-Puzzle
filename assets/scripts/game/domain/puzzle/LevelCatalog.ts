import { HexCell, LevelCatalogData, LevelDefinition, LevelPieceDefinition } from './LevelDefinition';
import { mainlineNumberFor } from './HexCoordinates';
export * from './LevelDefinition';
export { mainlineNumberFor, offsetToAxial } from './HexCoordinates';

function fail(path: string): never { throw new Error('Invalid level catalog: ' + path); }
function record(value: unknown, keys: string[], path: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(path);
    const actual = Object.keys(value);
    if (actual.length !== keys.length || actual.some(key => keys.indexOf(key) < 0)) return fail(path + ' fields');
    return value as Record<string, unknown>;
}
const key = (cell: HexCell) => cell.q + ',' + cell.r;
function cells(value: unknown, path: string, allowEmpty = false): readonly HexCell[] {
    if (!Array.isArray(value) || (!allowEmpty && !value.length)) return fail(path);
    const seen = new Set<string>();
    return Object.freeze(value.map((input, index) => {
        const item = record(input, ['q', 'r'], path + '[' + index + ']');
        if (!Number.isSafeInteger(item.q) || !Number.isSafeInteger(item.r)) return fail(path + ' integer');
        const cell = Object.freeze({ q: item.q as number, r: item.r as number });
        if (seen.has(key(cell))) return fail(path + ' duplicate');
        seen.add(key(cell));
        return cell;
    }));
}
function piece(value: unknown, path: string, index: number): LevelPieceDefinition {
    const input = record(value, ['id', 'textureName', 'cells', 'targetCells'], path);
    if (typeof input.textureName !== 'string' || !/^(1|3|6|7|8|9|10|11|12|13|16|17)_png$/.test(input.textureName)) return fail(path + ' texture');
    if (input.id !== 'piece-' + index + '-' + input.textureName) return fail(path + ' identity');
    const local = cells(input.cells, path + '.cells'), target = cells(input.targetCells, path + '.targetCells');
    if (local.length !== target.length || local[0].q !== 0 || local[0].r !== 0) return fail(path + ' anchor');
    const anchor = target[0];
    if (local.some((cell, i) => cell.q + anchor.q !== target[i].q || cell.r + anchor.r !== target[i].r)) return fail(path + ' local/target transform');
    return Object.freeze({ id: input.id as string, textureName: input.textureName, cells: local, targetCells: target });
}
function level(value: unknown, ordinal: number): LevelDefinition {
    const path = 'levels[' + ordinal + ']';
    const input = record(value, ['id', 'mode', 'index', 'mainlineNumber', 'pieces', 'targetCells', 'obstacleCells', 'moveLimit'], path);
    if (input.mode !== 'classic' && input.mode !== 'challenge') return fail(path + ' mode');
    const max = input.mode === 'classic' ? 80 : 30;
    if (!Number.isSafeInteger(input.index) || (input.index as number) < 1 || (input.index as number) > max) return fail(path + ' index');
    const index = input.index as number;
    if (input.id !== input.mode + '-' + ('000' + index).slice(-3)) return fail(path + ' identity');
    if (input.mainlineNumber !== mainlineNumberFor(input.mode, index)) return fail(path + ' mainline');
    if (input.mode === 'classic' ? input.moveLimit !== null : !Number.isSafeInteger(input.moveLimit) || (input.moveLimit as number) < 1) return fail(path + ' moveLimit');
    if (!Array.isArray(input.pieces) || input.pieces.length < 1) return fail(path + ' pieces');
    const pieces = Object.freeze(input.pieces.map((item, i) => piece(item, path + '.pieces[' + i + ']', i)));
    const target = cells(input.targetCells, path + '.targetCells'), obstacles = cells(input.obstacleCells, path + '.obstacleCells', true);
    const occupied = new Set<string>();
    for (const part of pieces) for (const cell of part.targetCells) {
        if (occupied.has(key(cell))) return fail(path + ' overlapping pieces');
        occupied.add(key(cell));
    }
    if (occupied.size !== target.length || target.some(cell => !occupied.has(key(cell)))) return fail(path + ' target union');
    if (obstacles.some(cell => occupied.has(key(cell)))) return fail(path + ' overlapping obstacle');
    return Object.freeze({ id: input.id as string, mode: input.mode, index, mainlineNumber: input.mainlineNumber as number | null,
        pieces, targetCells: target, obstacleCells: obstacles, moveLimit: input.moveLimit as number | null });
}

/** Strict immutable question catalog. Reserved questions have no product map number. */
export class LevelCatalog {
    readonly levels: readonly LevelDefinition[];
    readonly mainline: readonly LevelDefinition[];
    readonly sources: LevelCatalogData['sources'];
    private readonly byId = new Map<string, LevelDefinition>();

    constructor(json: unknown) {
        const input = record(json, ['schema', 'sources', 'levels'], 'root');
        if (input.schema !== 'hexa.level-catalog.v1') return fail('schema');
        if (!Array.isArray(input.sources) || input.sources.length !== 2) return fail('sources');
        this.sources = Object.freeze(input.sources.map((value, index) => {
            const source = record(value, ['path', 'sha256'], 'sources[' + index + ']');
            if (source.path !== ['prototype/level-data.js', 'prototype/mainline.js'][index] || typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(source.sha256)) return fail('source provenance');
            return Object.freeze({ path: source.path as string, sha256: source.sha256 });
        }));
        if (!Array.isArray(input.levels) || input.levels.length !== 110) return fail('expected 110 source questions');
        this.levels = Object.freeze(input.levels.map(level));
        const mainline: LevelDefinition[] = [];
        for (const entry of this.levels) {
            if (this.byId.has(entry.id)) return fail('duplicate level ' + entry.id);
            this.byId.set(entry.id, entry);
            if (entry.mainlineNumber !== null) {
                if (mainline[entry.mainlineNumber - 1]) return fail('duplicate mainline');
                mainline[entry.mainlineNumber - 1] = entry;
            }
        }
        if (mainline.length !== 96 || Array.from({ length: 96 }, (_, i) => !mainline[i]).some(Boolean)) return fail('incomplete mainline');
        this.mainline = Object.freeze(mainline);
    }

    getMainline(number: number): LevelDefinition {
        if (!Number.isSafeInteger(number) || number < 1 || number > 96) throw new Error('Mainline number must be 1..96');
        return this.mainline[number - 1];
    }

    getById(id: string): LevelDefinition {
        const entry = this.byId.get(id);
        if (!entry) throw new Error('Unknown level id: ' + id);
        return entry;
    }
}
