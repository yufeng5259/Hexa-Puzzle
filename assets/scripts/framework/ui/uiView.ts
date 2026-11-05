import { UILayer, UIQueue } from './UILayer';

export interface UIViewMeta {
    /** Asset bundle name; 'resources' for the main package. */
    readonly bundle: string;
    /** Prefab path inside the bundle. */
    readonly path: string;
    readonly layer: UILayer;
    readonly queue: UIQueue;
    /** 'scale' for popups, 'fade' for pages, 'none' for instant. */
    readonly transition: 'scale' | 'fade' | 'none';
}

const metas = new Map<Function, UIViewMeta>();

/** Replaces BigHero ViewMetadata (2.x `cc._RF.peek()` registration) with a class decorator. */
export function uiView(meta: UIViewMeta) {
    return (target: Function) => { metas.set(target, meta); };
}

export function viewMeta(type: Function): UIViewMeta {
    const meta = metas.get(type);
    if (!meta) throw new Error('Missing @uiView on ' + type.name);
    return meta;
}
