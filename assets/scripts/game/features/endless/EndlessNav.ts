import { UIQueue } from '../../../framework/ui/UILayer';
import { services } from '../../Services';
import { EndlessPage } from './EndlessPage';

/** Close the endless page if it is the top page, returning to the map underneath. */
export function closeEndlessPage(): void {
    const top = services.ui.top(UIQueue.Page);
    if (top instanceof EndlessPage) top.close();
}
