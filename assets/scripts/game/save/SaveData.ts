import { HexCell } from '../domain/puzzle/LevelDefinition';

export const SCHEMA_VERSION = 1;

export interface PuzzleAttemptState {
    attemptId: string;
    levelNumber: number;
    /** pieceId -> translation */
    placements: Record<string, HexCell>;
    moves: number;
    hintsUsed: number;
    /** Extra moves granted by the challenge continue ad. */
    extraMoves: number;
    continued: boolean;
    /** Rewarded ads used in this attempt, by placement. */
    ads: Record<string, number>;
}

export interface EndlessPiece { shapeId: string; cells: HexCell[]; color: number; }

export interface EndlessRunState {
    runId: string;
    revision: number;
    rngState: number;
    /** "q,r" -> color of filled cells */
    board: Record<string, number>;
    tray: (EndlessPiece | null)[];
    score: number;
    combo: number;
    placements: number;
    undoUsed: boolean;
    continues: number;
    /** One-level snapshot before the last placement (without its own `previous`). */
    previous: Omit<EndlessRunState, 'previous'> | null;
}

export interface SaveData {
    schemaVersion: number;
    wallet: { honey: number; hints: number };
    mainline: {
        /** Cleared mainline numbers (1-based). */
        cleared: number[];
        /** levelId -> best stars for challenge levels. */
        bestStars: Record<string, number>;
        replayDay: string;
        replayCount: number;
    };
    attempt: PuzzleAttemptState | null;
    garden: { chapter: number; buildings: number[] };
    endless: { best: number; runsCreated: number; run: EndlessRunState | null; dailyDay: string; dailyGranted: number };
    /** Idempotent receipts by claim key (chapter:{c}, settle:{attemptId}, endless:{runId}, ...). */
    claims: Record<string, unknown>;
    clock: { lastDay: string };
    ads: { day: string; total: number; lastAt: number; daily: Record<string, number> };
    counters: { nextId: number };
}

export function newSave(initialHoney: number, initialHints: number, buildingCount: number): SaveData {
    return {
        schemaVersion: SCHEMA_VERSION,
        wallet: { honey: initialHoney, hints: initialHints },
        mainline: { cleared: [], bestStars: {}, replayDay: '', replayCount: 0 },
        attempt: null,
        garden: { chapter: 0, buildings: new Array(buildingCount).fill(0) },
        endless: { best: 0, runsCreated: 0, run: null, dailyDay: '', dailyGranted: 0 },
        claims: {},
        clock: { lastDay: '' },
        ads: { day: '', total: 0, lastAt: 0, daily: {} },
        counters: { nextId: 1 },
    };
}

/** Stable, save-scoped id (attempts, runs, receipts). */
export function nextId(save: SaveData, prefix: string): string {
    return `${prefix}-${save.counters.nextId++}`;
}
