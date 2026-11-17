import { Asset } from 'cc';
import { OwnedResourceScope, ResourcePool } from '../core/ResourcePool';
import type { AssetType, ResourceLoader } from './ResourceLoader';

/** One view owns this scope and releases it after its instances have been destroyed. */
export class ResourceScope {
    private readonly owned: OwnedResourceScope<Asset>;
    public constructor(private readonly loader: ResourceLoader, pool: ResourcePool<Asset>,
        private readonly aliases: Readonly<Record<string, string>> = {}) {
        this.owned = new OwnedResourceScope(pool);
    }
    public get isReleased(): boolean { return this.owned.isReleased; }
    public load<T extends Asset>(id: string, type: AssetType<T>): Promise<T> {
        const canonical = this.aliases[id] || id;
        try { this.loader.validate(canonical, type); }
        catch (error) { return Promise.reject(error); }
        return this.owned.load(canonical) as Promise<T>;
    }
    /** Whether an id is registered (optional art may not be delivered yet). */
    public has(id: string): boolean { return this.loader.has(this.aliases[id] || id); }
    public release(): void { this.owned.release(); }
}
