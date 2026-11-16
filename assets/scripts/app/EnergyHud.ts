import { secondsToNextEnergy } from '../core/Energy';
import type { Game } from '../core/Game';
import type { RewardFx, RewardTarget } from '../features/fx/RewardFx';
import { sumRewards } from '../core/Display';
import type { RewardKind } from '../features/fx/RewardTimeline';
import type { LayoutView } from '../features/ui/LayoutView';
import { setProgress } from '../features/ui/ProgressBar';

/** "已满" when full, otherwise the countdown to the next point (m:ss). */
export function energyStatus(left: number | null): string {
    return left === null ? '已满' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

/** HUD energy: the count sits in the heart, the capsule shows energyStatus. Pages without it are skipped. */
export function showEnergy(view: LayoutView | null | undefined, game: Game, fx?: RewardFx): void {
    if (!view?.isValid || !view.has('energy_count')) return;
    hudText(view, 'energy_count', hudValue(game, 'energy'), fx);
    // While an energy reward still waits to land, "已满" would contradict the lower count shown.
    if (sumRewards(game.displays).energy > 0 || fx?.holds(view.label('energy_count'))) return;
    view.setText('energy_value', energyStatus(secondsToNextEnergy(game.state, game.rules, game.now())));
}

/** HUD level badge and experience bar. */
export function showLevel(view: LayoutView, game: Game): void {
    const s = game.state, levels = game.rules.levels, level = levels[Math.min(s.player.level - 1, levels.length - 1)];
    view.setText('player_level', s.player.level);
    setProgress(view.element('bar_fill_green'), s.player.exp / level.expToNext);
}

/** HUD element (icon, value label) each reward kind flies to; hints go to the puzzle hint badge. */
const HUD: Record<RewardKind, readonly [string, string]> = { coins: ['coin_icon', 'coin_value'], energy: ['energy_icon', 'energy_count'], hints: ['puzzle_badge_count', 'hint_count'] };

/** Reward targets on a page's HUD; kinds the page does not show (or hides) have none. */
export function hudTargets(view: LayoutView | null | undefined, game: Game): (kind: RewardKind) => RewardTarget | null {
    return kind => {
        const [icon, label] = HUD[kind];
        if (!view?.isValid || !view.has(icon) || !view.element(icon).activeInHierarchy) return null;
        return { node: view.element(icon), label: view.labelIds.includes(label) ? view.label(label) : null, value: () => hudValue(game, kind), format: kind === 'coins' ? formatCoins : undefined };
    };
}

/**
 * What the HUD shows: the saved value minus rewards still waiting in the display queue. Their
 * show rolls the value up when it plays (docs/v2/09 §4.2.5); spending checks the saved value.
 */
export function hudValue(game: Game, kind: RewardKind): number {
    const real = kind === 'coins' ? game.state.wallet.coins : kind === 'energy' ? game.state.energy.value : game.state.wallet.hints;
    return Math.max(0, real - sumRewards(game.displays)[kind]);
}
export function formatCoins(n: number): string { return n.toLocaleString('en-US'); }
/** Sets a HUD number unless a reward show is rolling that label right now. */
export function hudText(view: LayoutView, id: string, value: number, fx?: RewardFx): void {
    if (!view.labelIds.includes(id) || fx?.holds(view.label(id))) return;
    view.setText(id, id === 'coin_value' ? formatCoins(value) : value);
}
