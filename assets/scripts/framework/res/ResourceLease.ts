import { Asset } from 'cc';

/** BigHero ResourceLease as a plain owner object: every acquired asset is addRef'd once and released together. */
export class ResourceLease {
    private assets: Asset[] = [];

    acquire<T extends Asset>(asset: T): T {
        asset.addRef();
        this.assets.push(asset);
        return asset;
    }

    releaseAll(): void {
        for (const asset of this.assets) asset.decRef();
        this.assets = [];
    }
}
