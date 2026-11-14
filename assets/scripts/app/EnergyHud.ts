import { secondsToNextEnergy } from '../core/Energy';
import type { Game } from '../core/Game';
import type { LayoutView } from '../features/ui/LayoutView';

/** "已满" when full, otherwise the countdown to the next point (m:ss). */
export function energyStatus(left: number | null): string {
    return left === null ? '已满' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

/** HUD energy: the count sits in the heart, the capsule shows energyStatus. Pages without it are skipped. */
export function showEnergy(view: LayoutView | null | undefined, game: Game): void {
    if (!view?.isValid || !view.has('energy_count')) return;
    view.setText('energy_count', game.state.energy.value);
    view.setText('energy_value', energyStatus(secondsToNextEnergy(game.state, game.rules, game.now())));
}
