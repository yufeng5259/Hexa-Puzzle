import type { LevelDefinition } from '../../puzzle/data/LevelDefinition';

/** Selects an existing art layout only; the question identity remains unchanged. */
export function levelRouteState(route: string, level: LevelDefinition): string | undefined {
    if (route === 'puzzle-preview') return level.mode === 'challenge' ? 'T04-01_限步关开局' : 'T01-01_普通拼图开局';
    if (route !== 'puzzle') return undefined;
    if (level.mode === 'challenge') return level.pieces.length >= 7 ? 'T05-02_限步拼图_七块托盘规格' : 'T05-01_限步异形拼图_局内';
    return level.pieces.length > 3 ? 'T02-02_普通异形拼图_六块托盘' : 'T02-01_普通异形拼图_三块';
}
