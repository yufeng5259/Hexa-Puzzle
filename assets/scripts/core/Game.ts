import type { GameConfig } from './Config';
import { Clock, dayId, msUntilNextDay, msUntilNextWeek, weekId } from './Clock';
import { settleEnergy } from './Energy';
import type { DisplayEvent, GameState } from './State';
import type { Store } from './Store';

export type Listener = (state: Readonly<GameState>) => void;

/**
 * One running game: config, the save store and the clock. Every player action
 * goes through act(); listeners only hear about changes that were saved.
 */
export class Game {
    private readonly listeners = new Set<Listener>();
    /** Display events already waiting when this run started (their page never confirmed them). */
    private readonly launchQueue: ReadonlySet<string>;
    public constructor(public readonly config: GameConfig, private readonly store: Store, public readonly clock: Clock) {
        this.launchQueue = new Set(store.state.displayQueue.map(e => e.id));
    }

    public get rules() { return this.config.rules; }
    public get state(): Readonly<GameState> { return this.store.state; }
    public now(): number { return this.clock.now(); }
    public day(): string { return dayId(this.clock.now(), this.clock.offsetMinutes()); }
    public week(): string { return weekId(this.clock.now(), this.clock.offsetMinutes()); }
    public msToNextDay(): number { return msUntilNextDay(this.clock.now(), this.clock.offsetMinutes()); }
    public msToNextWeek(): number { return msUntilNextWeek(this.clock.now(), this.clock.offsetMinutes()); }

    /** Runs a rule on a draft and saves it; throws (state unchanged) if the rule or the write fails. */
    public act<T>(change: (draft: GameState) => T): T {
        const result = this.store.commit(change);
        this.notify();
        return result;
    }

    /** Applies elapsed energy recovery; only writes when something changed. */
    public tick(): void {
        const before = this.store.state.energy;
        const probe = { ...this.store.state, energy: { ...before } } as GameState;
        settleEnergy(probe, this.rules, this.now());
        if (probe.energy.value !== before.value || probe.energy.anchor !== before.anchor) this.act(s => settleEnergy(s, this.rules, this.now()));
    }

    /** Already-granted rewards still waiting to be shown, oldest first. Reading never removes them. */
    public get displays(): readonly DisplayEvent[] { return this.store.state.displayQueue; }
    /** True for an event left over from an earlier run (shown again as a short summary, never granted again). */
    public fromEarlierRun(id: string): boolean { return this.launchQueue.has(id); }
    /**
     * Confirms shown rewards by event id. The rewards are already in the wallet, so a failed
     * write is only logged: those events show once more on the next launch.
     */
    public ackDisplay(ids: readonly string[]): void {
        if (!this.store.state.displayQueue.some(e => ids.includes(e.id))) return;
        try { this.act(s => { s.displayQueue = s.displayQueue.filter(e => !ids.includes(e.id)); }); }
        catch (error) { console.error(error); }
    }

    public subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }
    private notify(): void { for (const listener of Array.from(this.listeners)) listener(this.store.state); }
}
