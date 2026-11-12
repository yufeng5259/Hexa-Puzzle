import type { Rules } from './Rules';
import { clone, createState, GameState, isValidState, SAVE_KEY } from './State';

export interface Storage { getItem(key: string): string | null; setItem(key: string, value: string): void }

/**
 * The only owner of the persisted GameState. Every change runs on a draft; the
 * draft becomes current only after the whole state is written successfully, so
 * a failed write never shows a fake payment or reward.
 */
export class Store {
    private current: GameState;
    public constructor(private readonly storage: Storage, rules: Rules) {
        this.current = this.load(rules);
    }
    /** Read-only view; mutate only through commit. */
    public get state(): Readonly<GameState> { return this.current; }

    public commit<T>(change: (draft: GameState) => T): T {
        const draft = clone(this.current);
        const result = change(draft);
        draft.revision = this.current.revision + 1;
        this.storage.setItem(SAVE_KEY, JSON.stringify(draft));
        this.current = draft;
        return result;
    }

    private load(rules: Rules): GameState {
        let raw: string | null = null;
        try { raw = this.storage.getItem(SAVE_KEY); } catch { raw = null; }
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (isValidState(parsed)) return parsed;
            } catch { /* fall through to a fresh state */ }
        }
        return createState(rules);
    }
}
