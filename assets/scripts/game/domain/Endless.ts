import { SeededRandom } from '../../framework/core/SeededRandom';
import { EconomyConfig } from '../config/EconomyConfig';
import { EndlessPiece, EndlessRunState, nextId, SaveData } from '../save/SaveData';
import { SaveService } from '../save/SaveService';
import { HexCell } from './puzzle/LevelDefinition';
import { recordActivity } from './Activity';
import { addHoney } from './Wallet';

type Endless = EconomyConfig['endless'];
const key = (c: HexCell): string => c.q + ',' + c.r;

/** Axial hexagon of the given radius: |q|, |r|, |q+r| ≤ radius (37 cells for radius 3, F030). */
export function boardCells(radius: number): HexCell[] {
    const cells: HexCell[] = [];
    for (let q = -radius; q <= radius; q++) {
        for (let r = -radius; r <= radius; r++) if (Math.abs(q + r) <= radius) cells.push({ q, r });
    }
    return cells;
}

/** Full lines on the three axes (q, r, s = -q-r), 7 per axis for radius 3. */
export function boardLines(radius: number): HexCell[][] {
    const cells = boardCells(radius);
    const lines: HexCell[][] = [];
    for (let v = -radius; v <= radius; v++) {
        lines.push(cells.filter(c => c.q === v), cells.filter(c => c.r === v), cells.filter(c => -c.q - c.r === v));
    }
    return lines;
}

/** Shape rotated by `turns` × 60°, translated so its first cell is the anchor (0,0). */
export function orient(cells: readonly [number, number][], turns: number): HexCell[] {
    let out = cells.map(([q, r]) => ({ q, r }));
    for (let i = 0; i < turns; i++) out = out.map(c => ({ q: -c.r, r: c.q + c.r }));
    const first = out[0];
    return out.map(c => ({ q: c.q - first.q, r: c.r - first.r }));
}

export function fits(run: Readonly<EndlessRunState>, cfg: Endless, piece: EndlessPiece, anchor: HexCell): boolean {
    return piece.cells.every(c => {
        const q = c.q + anchor.q, r = c.r + anchor.r;
        return Math.abs(q) <= cfg.radius && Math.abs(r) <= cfg.radius && Math.abs(q + r) <= cfg.radius && run.board[q + ',' + r] === undefined;
    });
}

/** Some remaining tray piece can be placed somewhere (F033). */
export function hasMove(run: Readonly<EndlessRunState>, cfg: Endless): boolean {
    const cells = boardCells(cfg.radius);
    return run.tray.some(piece => piece !== null && cells.some(anchor => fits(run, cfg, piece, anchor)));
}

function roll(rng: SeededRandom, cfg: Endless): EndlessPiece {
    const shape = rng.weighted(cfg.shapes, s => s.weight);
    return { shapeId: shape.id, cells: orient(shape.cells, rng.range(6)), color: rng.range(cfg.colors) };
}

/** Deals a full tray from the run's RNG state; re-rolls so at least one piece fits (06 E08). */
export function deal(run: EndlessRunState, cfg: Endless): void {
    const rng = new SeededRandom(run.rngState);
    for (let attempt = 0; attempt < cfg.dealRetries; attempt++) {
        run.tray = Array.from({ length: cfg.trayCount }, () => roll(rng, cfg));
        if (hasMove(run, cfg)) break;
    }
    run.rngState = rng.seed;
}

/** New run (F029): the first runs use fixed seeds, counted by runs created. */
export function createRun(draft: SaveData, cfg: Endless, randomSeed: number): EndlessRunState {
    const fixed = cfg.fixedSeeds[draft.endless.runsCreated];
    const run: EndlessRunState = { runId: nextId(draft, 'run'), revision: 0, rngState: fixed ?? randomSeed, board: {}, tray: [], score: 0, combo: 0,
        placements: 0, undoUsed: false, continues: 0, previous: null };
    deal(run, cfg);
    draft.endless.runsCreated++;
    draft.endless.run = run;
    return run;
}

export interface PlacementResult {
    placed: HexCell[];
    cleared: HexCell[];
    lines: number;
    cellScore: number;
    lineScore: number;
    comboScore: number;
    dealt: boolean;
}

function snapshot(run: EndlessRunState): Omit<EndlessRunState, 'previous'> {
    const { previous: _previous, ...rest } = run;
    return JSON.parse(JSON.stringify(rest));
}

/** Place tray[slot] at anchor, clear the union of full lines, score (F030/F031). D01: combo +comboScore × combo from the 2nd. */
export function place(run: EndlessRunState, cfg: Endless, slot: number, anchor: HexCell): PlacementResult {
    const piece = run.tray[slot];
    if (!piece) throw new Error('Empty tray slot ' + slot);
    if (!fits(run, cfg, piece, anchor)) throw new Error('Piece does not fit');
    const before = snapshot(run);
    const placed = piece.cells.map(c => ({ q: c.q + anchor.q, r: c.r + anchor.r }));
    for (const c of placed) run.board[key(c)] = piece.color;
    const full = boardLines(cfg.radius).filter(line => line.every(c => run.board[key(c)] !== undefined));
    const clearedKeys = new Set<string>();
    for (const line of full) for (const c of line) clearedKeys.add(key(c));
    const cleared = Array.from(clearedKeys, k => { const [q, r] = k.split(',').map(Number); return { q, r }; });
    for (const k of clearedKeys) delete run.board[k];
    const n = full.length;
    run.combo = n > 0 ? run.combo + 1 : 0;
    const cellScore = cfg.cellScore * placed.length;
    const lineScore = cfg.lineScore * n + cfg.multiLineScore * n * (n - 1);
    const comboScore = run.combo >= 2 ? cfg.comboScore * run.combo : 0;
    run.score += cellScore + lineScore + comboScore;
    run.placements++;
    run.tray[slot] = null;
    const dealt = run.tray.every(p => p === null);
    if (dealt) deal(run, cfg);
    run.previous = before;
    run.revision++;
    return { placed, cleared, lines: n, cellScore, lineScore, comboScore, dealt };
}

export function canUndo(run: Readonly<EndlessRunState>): boolean {
    return !run.undoUsed && run.previous !== null;
}

/** One free undo per run (F032): restores everything from before the last placement. */
export function undo(run: EndlessRunState): void {
    if (!canUndo(run)) throw new Error('Undo not available');
    const revision = run.revision + 1;
    Object.assign(run, run.previous, { previous: null, undoUsed: true, revision });
}

export interface RevivePlan { revision: number; clearCells: HexCell[]; witnessSlot: number; witnessAnchor: HexCell; }

/** Smallest verifiable clearing that lets one tray piece fit (F033); null when no plan or already continued. */
export function revivePlan(run: Readonly<EndlessRunState>, cfg: Endless): RevivePlan | null {
    if (run.continues >= 1) return null;
    let best: RevivePlan | null = null;
    const empty = { ...run, board: {} } as EndlessRunState;
    run.tray.forEach((piece, slot) => {
        if (!piece) return;
        for (const anchor of boardCells(cfg.radius)) {
            if (!fits(empty, cfg, piece, anchor)) continue;
            const clearCells = piece.cells.map(c => ({ q: c.q + anchor.q, r: c.r + anchor.r })).filter(c => run.board[key(c)] !== undefined);
            if (clearCells.length && (!best || clearCells.length < best.clearCells.length)) {
                best = { revision: run.revision, clearCells, witnessSlot: slot, witnessAnchor: anchor };
            }
        }
    });
    return best;
}

export function applyRevive(run: EndlessRunState, cfg: Endless, plan: RevivePlan): void {
    if (plan.revision !== run.revision || run.continues >= 1) throw new Error('Stale revive plan');
    for (const c of plan.clearCells) delete run.board[key(c)];
    if (!fits(run, cfg, run.tray[plan.witnessSlot]!, plan.witnessAnchor)) throw new Error('Revive plan does not free a move');
    run.continues++;
    run.previous = null;
    run.revision++;
}

export interface HarvestReceipt { runId: string; score: number; best: number; newBest: boolean; honey: number; valid: boolean; }

/** Harvest settlement (F034): honey = min(runMax, floor(score/100) × per), capped by the daily limit. */
export function harvest(save: SaveService, cfg: Endless, today: string): HarvestReceipt {
    const run = save.data.endless.run;
    if (!run) throw new Error('No endless run');
    return save.claim<HarvestReceipt>('endless:' + run.runId, draft => {
        const honey = projectedHarvest(draft, cfg, run.score, today);
        if (draft.endless.dailyDay !== today) {
            draft.endless.dailyDay = today;
            draft.endless.dailyGranted = 0;
        }
        draft.endless.dailyGranted += honey;
        addHoney(draft, honey);
        const newBest = run.score > draft.endless.best;
        draft.endless.best = Math.max(draft.endless.best, run.score);
        draft.endless.run = null;
        const valid = run.placements >= cfg.validPlacements && run.score >= cfg.validScore;
        recordActivity(draft, { kind: 'endlessRun', score: run.score, valid }, today);
        return { runId: run.runId, score: run.score, best: draft.endless.best, newBest, honey, valid };
    });
}

/** Honey a harvest of `score` would pay today (F034): run cap, then what is left of the daily cap. */
export function projectedHarvest(save: Readonly<SaveData>, cfg: Endless, score: number, today: string): number {
    const gross = Math.min(cfg.harvestRunMax, Math.floor(score / 100) * cfg.harvestPerHundred);
    const granted = save.endless.dailyDay === today ? save.endless.dailyGranted : 0;
    return Math.max(0, Math.min(gross, cfg.harvestDailyMax - granted));
}
