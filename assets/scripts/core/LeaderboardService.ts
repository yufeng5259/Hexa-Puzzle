import type { Game } from './Game';
import { claimLeague, leagueStale, leagueView, recordLeague, rollLeague, type LeagueClaim, type LeagueTime, type LeagueView } from './League';
import type { LeagueBoard } from './Rules';
import type { GameState, LeagueSettlement } from './State';

/**
 * Leaderboard boundary (docs/v2/16 §8). Pages, S27 and the reward flow only talk to this
 * interface; today it is LocalLeaderboardService (simulated opponents, saved locally). A
 * server version later swaps the implementation: it verifies scores and issues the
 * settlements, while views, dialogs and configuration stay as they are. Every call is
 * asynchronous so the pages already handle loading and failure.
 */
export interface LeaderboardService {
    getBoard(board: LeagueBoard): Promise<LeagueView>;
    /** Points of one endless placement (a local service records them inside the placement save instead, see recordPoints). */
    reportScore(points: number): Promise<void>;
    getPendingSettlements(): Promise<readonly LeagueSettlement[]>;
    /** Pays one settlement; the reward is saved before this resolves. */
    claimSettlement(id: string): Promise<LeagueClaim>;
}

/** Local implementation on the single save authority (Game.act). */
export class LocalLeaderboardService implements LeaderboardService {
    public constructor(private readonly game: Game, private readonly entropy: () => number = () => Math.floor(Math.random() * 4294967296)) {}

    private time(): LeagueTime { return { now: this.game.now(), offset: this.game.clock.offsetMinutes() }; }

    /** Settles finished periods and creates missing groups; writes only when something changed. */
    public refresh(): void {
        const time = this.time();
        if (leagueStale(this.game.state.league, time)) this.game.act(s => rollLeague(s, this.game.rules, time, this.entropy()));
    }
    /** For the endless placement transaction: adds the points in the same save as the move. */
    public recordPoints(draft: GameState, points: number): void { recordLeague(draft, this.game.rules, this.time(), points, this.entropy()); }

    public async getBoard(board: LeagueBoard): Promise<LeagueView> {
        this.refresh();
        return leagueView(this.game.state, this.game.rules, board, this.time());
    }
    public async reportScore(points: number): Promise<void> {
        if (points > 0) this.game.act(s => this.recordPoints(s, points));
    }
    public async getPendingSettlements(): Promise<readonly LeagueSettlement[]> {
        this.refresh();
        return this.game.state.league.pending;
    }
    public async claimSettlement(id: string): Promise<LeagueClaim> {
        return this.game.act(s => claimLeague(s, this.game.rules, id));
    }
    /** Cheap synchronous read for red dots (no refresh, no write). */
    public get pendingCount(): number { return this.game.state.league.pending.length; }
}
