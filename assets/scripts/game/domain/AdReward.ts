import { SaveData } from '../save/SaveData';
import { HexCell } from './puzzle/LevelDefinition';
import { addHints, addHoney } from './Wallet';

/**
 * Rewarded-ad offers (F052–F057), in the Android ledger's v2 request shape so the same data
 * drives the live grant and the recovery of receipts left from a killed session.
 */
export type AdTarget =
    | { kind: 'puzzle'; attemptId: string; mapId: string; levelId: string; contentVersion: number }
    | { kind: 'endless'; runId: string }
    | { kind: 'settlement'; settlementId: string }
    | { kind: 'supply'; dayKey: string };

export type AdRewardSpec =
    | { kind: 'hints'; amount: number }
    | { kind: 'continue'; bonusMoves: number }
    | { kind: 'honey'; amount: number }
    | { kind: 'endless-revive'; clearCells: HexCell[] };

export interface AdRequest {
    requestVersion: 2;
    requestId: string;
    ownerProfile: 'prod';
    source: 'native';
    placementId: string;
    target: AdTarget;
    /** What the ad unlocks (one benefit per key and slot), e.g. the attempt for a hint. */
    benefitKey: string;
    benefitSlot: number;
    createdAtMs: number;
    createdDay: string;
    rewardSpec: AdRewardSpec;
}

const MAP_ID = 'mainline';
const CONTENT_VERSION = 1;

export function puzzleTarget(attemptId: string, levelId: string): AdTarget {
    return { kind: 'puzzle', attemptId, mapId: MAP_ID, levelId, contentVersion: CONTENT_VERSION };
}

/** Ids accepted by the native ledger: [A-Za-z0-9:_-]{1,192}. */
export function adId(value: string): string {
    return value.replace(/[^A-Za-z0-9:_-]/g, '_').slice(0, 192);
}

/**
 * Grant an earned ad reward into `draft` if its target still exists. Returns false when the target is gone
 * (attempt finished, run harvested, bonus already taken): the receipt is then settled without a reward (F052).
 */
export function applyAdReward(draft: SaveData, request: AdRequest): boolean {
    const t = request.target, r = request.rewardSpec;
    if (r.kind === 'hints') {
        addHints(draft, r.amount);
        return true;
    }
    if (r.kind === 'continue') {
        if (t.kind !== 'puzzle' || draft.attempt?.attemptId !== t.attemptId) return false;
        draft.attempt.extraMoves += r.bonusMoves;
        draft.attempt.continued = true;
        return true;
    }
    if (r.kind === 'honey') {
        if (t.kind === 'settlement') {
            const key = 'bonus:' + t.settlementId;
            if (draft.claims[key] !== undefined) return false;
            draft.claims[key] = r.amount;
        }
        addHoney(draft, r.amount);
        return true;
    }
    const run = draft.endless.run;
    if (t.kind !== 'endless' || !run || run.runId !== t.runId || run.continues >= 1) return false;
    for (const c of r.clearCells) delete run.board[c.q + ',' + c.r];
    run.continues++;
    run.previous = null;
    run.revision++;
    return true;
}
