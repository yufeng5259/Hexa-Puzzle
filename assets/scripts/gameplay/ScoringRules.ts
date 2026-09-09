import type { GameMode } from '../data/LevelTypes';

export interface ScoringTargets {
  hintTarget: number;
  errorTarget: number;
}

export interface ScoringInput {
  completed: boolean;
  pieceCount: number;
  hintsUsed: number;
  errors: number;
  mode?: GameMode;
  moves?: number;
  continuesUsed?: number;
  perfectMoveTarget?: number;
  targets?: Partial<ScoringTargets> | null;
}

export interface ScoringResult {
  stars: 0 | 1 | 2 | 3;
  targets: ScoringTargets;
  completed: boolean;
  unassisted: boolean;
}

function boundedCount(value: unknown, fallback: number): number {
  return Number.isInteger(value) && (value as number) >= 0 ? value as number : fallback;
}

export function defaultScoringTargets(pieceCount: number): ScoringTargets {
  const boundedPieces = Math.max(0, Math.floor(pieceCount));
  return {
    hintTarget: boundedPieces >= 5 ? 1 : 0,
    errorTarget: Math.max(0, boundedPieces - 4),
  };
}

export function resolveScoringTargets(pieceCount: number, overrides?: Partial<ScoringTargets> | null): ScoringTargets {
  const defaults = defaultScoringTargets(pieceCount);
  return {
    hintTarget: boundedCount(overrides?.hintTarget, defaults.hintTarget),
    errorTarget: boundedCount(overrides?.errorTarget, defaults.errorTarget),
  };
}

export function scoreCompletion(input: ScoringInput): ScoringResult {
  const targets = resolveScoringTargets(input.pieceCount, input.targets);
  if (!input.completed) return { stars: 0, targets, completed: false, unassisted: false };
  const hintsUsed = boundedCount(input.hintsUsed, Number.MAX_SAFE_INTEGER);
  const continuesUsed = boundedCount(input.continuesUsed ?? 0, Number.MAX_SAFE_INTEGER);
  const unassisted = hintsUsed === 0 && continuesUsed === 0;
  if (input.mode !== 'challenge') return { stars: 0, targets, completed: true, unassisted };
  const moves = boundedCount(input.moves, Number.MAX_SAFE_INTEGER);
  const perfect = boundedCount(input.perfectMoveTarget, input.pieceCount);
  const stars = continuesUsed > 0 ? 1 : unassisted && moves <= perfect ? 3 : 2;
  return { stars, targets, completed: true, unassisted };
}
