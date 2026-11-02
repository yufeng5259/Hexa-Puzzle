export interface ReferenceCounted {
    addRef(): unknown;
    decRef(): unknown;
}

export class ScopeReleasedError extends Error {
    public constructor() { super('Resource scope has been released'); this.name = 'ScopeReleasedError'; }
}

interface Consumer<T> {
    resolve(value: T): void;
    reject(error: unknown): void;
    held: boolean;
}
interface Entry<T> {
    consumers: Set<Consumer<T>>;
    asset: T | null;
    loading: boolean;
}
export interface ResourceSubscription<T> { promise: Promise<T>; cancel(): void }

/** One native load per key; each subscribing scope owns exactly one reference. */
export class ResourcePool<T extends ReferenceCounted> {
    private readonly entries = new Map<string, Entry<T>>();
    public constructor(private readonly nativeLoad: (key: string) => Promise<T>) {}

    public subscribe(key: string): ResourceSubscription<T> {
        let entry = this.entries.get(key);
        const start = !entry;
        if (!entry) {
            entry = { consumers: new Set(), asset: null, loading: true };
            this.entries.set(key, entry);
        }
        const current = entry;
        let consumer!: Consumer<T>;
        const promise = new Promise<T>((resolve, reject) => {
            consumer = { resolve, reject, held: false };
            current.consumers.add(consumer);
            if (current.asset) {
                current.asset.addRef(); consumer.held = true; resolve(current.asset);
            }
        });
        if (start) {
            Promise.resolve().then(() => this.nativeLoad(key)).then(asset => {
                // A temporary hold protects both delivery and disposal of an abandoned late result.
                asset.addRef();
                try {
                    current.asset = asset; current.loading = false;
                    for (const subscriber of current.consumers) {
                        asset.addRef(); subscriber.held = true; subscriber.resolve(asset);
                    }
                } finally {
                    asset.decRef();
                    if (!current.consumers.size) this.drop(key, current);
                }
            }, error => {
                current.loading = false; this.drop(key, current);
                for (const subscriber of current.consumers) subscriber.reject(error);
                current.consumers.clear();
            });
        }
        return { promise, cancel: () => {
            if (!current.consumers.delete(consumer)) return;
            if (consumer.held) current.asset!.decRef();
            else consumer.reject(new ScopeReleasedError());
            if (!current.loading && !current.consumers.size) this.drop(key, current);
        } };
    }

    public get activeEntryCount(): number { return this.entries.size; }
    private drop(key: string, entry: Entry<T>): void {
        if (this.entries.get(key) === entry) this.entries.delete(key);
    }
}

/** Repeated requests within a scope share one subscription; failed requests may retry. */
export class OwnedResourceScope<T extends ReferenceCounted> {
    private readonly subscriptions = new Map<string, ResourceSubscription<T>>();
    private released = false;
    public constructor(private readonly pool: ResourcePool<T>) {}
    public get isReleased(): boolean { return this.released; }
    public load(key: string): Promise<T> {
        if (this.released) return Promise.reject(new ScopeReleasedError());
        let subscription = this.subscriptions.get(key);
        if (!subscription) {
            const native = this.pool.subscribe(key);
            subscription = {
                promise: native.promise.then(asset => {
                    if (this.released) throw new ScopeReleasedError();
                    return asset;
                }),
                cancel: native.cancel,
            };
            this.subscriptions.set(key, subscription);
            const current = subscription;
            subscription.promise.catch(() => {
                if (this.subscriptions.get(key) === current) this.subscriptions.delete(key);
            });
        }
        return subscription.promise;
    }
    public release(): void {
        if (this.released) return;
        this.released = true;
        for (const subscription of this.subscriptions.values()) subscription.cancel();
        this.subscriptions.clear();
    }
}
