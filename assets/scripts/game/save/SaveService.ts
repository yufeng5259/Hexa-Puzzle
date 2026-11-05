import { SaveData, SCHEMA_VERSION } from './SaveData';

export interface SaveStore {
    read(): SaveData | null;
    write(data: SaveData): void;
}

export type SaveListener = (data: Readonly<SaveData>) => void;

/**
 * The single player-state authority (F017). Commands mutate a deep copy; the copy is written,
 * then becomes the snapshot, then listeners run. A failed write leaves the snapshot untouched.
 */
export class SaveService {
    private snapshot: SaveData;
    private readonly listeners = new Set<SaveListener>();

    constructor(private readonly store: SaveStore, create: () => SaveData) {
        const loaded = store.read();
        if (loaded && loaded.schemaVersion !== SCHEMA_VERSION) throw new Error('Unsupported save schema ' + loaded.schemaVersion);
        this.snapshot = loaded ?? create();
        if (!loaded) store.write(this.snapshot);
    }

    get data(): Readonly<SaveData> { return this.snapshot; }

    transact<T>(command: (draft: SaveData) => T): T {
        const draft = JSON.parse(JSON.stringify(this.snapshot)) as SaveData;
        const result = command(draft);
        this.store.write(draft);
        this.snapshot = draft;
        for (const listener of Array.from(this.listeners)) listener(this.snapshot);
        return result;
    }

    /** Idempotent claim: the first run stores its receipt; repeats return the stored receipt unchanged. */
    claim<R>(key: string, command: (draft: SaveData) => R): R {
        const existing = this.snapshot.claims[key];
        if (existing !== undefined) return existing as R;
        return this.transact(draft => {
            const receipt = command(draft);
            draft.claims[key] = receipt;
            return receipt;
        });
    }

    subscribe(enabled: boolean, listener: SaveListener): void {
        if (enabled) this.listeners.add(listener);
        else this.listeners.delete(listener);
    }
}
