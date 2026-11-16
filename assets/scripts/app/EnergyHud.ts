import { Node, UITransform } from 'cc';
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

/** Design width of each progress fill, taken before it is first resized. */
const fills = new WeakMap<Node, number>();
/** Sets a left-anchored progress fill (build-ui.mjs LEFT_FILLS) to ratio 0..1 of its design width. */
export function setFill(node: Node, ratio: number, min = 8): void {
    const ui = node.getComponent(UITransform)!;
    if (!fills.has(node)) fills.set(node, ui.width);
    ui.width = Math.max(min, fills.get(node)! * Math.min(1, Math.max(0, ratio)));
}

/** HUD level badge and experience bar. */
export function showLevel(view: LayoutView, game: Game): void {
    const s = game.state, levels = game.rules.levels, level = levels[Math.min(s.player.level - 1, levels.length - 1)];
    view.setText('player_level', s.player.level);
    setFill(view.element('bar_fill_green'), s.player.exp / level.expToNext);
}
