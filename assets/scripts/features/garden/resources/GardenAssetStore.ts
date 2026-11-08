import { JsonAsset, Prefab, SpriteFrame } from 'cc';
import { DEBUG } from 'cc/env';
import { RegisteredResource, ResourceLoader } from '../../../framework/resources/ResourceLoader';
import { ResourceScope } from '../../../framework/resources/ResourceScope';

interface ImageRecord {
    readonly id: string;
    readonly uuid: string;
    readonly spriteFrameUuid: string;
    readonly assetPath: string;
    readonly bundle: string;
    readonly resourcePath: string;
    readonly size: readonly number[];
    readonly sourceSha256: string;
    readonly sourceId?: string;
    readonly sha256?: string;
    readonly generatorSha256?: string;
}
export interface FoundationPrefabRecord {
    readonly id: string;
    readonly uuid: string;
    readonly bundle: string;
    readonly resourcePath: string;
}
export interface FoundationPrefabRegistry {
    readonly aliases?: Readonly<Record<string, string>>;
    readonly prefabs: readonly FoundationPrefabRecord[];
    readonly dataAssets?: readonly FoundationPrefabRecord[];
}
export interface FoundationArtManifest {
    readonly schema: string;
    readonly sourceCount: number;
    readonly records: readonly ImageRecord[];
    readonly derivatives: readonly ImageRecord[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/i;
const BUNDLES = new Set(['resources', 'boot', 'common', 'mainline', 'puzzle', 'endless', 'garden', 'garden-sunny', 'garden-water', 'garden-cloud', 'collection', 'daily', 'services', 'debug']);
function validateLocation(record: FoundationPrefabRecord): void {
    if (!record || typeof record.id !== 'string' || !record.id || !UUID.test(record.uuid)
        || !BUNDLES.has(record.bundle) || typeof record.resourcePath !== 'string'
        || !/^[A-Za-z0-9_/-]+$/.test(record.resourcePath)
        || record.resourcePath.split('/').some(part => !part || part === '.' || part === '..')) {
        throw new Error(`Invalid registered resource location: ${record?.id}`);
    }
}
function validateImage(record: ImageRecord): void {
    validateLocation(record);
    if (record.spriteFrameUuid !== record.uuid + '@f9941' || !HASH.test(record.sourceSha256)
        || !Array.isArray(record.size) || record.size.length !== 2
        || record.size.some(value => !Number.isSafeInteger(value) || value <= 0)) {
        throw new Error(`Invalid source-art identity or dimensions: ${record.id}`);
    }
    const root = record.bundle === 'boot' ? 'assets/resources/boot/'
        : record.bundle === 'resources' ? 'assets/resources/' : `assets/bundles/${record.bundle}/`;
    const expectedPath = root + record.resourcePath.replace(/\/spriteFrame$/, '') + '.png';
    if (!record.resourcePath.endsWith('/spriteFrame') || record.assetPath !== expectedPath) {
        throw new Error(`Source-art path does not match its registered bundle: ${record.id}`);
    }
}

/**
 * Canonical art and Prefab registration boundary. Build tooling verifies source
 * file hashes; this runtime validates that the complete registration is coherent
 * before ResourceLoader is allowed to resolve any Cocos resource.
 */
export class GardenAssetStore {
    private readonly loader: ResourceLoader;

    public constructor(artManifest: FoundationArtManifest, registry: FoundationPrefabRegistry) {
        if (!artManifest || artManifest.schema !== 'hexa.prefab-foundation.art.v1'
            || !Array.isArray(artManifest.records) || !Array.isArray(artManifest.derivatives)
            || artManifest.sourceCount !== artManifest.records.length || !registry || !Array.isArray(registry.prefabs)) {
            throw new Error('Missing or unsupported source-art manifest / Prefab registry');
        }
        const registered: RegisteredResource[] = [];
        const sourceById = new Map<string, ImageRecord>();
        const ids = new Set<string>(), uuids = new Set<string>();
        const add = (record: RegisteredResource): void => {
            if (ids.has(record.id) || uuids.has(record.uuid)) throw new Error(`Duplicate resource registration: ${record.id}`);
            ids.add(record.id); uuids.add(record.uuid); registered.push(record);
        };
        const imageResource = (image: ImageRecord): RegisteredResource<SpriteFrame> => ({
            id: image.id, bundle: image.bundle === 'boot' ? 'resources' : image.bundle,
            path: image.bundle === 'boot' ? 'boot/' + image.resourcePath : image.resourcePath,
            type: SpriteFrame, uuid: image.spriteFrameUuid,
        });
        for (const image of artManifest.records) {
            validateImage(image);
            if (image.sourceId) throw new Error(`Original art cannot refer to another source: ${image.id}`);
            if (sourceById.has(image.id)) throw new Error(`Duplicate canonical artwork ID: ${image.id}`);
            sourceById.set(image.id, image); add(imageResource(image));
        }
        for (const image of artManifest.derivatives) {
            validateImage(image);
            const source = image.sourceId ? sourceById.get(image.sourceId) : undefined;
            if (!source || source.sourceSha256 !== image.sourceSha256 || image.bundle !== source.bundle
                || !image.sha256 || !HASH.test(image.sha256) || !image.generatorSha256 || !HASH.test(image.generatorSha256)) {
                throw new Error(`Invalid derivative provenance: ${image.id}`);
            }
            add(imageResource(image));
        }
        for (const prefab of registry.prefabs) {
            validateLocation(prefab);
            if (prefab.bundle === 'debug' && !DEBUG) continue;
            add({ id: 'prefab:' + prefab.id, bundle: prefab.bundle === 'boot' ? 'resources' : prefab.bundle,
                path: prefab.bundle === 'boot' ? 'boot/' + prefab.resourcePath : prefab.resourcePath,
                type: Prefab, uuid: prefab.uuid });
        }
        for (const document of registry.dataAssets || []) {
            validateLocation(document);
            add({ id: document.id, bundle: document.bundle, path: document.resourcePath, type: JsonAsset, uuid: document.uuid });
        }
        const bundleDependencies: Record<string, readonly string[]> = {};
        for (const record of registered) if (record.bundle !== 'common') bundleDependencies[record.bundle] = ['common'];
        this.loader = new ResourceLoader(registered, { bundleDependencies, aliases: registry.aliases });
    }

    public createScope(): ResourceScope { return this.loader.createScope(); }
    public get activeEntryCount(): number { return this.loader.activeEntryCount; }
}
