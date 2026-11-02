import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { PROTOTYPE, PROJECT, assetJson, sha256 } from './io.mjs';

export const LEVEL_CATALOG_PATH = 'assets/bundles/puzzle/config/level-catalog.json';

/** Read literal level JSON; this file is never executed. */
export function readSourceLevels(source) {
    const match = /^\s*\/\/[^\r\n]*\r?\nwindow\.BeeLevels\s*=\s*(\{[\s\S]*\})\s*;\s*$/.exec(source);
    if (!match) throw new Error('Expected the source BeeLevels literal snapshot');
    const result = JSON.parse(match[1]);
    if (!result || !Array.isArray(result.classic) || result.classic.length !== 80 || !Array.isArray(result.challenge) || result.challenge.length !== 30) throw new Error('Expected 80 classic and 30 challenge source questions');
    return result;
}

/** Isolated source map evaluation: no module, file system, network or host globals. */
export function readSourceMainline(source) {
    const sandbox = Object.create(null);
    const serialized = vm.runInNewContext(source + '\nJSON.stringify(BeeMainline.levels)', sandbox, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
    const rows = JSON.parse(serialized);
    if (!Array.isArray(rows) || rows.length !== 96) throw new Error('Expected exactly 96 mainline rows');
    const identities = new Set();
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i], group = Math.floor(i / 6), challenge = i % 6 === 5;
        if (row.number !== i + 1 || row.mode !== (challenge ? 'challenge' : 'classic') || row.index !== (challenge ? group + 1 : group * 5 + i % 6 + 1)) throw new Error('Unexpected source mainline mapping at ' + (i + 1));
        const key = row.mode + ':' + row.index;
        if (identities.has(key)) throw new Error('Duplicate source mainline identity');
        identities.add(key);
    }
    return rows;
}

const axial = cell => {
    if (!cell || !Number.isSafeInteger(cell.tx) || !Number.isSafeInteger(cell.ty)) throw new Error('Source coordinates must be safe integers');
    return { q: cell.tx, r: cell.ty - Math.floor(cell.tx / 2) };
};

export function buildLevelCatalog(levelSource, mainlineSource) {
    const source = readSourceLevels(levelSource), mainline = readSourceMainline(mainlineSource);
    const mapping = new Map(mainline.map(row => [row.mode + ':' + row.index, row.number]));
    const levels = [];
    for (const mode of ['classic', 'challenge']) for (const question of source[mode]) {
        const { meta } = question;
        if (!meta || meta.levelId !== mode + '-' + String(question.index).padStart(3, '0') || meta.mode !== (mode === 'classic' ? 'relaxed' : 'challenge')) throw new Error('Unexpected source question identity');
        const movable = question.raw.filter(part => part.type === 'edit_game_elements' && part.texureName !== '4_png');
        if (movable.length !== meta.pieceCount || meta.solutionWitness.length !== movable.length) throw new Error('Source piece metadata mismatch: ' + meta.levelId);
        const pieces = movable.map((part, index) => {
            const witness = meta.solutionWitness[index], expectedId = 'piece-' + index + '-' + part.texureName;
            if (witness.pieceId !== expectedId || witness.anchorIndex !== 0 || witness.anchor.tx !== part.data[0].tx || witness.anchor.ty !== part.data[0].ty) throw new Error('Source piece witness mismatch: ' + meta.levelId);
            const targetCells = part.data.map(axial), anchor = axial(witness.anchor);
            return { id: witness.pieceId, textureName: part.texureName,
                cells: targetCells.map(cell => ({ q: cell.q - anchor.q, r: cell.r - anchor.r })), targetCells };
        });
        levels.push({ id: meta.levelId, mode, index: question.index, mainlineNumber: mapping.get(mode + ':' + question.index) ?? null,
            pieces, targetCells: pieces.flatMap(part => part.targetCells),
            obstacleCells: question.raw.filter(part => part.type === 'edit_game_elements' && part.texureName === '4_png').flatMap(part => part.data.map(axial)),
            moveLimit: meta.moveLimit });
    }
    return { schema: 'hexa.level-catalog.v1', sources: [
        { path: 'prototype/level-data.js', sha256: sha256(levelSource) },
        { path: 'prototype/mainline.js', sha256: sha256(mainlineSource) },
    ], levels };
}

/** Returns byte-stable formal data. A caller may enroll output in its own managed writer. */
export function exportLevels({ write = false } = {}) {
    const data = buildLevelCatalog(fs.readFileSync(path.join(PROTOTYPE, 'level-data.js'), 'utf8'), fs.readFileSync(path.join(PROTOTYPE, 'mainline.js'), 'utf8'));
    if (write) assetJson(LEVEL_CATALOG_PATH, data);
    return data;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const data = exportLevels({ write: true });
    console.log(JSON.stringify({ path: path.join(PROJECT, LEVEL_CATALOG_PATH), questions: data.levels.length, mainline: data.levels.filter(entry => entry.mainlineNumber !== null).length, reserved: data.levels.filter(entry => entry.mainlineNumber === null).length }));
}
