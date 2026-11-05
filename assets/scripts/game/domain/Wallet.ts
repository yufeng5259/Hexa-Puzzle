import { SaveData } from '../save/SaveData';

/** Wallet rules (F019): two non-negative safe-integer currencies; spends fail without changing anything. */
export function canAfford(save: Readonly<SaveData>, honey: number): boolean {
    return save.wallet.honey >= honey;
}

export function spendHoney(draft: SaveData, amount: number): void {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid honey amount ' + amount);
    if (draft.wallet.honey < amount) throw new Error('Not enough honey');
    draft.wallet.honey -= amount;
}

export function addHoney(draft: SaveData, amount: number): void {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid honey amount ' + amount);
    draft.wallet.honey += amount;
}

export function addHints(draft: SaveData, amount: number): void {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid hint amount ' + amount);
    draft.wallet.hints += amount;
}

export function spendHint(draft: SaveData): void {
    if (draft.wallet.hints < 1) throw new Error('No hints');
    draft.wallet.hints -= 1;
}
