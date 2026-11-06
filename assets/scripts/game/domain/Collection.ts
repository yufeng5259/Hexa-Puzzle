import { SaveData } from '../save/SaveData';
import type { Activity } from './Activity';
import { addHints } from './Wallet';

/** Photo id = chapter × PHOTOS_PER_BOOK + slot (slots 0–4 buildings, 5 the group photo); a stable id scheme (F039). */
export const PHOTOS_PER_BOOK = 6;

/** Asset reference resolved by the view layer: bundle + path of a SpriteFrame (without /spriteFrame). */
export interface ArtRef { bundle: string; path: string; }

/** Shape of bundles/meta/config/collection.json. */
export interface CollectionConfig {
    defaultFollow: string;
    companions: { id: string; unlockChapter: number; nameKey: string; portrait: ArtRef; decor: ArtRef }[];
    affinity: { max: number; perTask: number; dailyMax: number; milestones: number[] };
    initialOutfit: string;
    outfits: { id: string; nameKey: string; icon: ArtRef; preview: ArtRef | null; signinDay?: number; album?: number }[];
    buildingKeys: string[];
    albums: { themeKey: string; outfit: string; photos: ArtRef[] }[];
    albumReward: { hints: number };
}

/** Shape of bundles/meta/config/story.json. */
export interface StoryConfig {
    stories: {
        id: string;
        kind: 'chapter' | 'companion';
        /** chapter: readable once garden.chapter ≥ chapter; allGardensDone: after the journey is complete; bee: affinity ≥ milestone. */
        unlock: { chapter?: number; allGardensDone?: boolean; bee?: string; affinity?: number };
        image: ArtRef;
        titleKey: string;
        steps: string[];
    }[];
}

/** Collection state (F035–F040): companions and affinity, story reads, outfits, photos and album rewards. */
export interface CollectionState {
    follow: string;
    affinity: Record<string, number>;
    affinityDay: string;
    affinityToday: number;
    storiesRead: string[];
    /** Companion id -> wearing its affinity-30 decor. */
    decorWorn: Record<string, boolean>;
    outfits: string[];
    wornOutfit: string;
    photos: number[];
    /** Photos recorded but not yet viewed in the album. */
    newPhotos: number[];
}

/** Ids here must match collection.json (defaultFollow, initialOutfit). */
export function newCollectionState(): CollectionState {
    return { follow: 'xiaomi', affinity: {}, affinityDay: '', affinityToday: 0, storiesRead: [], decorWorn: {}, outfits: ['sunny_scarf'],
        wornOutfit: 'sunny_scarf', photos: [], newPhotos: [] };
}

// ---------- companions & affinity (F035/F036) ----------

export function isCompanionOpen(save: Readonly<SaveData>, cfg: CollectionConfig, id: string): boolean {
    return save.garden.chapter >= companion(cfg, id).unlockChapter;
}

export function affinityOf(save: Readonly<SaveData>, id: string): number {
    return save.collection.affinity[id] ?? 0;
}

export function follow(draft: SaveData, cfg: CollectionConfig, id: string): void {
    if (!isCompanionOpen(draft, cfg, id)) throw new Error('Companion not open: ' + id);
    draft.collection.follow = id;
}

/**
 * A daily task was claimed: the followed companion gains affinity, at most `dailyMax` points per day overall;
 * a companion already at max gains nothing and uses no quota. Called by the daily module inside its claim.
 */
export function addAffinityForTask(draft: SaveData, cfg: CollectionConfig, today: string): number {
    const c = draft.collection;
    if (c.affinityDay !== today) {
        c.affinityDay = today;
        c.affinityToday = 0;
    }
    const current = c.affinity[c.follow] ?? 0;
    const gain = Math.min(cfg.affinity.perTask, cfg.affinity.max - current, cfg.affinity.dailyMax - c.affinityToday);
    if (gain <= 0) return 0;
    c.affinity[c.follow] = current + gain;
    c.affinityToday += gain;
    return gain;
}

export function milestoneReached(save: Readonly<SaveData>, id: string, milestone: number): boolean {
    return affinityOf(save, id) >= milestone;
}

/** Affinity-30 decor (F038). */
export function setDecorWorn(draft: SaveData, cfg: CollectionConfig, id: string, worn: boolean): void {
    const top = cfg.affinity.milestones[cfg.affinity.milestones.length - 1];
    if (affinityOf(draft, id) < top) throw new Error('Decor locked for ' + id);
    draft.collection.decorWorn[id] = worn;
}

// ---------- stories (F037) ----------

export function isStoryOpen(save: Readonly<SaveData>, story: StoryConfig['stories'][number], journeyComplete: boolean): boolean {
    const u = story.unlock;
    if (u.chapter !== undefined) return save.garden.chapter >= u.chapter;
    if (u.allGardensDone) return journeyComplete;
    return affinityOf(save, u.bee!) >= u.affinity!;
}

/** Viewing records the read id only; no rewards (F037). */
export function markStoryRead(draft: SaveData, storyId: string): void {
    if (draft.collection.storiesRead.indexOf(storyId) < 0) draft.collection.storiesRead.push(storyId);
}

// ---------- outfits (F038) ----------

export function grantOutfit(draft: SaveData, id: string): void {
    if (draft.collection.outfits.indexOf(id) < 0) draft.collection.outfits.push(id);
}

export function wearOutfit(draft: SaveData, id: string): void {
    if (draft.collection.outfits.indexOf(id) < 0) throw new Error('Outfit not owned: ' + id);
    draft.collection.wornOutfit = id;
}

// ---------- photos & albums (F039/F040) ----------

export function hasPhoto(save: Readonly<SaveData>, photoId: number): boolean {
    return save.collection.photos.indexOf(photoId) >= 0;
}

function recordPhoto(draft: SaveData, photoId: number): void {
    if (draft.collection.photos.indexOf(photoId) >= 0) return;
    draft.collection.photos.push(photoId);
    draft.collection.newPhotos.push(photoId);
}

/** Group photo (slot 5) of a completed garden; call inside the chapter-reward claim. */
export function recordGroupPhoto(draft: SaveData, chapter: number): void {
    recordPhoto(draft, chapter * PHOTOS_PER_BOOK + PHOTOS_PER_BOOK - 1);
}

export function markPhotoSeen(draft: SaveData, photoId: number): void {
    draft.collection.newPhotos = draft.collection.newPhotos.filter(id => id !== photoId);
}

export function bookCount(save: Readonly<SaveData>, book: number): number {
    const first = book * PHOTOS_PER_BOOK;
    return save.collection.photos.filter(id => id >= first && id < first + PHOTOS_PER_BOOK).length;
}

export function isAlbumClaimed(save: Readonly<SaveData>, book: number): boolean {
    return save.claims['album:' + book] !== undefined;
}

export interface AlbumReceipt { book: number; hints: number; outfit: string; }

/** Full book: one hint and the book's outfit, once (album:{book}). */
export function claimAlbum(draft: SaveData, cfg: CollectionConfig, book: number): AlbumReceipt {
    if (bookCount(draft, book) < PHOTOS_PER_BOOK) throw new Error('Album not complete: ' + book);
    const key = 'album:' + book;
    const existing = draft.claims[key];
    if (existing !== undefined) return existing as AlbumReceipt;
    const receipt = { book, hints: cfg.albumReward.hints, outfit: cfg.albums[book].outfit };
    addHints(draft, receipt.hints);
    grantOutfit(draft, receipt.outfit);
    draft.claims[key] = receipt;
    return receipt;
}

/** First 0→1 upgrade of a building records its photo (chapter × perBook + building). */
let rules: CollectionConfig | null = null;

/** Set by the collection config loader before any command runs. */
export function configureCollection(cfg: CollectionConfig): void {
    rules = cfg;
}

export function applyCollectionActivity(draft: SaveData, activity: Activity, today: string): void {
    if (activity.kind === 'build' && activity.level === 1) recordPhoto(draft, activity.chapter * PHOTOS_PER_BOOK + activity.buildingId);
    if (activity.kind === 'chapterClaimed') recordGroupPhoto(draft, activity.chapter);
    if (activity.kind === 'outfitGranted') grantOutfit(draft, activity.outfit);
    if (activity.kind === 'taskClaimed') {
        if (!rules) throw new Error('Collection config not loaded');
        addAffinityForTask(draft, rules, today);
    }
}

function companion(cfg: CollectionConfig, id: string): CollectionConfig['companions'][number] {
    const found = cfg.companions.find(c => c.id === id);
    if (!found) throw new Error('Unknown companion ' + id);
    return found;
}
