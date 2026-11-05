import { UIQueue } from '../../../framework/ui/UILayer';
import { services } from '../../Services';
import { PuzzlePage } from './PuzzlePage';

/** Close the puzzle page if it is the top page, returning to the map underneath. */
export function closePuzzlePage(): void {
    const top = services.ui.top(UIQueue.Page);
    if (top instanceof PuzzlePage) top.close();
}
