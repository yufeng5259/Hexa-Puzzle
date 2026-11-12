import type { Rules } from './Rules';
import type { GameState } from './State';

/**
 * Applies offline recovery. Below the natural max one point returns every
 * recoverSeconds counted from `anchor`; at or above max recovery pauses.
 * A clock moved backwards never produces extra energy.
 */
export function settleEnergy(state: GameState, rules: Rules, now: number): void {
    const energy = state.energy, { max, recoverSeconds } = rules.energy, period = recoverSeconds * 1000;
    if (energy.value >= max) { energy.anchor = null; return; }
    if (energy.anchor === null || now < energy.anchor) { energy.anchor = now; return; }
    const gained = Math.floor((now - energy.anchor) / period);
    if (gained <= 0) return;
    energy.value = Math.min(max, energy.value + gained);
    energy.anchor = energy.value >= max ? null : energy.anchor + gained * period;
}

/** Spends energy after settling; an existing countdown keeps running. */
export function spendEnergy(state: GameState, rules: Rules, now: number, amount: number): boolean {
    settleEnergy(state, rules, now);
    if (state.energy.value < amount) return false;
    state.energy.value -= amount;
    settleEnergy(state, rules, now);
    return true;
}

/** Seconds until the next point, or null when recovery is paused. */
export function secondsToNextEnergy(state: GameState, rules: Rules, now: number): number | null {
    if (state.energy.value >= rules.energy.max || state.energy.anchor === null) return null;
    const elapsed = Math.max(0, now - state.energy.anchor) % (rules.energy.recoverSeconds * 1000);
    return Math.ceil((rules.energy.recoverSeconds * 1000 - elapsed) / 1000);
}
