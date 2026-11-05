import { Asset, assetManager, AssetManager, resources } from 'cc';

type AssetType<T extends Asset> = new (...args: any[]) => T;

/** BigHero ResourceLoader rewritten for 3.x bundles: promise API, one cache of loaded bundles. */
export class ResLoader {
    private readonly bundles = new Map<string, Promise<AssetManager.Bundle>>();

    loadBundle(name: string): Promise<AssetManager.Bundle> {
        if (name === 'resources') return Promise.resolve(resources);
        let pending = this.bundles.get(name);
        if (!pending) {
            pending = new Promise((resolve, reject) => assetManager.loadBundle(name, (err, bundle) => err ? reject(err) : resolve(bundle)));
            this.bundles.set(name, pending);
        }
        return pending;
    }

    async load<T extends Asset>(bundle: string, path: string, type: AssetType<T>): Promise<T> {
        const owner = await this.loadBundle(bundle);
        return new Promise((resolve, reject) => owner.load(path, type, (err, asset) => err ? reject(err) : resolve(asset)));
    }

    async loadDir<T extends Asset>(bundle: string, path: string, type: AssetType<T>): Promise<T[]> {
        const owner = await this.loadBundle(bundle);
        return new Promise((resolve, reject) => owner.loadDir(path, type, (err, assets) => err ? reject(err) : resolve(assets)));
    }
}
