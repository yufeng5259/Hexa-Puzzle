import { SaveService } from '../save/SaveService';
import { addHints } from './Wallet';

/** Daily free hint (F057): one per business day, idempotent by day. */
export function freeHintClaimed(save: SaveService, today: string): boolean {
    return save.data.claims['freehint:' + today] !== undefined;
}

export function claimFreeHint(save: SaveService, today: string): void {
    save.claim('freehint:' + today, draft => {
        addHints(draft, 1);
        return { hints: 1 };
    });
}
