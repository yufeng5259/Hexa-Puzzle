import { dayId, msUntilNextDay, msUntilNextWeek, weekId } from './Clock';
import type { LeagueBoard, LeagueBot, LeagueGift, LeagueRewardRule, LeagueTier, Reward, Rules } from './Rules';
import { incomeMult, RuleError } from './Rules';
import type { DisplayEvent, GameState, LeagueEntry, LeagueGroup, LeagueSettlement, LeagueState } from './State';
import { grantAndShow } from './State';

/**
 * Bee league (docs/v2/16): daily / weekly / all-time boards against local simulated
 * opponents. Everything here is a pure function of the config, the saved state and the
 * time, so the same moment always shows the same board and tests can replay any day.
 *
 * Groups are fixed when created (opponents, their target scores, a seed per opponent);
 * an opponent's score at time t is rebuilt from its seed, so the save stays small and
 * an offline player comes back to plausible progress. A finished period becomes a
 * settlement (rank fixed at the period end), claimed once on S27.
 */

const DAY = 86400000, HOUR = 3600000, MINUTE = 60000;

/** Local calendar of one moment: epoch ms and the device's UTC offset in minutes. */
export interface LeagueTime { readonly now: number; readonly offset: number }

// ---- deterministic randomness ------------------------------------------------

export function hash(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
}
/** mulberry32: a small seeded generator; returns floats in [0, 1). */
export function random(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function shuffle<T>(items: T[], next: () => number): T[] {
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
    return items;
}

// ---- periods -------------------------------------------------------------------

export interface Period { readonly id: string; readonly start: number; readonly end: number }
/** The local day or week (Monday 0:00) holding `now`. */
export function period(board: 'daily' | 'weekly', time: LeagueTime): Period {
    const { now, offset } = time;
    if (board === 'daily') { const end = now + msUntilNextDay(now, offset); return { id: dayId(now, offset), start: end - DAY, end }; }
    const end = now + msUntilNextWeek(now, offset);
    return { id: weekId(now, offset), start: end - 7 * DAY, end };
}

// ---- rules lookups -----------------------------------------------------------------

export function tierRule(rules: Rules, tier: number): LeagueTier {
    const tiers = rules.league.tiers;
    return tiers.find(t => t.tier === tier) ?? tiers[tiers.length - 1];
}
export const topTier = (rules: Rules): number => rules.league.tiers[rules.league.tiers.length - 1].tier;
export function bot(rules: Rules, id: string): LeagueBot {
    const found = rules.league.bots.find(b => b.id === id);
    if (!found) throw new RuleError('invalid', `Unknown league bot ${id}`);
    return found;
}
export function rewardRow(rules: Rules, board: 'daily' | 'weekly', rank: number): LeagueRewardRule | null {
    return rules.league.rewards.find(r => r.board === board && rank >= r.rankFrom && rank <= r.rankTo) ?? null;
}
const round5 = (value: number) => Math.round(value / 5) * 5;
/** Reward of a rank: coins × tier reward multiplier × map income multiplier; energy and hints as configured. */
export function rankReward(state: Readonly<GameState>, rules: Rules, board: 'daily' | 'weekly', rank: number, tier: number): { reward: Reward; stars: number; gift: LeagueGift } {
    const row = rewardRow(rules, board, rank);
    if (!row) return { reward: { coins: 0, energy: 0, hints: 0 }, stars: 0, gift: 'none' };
    const coins = row.reward.coins ? Math.max(5, round5(row.reward.coins * tierRule(rules, tier).rewardMult * incomeMult(state, rules))) : 0;
    return { reward: { coins, energy: row.reward.energy, hints: row.reward.hints }, stars: row.stars, gift: row.gift };
}

// ---- groups ------------------------------------------------------------------------

function median(values: readonly number[]): number {
    const s = [...values].sort((a, b) => a - b), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
/** Base score B of a new group: the player's recent median, never below the tier floor (16 §5.2). */
export function baseScore(league: Readonly<LeagueState>, rules: Rules, board: 'daily' | 'weekly'): number {
    const floor = tierRule(rules, league.tier).floor * (board === 'daily' ? 1 : 5);
    const recent = board === 'daily' ? league.history.daily.slice(-7) : league.history.weekly.slice(-4);
    const fallback = board === 'daily' ? rules.league.dailyBaseDefault : rules.league.weeklyBaseDefault;
    return Math.max(floor, recent.length ? median(recent) : fallback);
}

export function createGroup(league: Readonly<LeagueState>, rules: Rules, board: 'daily' | 'weekly', at: Period): LeagueGroup {
    const L = rules.league, size = L.sizes[board], tier = league.tier, strength = tierRule(rules, tier).strength, base = baseScore(league, rules, board);
    const next = random(hash(`${league.playerId}|${board}|${at.id}|${tier}`));
    let pool = L.bots.filter(b => b.tierMin <= tier && tier <= b.tierMax);
    if (pool.length < size - 1) pool = [...L.bots];
    const picked = shuffle([...pool], next).slice(0, size - 1).sort((a, b) => b.skill - a.skill || (a.id < b.id ? -1 : 1));
    const curve = L.curves[board];
    const bots: LeagueEntry[] = picked.map((b, i) => ({
        botId: b.id,
        target: Math.max(5, round5(base * (curve[i] ?? curve[curve.length - 1]) * strength * (1 + L.jitter * (2 * next() - 1)))),
        seed: Math.floor(next() * 4294967296) >>> 0,
    }));
    return { periodId: at.id, start: at.start, end: at.end, tier, base, bots };
}

/** [start, end, share] play sessions of one opponent over its group's period. */
export function sessions(rules: Rules, entry: LeagueEntry, group: LeagueGroup): [number, number, number][] {
    const b = bot(rules, entry.botId), next = random(entry.seed), days = Math.max(1, Math.round((group.end - group.start) / DAY));
    const out: [number, number, number][] = [];
    const from = Math.max(0, Math.min(23, b.activeFrom)), to = Math.max(from + 1, Math.min(24, b.activeTo));
    for (let d = 0; d < days; d++) {
        const count = b.sessionsMin + Math.floor(next() * (Math.max(b.sessionsMax, b.sessionsMin) - b.sessionsMin + 1));
        for (let i = 0; i < count; i++) {
            const length = (10 + next() * 30) * MINUTE, start = group.start + d * DAY + (from + next() * (to - from)) * HOUR;
            out.push([start, Math.min(start + length, group.start + (d + 1) * DAY), 0.2 + next()]);
        }
    }
    const total = out.reduce((sum, s) => sum + s[2], 0) || 1, sprint = b.style === 'sprinter' ? Math.min(0.9, Math.max(0, b.sprintShare)) : 0;
    for (const s of out) s[2] = (s[2] / total) * (1 - sprint);
    if (sprint > 0) {
        const start = group.end - (rules.league.sprintHours * HOUR) * (0.3 + 0.6 * next());
        out.push([start, Math.min(group.end, start + 30 * MINUTE), sprint]);
    }
    return out;
}

/** An opponent's score at a moment: finished parts of its sessions, rounded down to 5. */
export function botScore(rules: Rules, entry: LeagueEntry, group: LeagueGroup, at: number): number {
    const t = Math.max(group.start, Math.min(group.end, at));
    let done = 0;
    for (const [s, e, share] of sessions(rules, entry, group)) done += share * Math.max(0, Math.min(1, (t - s) / Math.max(1, e - s)));
    return Math.floor((entry.target * Math.min(1, done)) / 5) * 5;
}

// ---- all-time board ------------------------------------------------------------------

const weeksBetween = (from: string, to: string) => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / (7 * DAY)));
/** The 99 all-time opponents with their bests this week (log-uniform, grown weekly, at most ×1.5). */
export function allTimeBots(rules: Rules, allTime: { createdWeek: string; seed: number }, week: string): { botId: string; score: number }[] {
    const L = rules.league, next = random(allTime.seed), lo = Math.log(L.allTimeMin), hi = Math.log(L.allTimeMax);
    const picked = shuffle([...L.bots], next).slice(0, L.sizes.allTime - 1);
    const weeks = Math.min(52, weeksBetween(allTime.createdWeek, week));
    return picked.map(b => {
        const start = Math.exp(lo + next() * (hi - lo));
        let score = start;
        for (let w = 1; w <= weeks; w++) score *= 1 + L.allTimeGrowMin + random(hash(`${allTime.seed}|${b.id}|${w}`))() * (L.allTimeGrowMax - L.allTimeGrowMin);
        return { botId: b.id, score: Math.round(Math.min(score, start * 1.5) / 10) * 10 };
    });
}

// ---- keeping the state current ----------------------------------------------------------

/** True when rollLeague would change something (so reading a board writes only when needed). */
export function leagueStale(league: Readonly<LeagueState>, time: LeagueTime): boolean {
    const day = period('daily', time).id, week = period('weekly', time).id;
    return !league.playerId || !league.allTime || !league.daily || !league.weekly
        || league.day.id === null || day > league.day.id || league.week.id === null || week > league.week.id;
}

/**
 * Settles finished periods, starts the current ones and makes sure the current groups exist.
 * A clock set back never settles or resets anything (period ids only move forward).
 * `entropy` seeds the player id the first time (the app passes a random number).
 */
export function rollLeague(state: GameState, rules: Rules, time: LeagueTime, entropy = 0): void {
    const lb = state.league;
    if (!lb.playerId) lb.playerId = `p${hash(`${time.now}|${entropy}`).toString(36)}${(entropy >>> 0).toString(36)}`;
    for (const board of ['daily', 'weekly'] as const) {
        const now = period(board, time), track = board === 'daily' ? lb.day : lb.week;
        if (track.id !== null && now.id > track.id) {
            const group = lb[board];
            if (group && group.periodId === track.id && track.score > 0) settle(state, rules, board, group, track.score);
            if (track.score > 0) {
                const history = lb.history[board];
                history.push(track.score);
                history.splice(0, Math.max(0, history.length - (board === 'daily' ? 7 : 4)));
            }
        }
        if (track.id === null || now.id > track.id) { track.id = now.id; track.score = 0; }
        if (!lb[board] || lb[board]!.periodId < track.id) lb[board] = createGroup(lb, rules, board, now);
    }
    if (!lb.allTime) lb.allTime = { createdWeek: period('weekly', time).id, seed: hash(`${lb.playerId}|allTime`) };
}

/** Adds points from one endless placement to today's and this week's league scores. */
export function recordLeague(state: GameState, rules: Rules, time: LeagueTime, points: number, entropy = 0): void {
    if (points <= 0) return;
    rollLeague(state, rules, time, entropy);
    state.league.day.score += points;
    state.league.week.score += points;
}

function settle(state: GameState, rules: Rules, board: 'daily' | 'weekly', group: LeagueGroup, score: number): void {
    const lb = state.league, id = `league:${board}:${group.periodId}`;
    if (state.receipts[id] || lb.pending.some(p => p.id === id)) return;
    const rank = 1 + group.bots.filter(e => botScore(rules, e, group, group.end) > score).length;
    lb.pending.push({ id, board, periodId: group.periodId, rank, size: group.bots.length + 1, score, tier: group.tier });
    lb.pending.splice(0, Math.max(0, lb.pending.length - rules.league.pendingMax));
}

// ---- views -------------------------------------------------------------------------------

export interface LeagueRow {
    readonly rank: number;
    /** null for the player. */
    readonly botId: string | null;
    readonly name: string; readonly avatar: string; readonly avatarBg: number;
    readonly score: number;
    readonly me: boolean;
    /** What this rank would win if the period ended now (daily/weekly only). */
    readonly reward: Reward | null; readonly gift: LeagueGift; readonly stars: number;
}
export interface LeagueView {
    readonly board: LeagueBoard;
    readonly periodId: string | null;
    /** Epoch ms of the period end; null on the all-time board. */
    readonly endsAt: number | null;
    readonly tier: number; readonly tierName: string; readonly stars: number; readonly starsToNext: number;
    readonly rows: readonly LeagueRow[];
    readonly me: LeagueRow;
    /** The player scored this period (all-time: has a best). */
    readonly joined: boolean;
}
export const PLAYER_AVATAR = 'player_bee';

/** The board as of `time`. Call rollLeague first (a stale state shows the last saved period). */
export function leagueView(state: Readonly<GameState>, rules: Rules, board: LeagueBoard, time: LeagueTime): LeagueView {
    const lb = state.league, tier = tierRule(rules, lb.tier);
    let entries: { botId: string; score: number }[] = [], myScore = 0, periodId: string | null = null, endsAt: number | null = null;
    if (board === 'allTime') {
        if (lb.allTime) entries = allTimeBots(rules, lb.allTime, period('weekly', time).id);
        myScore = state.endless.best;
    } else {
        const group = lb[board], track = board === 'daily' ? lb.day : lb.week;
        if (group) {
            entries = group.bots.map(e => ({ botId: e.botId, score: botScore(rules, e, group, time.now) }));
            periodId = group.periodId; endsAt = group.end;
            myScore = track.id === group.periodId ? track.score : 0;
        }
    }
    const order = new Map(rules.league.bots.map((b, i) => [b.id, i]));
    const sorted = [...entries].sort((a, b) => b.score - a.score || bot(rules, b.botId).skill - bot(rules, a.botId).skill || order.get(a.botId)! - order.get(b.botId)!);
    // The player wins ties: placed before every opponent with the same score. Without points this period
    // the player is not in the race yet: listed last, without a prize (16 §3).
    const joined = myScore > 0, mine = joined ? sorted.findIndex(e => e.score <= myScore) : -1, at = mine < 0 ? sorted.length : mine;
    const prize = (rank: number) => board === 'allTime' ? { reward: null, gift: 'none' as LeagueGift, stars: 0 } : rankReward(state, rules, board, rank, lb.tier);
    const rows: LeagueRow[] = [];
    const meRow = (rank: number): LeagueRow => ({ rank, botId: null, name: '我', avatar: PLAYER_AVATAR, avatarBg: 0, score: myScore, me: true,
        ...(joined || board === 'allTime' ? prize(rank) : { reward: null, gift: 'none' as LeagueGift, stars: 0 }) });
    sorted.forEach((e, i) => {
        if (i === at) rows.push(meRow(rows.length + 1));
        const b = bot(rules, e.botId);
        rows.push({ rank: rows.length + 1, botId: b.id, name: b.name, avatar: b.avatar, avatarBg: b.avatarBg, score: e.score, me: false, ...prize(rows.length + 1) });
    });
    if (at === sorted.length) rows.push(meRow(rows.length + 1));
    return {
        board, periodId, endsAt, tier: tier.tier, tierName: tier.name, stars: lb.stars, starsToNext: tier.starsToNext,
        rows, me: rows.find(r => r.me)!, joined,
    };
}

// ---- claiming ------------------------------------------------------------------------------

export interface LeagueClaim {
    readonly settlement: LeagueSettlement;
    /** The queued display event (null when this receipt was already paid). */
    readonly event: DisplayEvent | null;
    readonly reward: Reward; readonly gift: LeagueGift;
    readonly stars: number;
    readonly tierBefore: number; readonly tierAfter: number;
    readonly starsAfter: number;
    readonly firstPlaceCount: number;
}

/** Pays one settlement: reward, stars, tier-ups and the first-place count, all in the same save. */
export function claimLeague(state: GameState, rules: Rules, id: string): LeagueClaim {
    const lb = state.league, index = lb.pending.findIndex(p => p.id === id);
    if (index < 0) throw new RuleError('claimed', `No league settlement ${id}`);
    const settlement = lb.pending[index];
    lb.pending.splice(index, 1);
    const { reward, stars, gift } = rankReward(state, rules, settlement.board, settlement.rank, settlement.tier);
    const tierBefore = lb.tier;
    const event: DisplayEvent = { id, type: 'league', reward, detail: { board: settlement.board, rank: settlement.rank, periodId: settlement.periodId } };
    const paid = grantAndShow(state, event);
    if (paid) {
        if (settlement.board === 'daily' && settlement.rank === 1) lb.firstPlaceCount += 1;
        const top = topTier(rules);
        if (lb.tier < top) {
            lb.stars += stars;
            for (let need = tierRule(rules, lb.tier).starsToNext; lb.tier < top && need > 0 && lb.stars >= need; need = tierRule(rules, lb.tier).starsToNext) {
                lb.stars -= need;
                lb.tier += 1;
            }
            if (lb.tier >= top) lb.stars = 0;
        }
    }
    return { settlement, event: paid ? event : null, reward, gift, stars: paid ? stars : 0, tierBefore, tierAfter: lb.tier, starsAfter: lb.stars, firstPlaceCount: lb.firstPlaceCount };
}
