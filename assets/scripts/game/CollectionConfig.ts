import { JsonAsset, Sprite, SpriteFrame } from 'cc';
import { ViewBase } from '../framework/ui/ViewBase';
import { ArtRef, CollectionConfig, configureCollection, StoryConfig } from './domain/Collection';
import { services } from './Services';

let collection: CollectionConfig | null = null;
let stories: StoryConfig | null = null;

/** Loads bundles/meta/config/collection.json and story.json; called once by LoadingPage. */
export async function loadCollectionConfig(): Promise<void> {
    const [c, s] = await Promise.all([
        services.res.load('meta', 'config/collection', JsonAsset),
        services.res.load('meta', 'config/story', JsonAsset),
    ]);
    collection = c.json as CollectionConfig;
    configureCollection(collection);
    stories = s.json as StoryConfig;
}

export function collectionConfig(): CollectionConfig {
    if (!collection) throw new Error('Collection config not loaded');
    return collection;
}

export function storyConfig(): StoryConfig {
    if (!stories) throw new Error('Story config not loaded');
    return stories;
}

/**
 * Load a configured sprite frame into `target`, owned by `view`'s lease.
 * A result arriving after the view closed, or after `target` was asked to show another ref, is dropped.
 */
export async function showArt(view: ViewBase<any>, target: Sprite, ref: ArtRef): Promise<void> {
    const token = ref.bundle + ':' + ref.path;
    pending.set(target, token);
    const frame = await services.res.load(ref.bundle, ref.path + '/spriteFrame', SpriteFrame);
    if (!view.isOpened || pending.get(target) !== token) return;
    pending.delete(target);
    target.spriteFrame = view.lease.acquire(frame);
}

/** Drop any in-flight showArt for `target` (before assigning a frame directly). */
export function cancelArt(target: Sprite): void {
    pending.delete(target);
}

const pending = new WeakMap<Sprite, string>();
