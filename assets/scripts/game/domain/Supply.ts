import { SaveService } from '../save/SaveService';
import { dailyRules } from './Daily';
import { addHints } from './Wallet';

/** Daily free hint (F057): once per business day (amount in daily.json), idempotent by day. */
export function freeHintClaimed(save: SaveService, today: string): boolean {
    return save.data.claims['freehint:' + today] !== undefined;
}

export function claimFreeHint(save: SaveService, today: string): void {
    save.claim('freehint:' + today, draft => {
        const hints = dailyRules().supply.freeHints;
        addHints(draft, hints);
        return { hints };
    });
}
