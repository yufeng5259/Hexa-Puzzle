import { Asset, assetManager, resources } from 'cc';
import { ResourcePool } from '../core/ResourcePool';
import { ResourceScope } from './ResourceScope';

export type AssetType<T extends Asset = Asset> = new () => T;
export interface RegisteredResource<T extends Asset = Asset> {
    readonly id: string;
    readonly bundle: string;
    readonly path: string;
    readonly type: AssetType<T>;
    readonly uuid: string;
}
export interface ResourceLoaderOptions {
    /** Configuration aliases share the canonical pool entry and resource reference. */
    readonly aliases?: Readonly<Record<string, string>>;
    /** For example garden-sunny -> common. Shared bundles load before dependent content. */
    readonly bundleDependencies?: Readonly<Record<string, readonly string[]>>;
}
type Bundle = NonNullable<ReturnType<typeof assetManager.getBundle>>;

/** Registered shared framework assets only. Original artwork retains its manifest boundary. */
export class ResourceLoader {
    private readonly records = new Map<string, RegisteredResource>();
    private readonly bundleLoads = new Map<string, Promise<Bundle>>();
    private readonly pool: ResourcePool<Asset>;
    private readonly dependencies: Readonly<Record<string, readonly string[]>>;
    private readonly aliases: Readonly<Record<string, string>>;

    public constructor(records: readonly RegisteredResource[], options: ResourceLoaderOptions = {}) {
        const dependencies: Record<string, readonly string[]> = {};
        for (const key of Object.keys(options.bundleDependencies || {})) dependencies[key] = [...options.bundleDependencies![key]];
        this.dependencies = dependencies;
        const visited = new Set<string>(), visiting = new Set<string>();
        const visit = (name: string): void => {
            if (visiting.has(name)) throw new Error(`Resource bundle dependency cycle: ${name}`);
            if (visited.has(name)) return;
            visiting.add(name);
            for (const dependency of dependencies[name] || []) visit(dependency);
            visiting.delete(name); visited.add(name);
        };
        for (const name of Object.keys(dependencies)) visit(name);
        for (const record of records) {
            if (!record.id || this.records.has(record.id) || !record.bundle || !record.uuid
                || !/^[A-Za-z0-9_/-]+$/.test(record.path)
                || record.path.split('/').some(part => !part || part === '.' || part === '..')) {
                throw new Error(`Invalid or duplicate registered resource: ${record.id}`);
            }
            this.records.set(record.id, Object.freeze({ ...record }));
        }
        const aliases: Record<string, string> = Object.create(null);
        for (const [alias, target] of Object.entries(options.aliases || {})) {
            if (!alias || this.records.has(alias) || !this.records.has(target)) throw new Error('Invalid resource alias: ' + alias);
            aliases[alias] = target;
        }
        this.aliases = Object.freeze(aliases);
        this.pool = new ResourcePool(key => this.nativeLoad(key));
    }
    public createScope(): ResourceScope { return new ResourceScope(this, this.pool, this.aliases); }
    public validate<T extends Asset>(id: string, type: AssetType<T>): void {
        const record = this.record(id);
        if (record.type !== type) throw new Error(`Resource type mismatch: ${id}`);
    }
    /** Whether an id is registered (optional art may not be delivered yet). */
    public has(id: string): boolean { return this.records.has(this.aliases[id] || id); }
    public get activeEntryCount(): number { return this.pool.activeEntryCount; }

    private record(id: string): RegisteredResource {
        const record = this.records.get(id);
        if (!record) throw new Error(`Resource is not registered: ${id}`);
        return record;
    }
    private loadBundle(name: string): Promise<Bundle> {
        let pending = this.bundleLoads.get(name);
        if (!pending) {
            pending = Promise.resolve().then(async () => {
                await Promise.all((this.dependencies[name] || []).map(dependency => this.loadBundle(dependency)));
                if (name === 'resources') return resources;
                const existing = assetManager.getBundle(name);
                if (existing) return existing;
                return new Promise<Bundle>((resolve, reject) => {
                    assetManager.loadBundle(name, (error, bundle) => error ? reject(error) : resolve(bundle));
                });
            });
            this.bundleLoads.set(name, pending);
            pending.catch(() => {
                if (this.bundleLoads.get(name) === pending) this.bundleLoads.delete(name);
            });
        }
        return pending;
    }
    private async nativeLoad(id: string): Promise<Asset> {
        const record = this.record(id);
        const bundle = await this.loadBundle(record.bundle);
        return new Promise<Asset>((resolve, reject) => {
            bundle.load(record.path, record.type, (error, asset) => {
                if (error || !(asset instanceof record.type) || asset._uuid !== record.uuid) {
                    // Release a successfully returned but mismatching/abandoned native asset safely.
                    if (asset instanceof Asset) { asset.addRef(); asset.decRef(); }
                    reject(error || new Error(`Loaded resource identity mismatch: ${id}`));
                } else resolve(asset);
            });
        });
    }
}
