import { EndlessShape, reward, RuleError, Rules } from './Rules';
import { EndlessGame, GameState, grantAndShow } from './State';
import { recordDaily } from './Daily';

/** Axial hex cell. A radius-R board holds every cell with max(|q|,|r|,|q+r|) <= R. */
export type Cell = readonly [number, number];
export const key = (q: number, r: number) => `${q},${r}`;

export function boardCells(radius: number): Cell[] {
    const cells: Cell[] = [];
    for (let q = -radius; q <= radius; q++) for (let r = -radius; r <= radius; r++) if (Math.abs(q + r) <= radius) cells.push([q, r]);
    return cells;
}

/** Every full-length line on the three axes (q, r and s = -q-r constant). */
export function boardLines(radius: number): Cell[][] {
    const cells = boardCells(radius), lines: Cell[][] = [];
    for (const axis of [0, 1, 2]) for (let v = -radius; v <= radius; v++) {
        lines.push(cells.filter(([q, r]) => (axis === 0 ? q : axis === 1 ? r : -q - r) === v));
    }
    return lines;
}

function shape(rules: Rules, id: string): EndlessShape {
    const found = rules.endless.shapes.find(s => s.id === id);
    if (!found) throw new RuleError('invalid', `Unknown shape ${id}`);
    return found;
}

function inside(radius: number, q: number, r: number): boolean { return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= radius; }

export function canPlace(game: EndlessGame, rules: Rules, shapeId: string, q: number, r: number): boolean {
    return shape(rules, shapeId).cells.every(([dq, dr]) => inside(rules.endless.radius, q + dq, r + dr) && !(key(q + dq, r + dr) in game.board));
}

export function hasAnyPlacement(game: EndlessGame, rules: Rules, shapeId: string): boolean {
    return boardCells(rules.endless.radius).some(([q, r]) => canPlace(game, rules, shapeId, q, r));
}

/** mulberry32: small seeded PRNG so a saved seed reproduces the next batch exactly. */
function next(seed: number): [number, number] {
    let t = (seed + 0x6d2b79f5) >>> 0;
    const s = t;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

function drawBatch(game: EndlessGame, rules: Rules): string[] {
    const shapes = rules.endless.shapes, total = shapes.reduce((sum, s) => sum + s.weight, 0);
    const batch: string[] = [];
    for (let i = 0; i < rules.endless.traySize; i++) {
        const [value, seed] = next(game.seed);
        game.seed = seed;
        let roll = value * total;
        batch.push((shapes.find(s => (roll -= s.weight) < 0) ?? shapes[shapes.length - 1]).id);
    }
    return batch;
}

/** Deals a new batch; up to a few redraws keep at least one shape placeable when the board allows it. */
export function refill(game: EndlessGame, rules: Rules): void {
    let batch = drawBatch(game, rules);
    for (let tries = 0; tries < 8 && !batch.some(id => hasAnyPlacement(game, rules, id)); tries++) batch = drawBatch(game, rules);
    if (!batch.some(id => hasAnyPlacement(game, rules, id))) {
        const rescue = rules.endless.shapes.filter(s => hasAnyPlacement(game, rules, s.id)).sort((a, b) => a.cells.length - b.cells.length)[0];
        if (rescue) batch[0] = rescue.id;
    }
    game.tray = batch;
}

export function isGameOver(game: EndlessGame, rules: Rules): boolean {
    return !game.tray.some(id => id !== null && hasAnyPlacement(game, rules, id));
}

export function placementScore(rules: Rules, placed: number, cleared: number, lines: number): number {
    const s = rules.endless.score;
    return s.perPlaced * placed + s.perCleared * cleared + s.perLine * lines + s.multiLine * lines * Math.max(0, lines - 1);
}

/** Resets weekly progress on a new week; the running game keeps its own score. */
export function refreshWeek(state: GameState, week: string): void {
    if (state.endless.weekId === week) return;
    state.endless.weekId = week;
    state.endless.weekScore = 0;
    state.endless.claimedStages = [];
}

export function newEndlessGame(state: GameState, rules: Rules, gameId: string, seed: number): EndlessGame {
    const game: EndlessGame = { gameId, board: {}, tray: [], score: 0, seed: seed >>> 0 };
    refill(game, rules);
    state.endless.game = game;
    return game;
}

export interface PlaceResult { readonly score: number; readonly lines: number; readonly cleared: readonly string[]; readonly refilled: boolean; readonly gameOver: boolean }

/** Places a tray shape, clears full lines, refills when the tray is empty and checks for game over. */
export function placeShape(state: GameState, rules: Rules, day: string, week: string, slot: number, q: number, r: number): PlaceResult {
    const game = state.endless.game;
    if (!game) throw new RuleError('invalid', 'No endless game');
    const shapeId = game.tray[slot];
    if (!shapeId || !canPlace(game, rules, shapeId, q, r)) throw new RuleError('invalid', 'Illegal placement');
    const piece = shape(rules, shapeId);
    for (const [dq, dr] of piece.cells) game.board[key(q + dq, r + dr)] = piece.color;
    game.tray[slot] = null;

    const full = boardLines(rules.endless.radius).filter(line => line.every(([lq, lr]) => key(lq, lr) in game.board));
    const cleared = new Set<string>();
    for (const line of full) for (const [lq, lr] of line) cleared.add(key(lq, lr));
    cleared.forEach(k => delete game.board[k]);

    const gained = placementScore(rules, piece.cells.length, cleared.size, full.length);
    game.score += gained;
    state.endless.best = Math.max(state.endless.best, game.score);
    refreshWeek(state, week);
    state.endless.weekScore += gained;
    if (game.weekId !== week) { game.weekId = week; game.weekGain = 0; }
    game.weekGain = (game.weekGain ?? 0) + gained;

    const refilled = game.tray.every(id => id === null);
    if (refilled) refill(game, rules);
    recordDaily(state, rules, day, 'endlessLines', full.length);
    recordDaily(state, rules, day, 'endlessScore', gained);
    return { score: gained, lines: full.length, cleared: [...cleared], refilled, gameOver: isGameOver(game, rules) };
}

/** Ends the game; scores already saved stay counted and no extra reward is paid. */
export function endEndlessGame(state: GameState): void { state.endless.game = null; }

export function claimEndlessStage(state: GameState, rules: Rules, week: string, index: number): void {
    refreshWeek(state, week);
    const stage = rules.endless.stages[index];
    if (!stage) throw new RuleError('invalid', `No stage ${index}`);
    if (state.endless.claimedStages.includes(index)) throw new RuleError('claimed', 'Stage already claimed');
    if (state.endless.weekScore < stage.score) throw new RuleError('locked', 'Stage score not reached');
    state.endless.claimedStages.push(index);
    grantAndShow(state, { id: `endlessStage:${week}:${index}`, type: 'endlessStage', reward: reward(rules, stage.rewardId), detail: { stage: index } });
}
