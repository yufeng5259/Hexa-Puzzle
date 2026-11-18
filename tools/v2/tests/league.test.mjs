import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loader } from '../env.mjs';

const load = loader();
const { defaultRules } = load('assets/scripts/core/DefaultRules');
const { createState } = load('assets/scripts/core/State');
const L = load('assets/scripts/core/League');

const rules = defaultRules();
const OFFSET = 480; // UTC+8
const HOUR = 3600000, DAY = 24 * HOUR;
/** Local time of 2026-11-17 (a Tuesday) at `hour`, plus `days`. */
const at = (hour, days = 0) => ({ now: Date.UTC(2026, 10, 17, hour, 0, 0) - OFFSET * 60000 + days * DAY, offset: OFFSET });
const fresh = () => { const s = createState(rules); L.rollLeague(s, rules, at(9), 42); return s; };

test('periods follow the local day and the week from Monday 0:00', () => {
    const d = L.period('daily', at(9)), w = L.period('weekly', at(9));
    assert.equal(d.id, '2026-11-17');
    assert.equal(d.end - d.start, DAY);
    assert.equal(w.id, '2026-11-16');
    assert.equal(w.end - w.start, 7 * DAY);
    assert.equal(L.period('daily', at(23, 0)).id, '2026-11-17');
    assert.equal(L.period('daily', at(0, 1)).id, '2026-11-18');
});

test('rolling creates the player id, both groups and the all-time board once', () => {
    const s = fresh();
    assert.ok(s.league.playerId.length > 3);
    assert.equal(s.league.daily.bots.length, 19);
    assert.equal(s.league.weekly.bots.length, 29);
    assert.ok(s.league.allTime);
    assert.equal(L.leagueStale(s.league, at(15)), false);
    assert.equal(L.leagueStale(s.league, at(1, 1)), true);
    const before = JSON.stringify(s.league);
    L.rollLeague(s, rules, at(20), 7);
    assert.equal(JSON.stringify(s.league), before, 'same period: nothing changes');
});

test('the same moment always shows the same board; opponents never lose points', () => {
    const s = fresh();
    const a = L.leagueView(s, rules, 'daily', at(14)), b = L.leagueView(JSON.parse(JSON.stringify(s)), rules, 'daily', at(14));
    assert.deepEqual(a, b);
    assert.equal(a.rows.length, 20);
    assert.deepEqual(a.rows.map(r => r.rank), Array.from({ length: 20 }, (_, i) => i + 1));
    assert.equal(new Set(a.rows.filter(r => !r.me).map(r => r.name)).size, 19);
    const group = s.league.daily;
    for (const entry of group.bots) {
        let last = -1;
        for (let h = 0; h <= 24; h += 0.5) { const v = L.botScore(rules, entry, group, group.start + h * HOUR); assert.ok(v >= last); last = v; }
        assert.ok(Math.abs(last - entry.target) <= 5, 'reaches its target by the end');
    }
});

test('targets follow the slot curve around the base score', () => {
    const s = fresh(), g = s.league.daily;
    assert.equal(g.base, rules.league.dailyBaseDefault);
    const targets = g.bots.map(e => e.target);
    assert.ok(targets[0] >= 800 * 1.5 * 0.9 - 5 && targets[0] <= 800 * 1.5 * 1.1 + 5);
    assert.ok(targets[18] <= 800 * 0.1 * 1.1 + 5);
    // A normal day (the base) ranks about 3rd–6th in the first tier.
    const end = { now: g.end - 1, offset: OFFSET };
    s.league.day.score = 800;
    const rank = L.leagueView(s, rules, 'daily', end).me.rank;
    assert.ok(rank >= 3 && rank <= 6, `rank ${rank}`);
    s.league.day.score = 1400;
    assert.equal(L.leagueView(s, rules, 'daily', end).me.rank, 1);
});

test('the base score is the recent median, never below the tier floor', () => {
    const s = fresh();
    s.league.history.daily = [100, 200, 300];
    assert.equal(L.baseScore(s.league, rules, 'daily'), 400);
    s.league.history.daily = [900, 1500, 1100, 1300];
    assert.equal(L.baseScore(s.league, rules, 'daily'), 1200);
    s.league.tier = 5;
    s.league.history.weekly = [];
    assert.equal(L.baseScore(s.league, rules, 'weekly'), 6000);
});

test('endless points count for today and this week; a new day settles yesterday once', () => {
    const s = fresh();
    L.recordLeague(s, rules, at(10), 300);
    L.recordLeague(s, rules, at(11), 200);
    assert.equal(s.league.day.score, 500);
    assert.equal(s.league.week.score, 500);
    const view = L.leagueView(s, rules, 'daily', at(11));
    assert.equal(view.me.score, 500);
    assert.equal(view.joined, true);
    L.rollLeague(s, rules, at(9, 1));
    assert.equal(s.league.pending.length, 1);
    const p = s.league.pending[0];
    assert.equal(p.id, 'league:daily:2026-11-17');
    assert.equal(p.score, 500);
    assert.equal(p.size, 20);
    assert.equal(s.league.day.id, '2026-11-18');
    assert.equal(s.league.day.score, 0);
    assert.deepEqual(s.league.history.daily, [500]);
    assert.equal(s.league.week.score, 500, 'same week keeps counting');
    assert.equal(s.league.daily.periodId, '2026-11-18');
    L.rollLeague(s, rules, at(10, 1));
    assert.equal(s.league.pending.length, 1, 'no second settlement');
});

test('a day without points settles nothing; a clock set back changes nothing', () => {
    const s = fresh();
    L.rollLeague(s, rules, at(9, 1));
    assert.equal(s.league.pending.length, 0);
    L.recordLeague(s, rules, at(10, 1), 100);
    const before = JSON.stringify(s.league);
    L.rollLeague(s, rules, at(10, -3));
    assert.equal(JSON.stringify(s.league), before);
    L.recordLeague(s, rules, at(10, -3), 50);
    assert.equal(s.league.day.score, 150, 'points while the clock is back count for the saved day');
});

test('a new week settles the weekly board', () => {
    const s = fresh();
    L.recordLeague(s, rules, at(10), 3000);
    L.rollLeague(s, rules, at(9, 7));
    const ids = s.league.pending.map(p => p.id).sort();
    assert.deepEqual(ids, ['league:daily:2026-11-17', 'league:weekly:2026-11-16']);
    assert.equal(s.league.week.id, '2026-11-23');
});

test('claiming pays the rank reward, stars and tier once', () => {
    const s = fresh();
    s.league.pending.push({ id: 'league:daily:2026-11-16', board: 'daily', periodId: '2026-11-16', rank: 1, size: 20, score: 2000, tier: 1 });
    s.league.stars = 40;
    const coins = s.wallet.coins, energy = s.energy.value, hints = s.wallet.hints;
    const c = L.claimLeague(s, rules, 'league:daily:2026-11-16');
    assert.deepEqual(c.reward, { coins: 150, energy: 1, hints: 1 });
    assert.equal(s.wallet.coins, coins + 150);
    assert.equal(s.energy.value, energy + 1);
    assert.equal(s.wallet.hints, hints + 1);
    assert.equal(c.stars, 20);
    assert.equal(c.tierBefore, 1);
    assert.equal(c.tierAfter, 2);
    assert.equal(s.league.stars, 10, 'extra stars carry into the next tier');
    assert.equal(s.league.firstPlaceCount, 1);
    assert.equal(s.displayQueue.at(-1).type, 'league');
    assert.throws(() => L.claimLeague(s, rules, 'league:daily:2026-11-16'), /No league settlement/);
});

test('higher tiers multiply league coins; ranks without a prize pay nothing', () => {
    const s = fresh();
    assert.equal(L.rankReward(s, rules, 'daily', 2, 3).reward.coins, Math.round(90 * 1.4 / 5) * 5);
    assert.deepEqual(L.rankReward(s, rules, 'daily', 15, 1), { reward: { coins: 0, energy: 0, hints: 0 }, stars: 1, gift: 'none' });
    assert.deepEqual(L.rankReward(s, rules, 'weekly', 1, 1).reward, { coins: 500, energy: 3, hints: 2 });
    assert.equal(L.rankReward(s, rules, 'weekly', 12, 1).stars, 0);
});

test('the top tier stops at zero stars and only counts first places', () => {
    const s = fresh();
    s.league.tier = 5;
    s.league.pending.push({ id: 'league:daily:x', board: 'daily', periodId: 'x', rank: 1, size: 20, score: 1, tier: 5 });
    const c = L.claimLeague(s, rules, 'league:daily:x');
    assert.equal(c.tierAfter, 5);
    assert.equal(s.league.stars, 0);
    assert.equal(c.reward.coins, 300);
});

test('pending settlements keep only the newest few', () => {
    const s = fresh();
    for (let d = 1; d <= 10; d++) { L.recordLeague(s, rules, at(10, d), 10); }
    L.rollLeague(s, rules, at(10, 11));
    assert.equal(s.league.pending.filter(p => p.board === 'daily').length <= rules.league.pendingMax, true);
    assert.equal(s.league.pending.length, rules.league.pendingMax);
    assert.equal(s.league.history.daily.length, 7);
});

test('all-time board: 99 opponents, the player ranked by best score, slow weekly growth', () => {
    const s = fresh();
    s.endless.best = 5000;
    const v = L.leagueView(s, rules, 'allTime', at(9));
    assert.equal(v.rows.length, 100);
    assert.equal(v.endsAt, null);
    assert.equal(v.me.score, 5000);
    const later = L.leagueView(s, rules, 'allTime', at(9, 70));
    const score = name => v.rows.find(r => r.name === name).score;
    for (const r of later.rows.filter(r => !r.me)) assert.ok(r.score >= score(r.name) && r.score <= score(r.name) * 1.5 + 10, r.name);
});

test('the player wins ties and every bot of a group fits its tier', () => {
    const s = fresh(), g = s.league.daily, end = { now: g.end, offset: OFFSET };
    const third = L.leagueView(s, rules, 'daily', end).rows.filter(r => !r.me)[2];
    s.league.day.score = third.score;
    assert.equal(L.leagueView(s, rules, 'daily', end).me.rank, 3);
    for (const e of g.bots) { const b = L.bot(rules, e.botId); assert.ok(b.tierMin <= 1 && 1 <= b.tierMax); }
});

test('before scoring this period the player is listed last, without a prize', () => {
    const s = fresh(), v = L.leagueView(s, rules, 'daily', at(0, 0));
    assert.equal(v.joined, false);
    assert.equal(v.me.rank, 20);
    assert.equal(v.me.reward, null);
    assert.equal(v.me.gift, 'none');
    assert.equal(v.rows.at(-1).me, true);
});
