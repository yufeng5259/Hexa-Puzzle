import { _decorator, CCString, Component, isValid, Label, Node, ProgressBar, Sprite, SpriteFrame, UITransform } from 'cc';
import { requireBinding } from '../../framework/components/Binding';
import type { ResourceScope } from '../../framework/resources/ResourceScope';
const { ccclass, property } = _decorator;

export interface PresentationBox { x: number; y: number; width: number; height: number; }
export interface PresentationData {
    values?: Record<string, string | number>;
    /** Omitted restores the Prefab's original frame; null explicitly clears it. */
    bodyAssetId?: string | null;
    rotorAssetId?: string | null;
    bodyBox?: PresentationBox;
    rotorBox?: PresentationBox;
    rootSize?: [number, number];
    accentAssetIds?: (string | null)[];
    accentBoxes?: PresentationBox[];
    labelBoxes?: PresentationBox[];
    labelFontSizes?: number[];
}

function validateBox(box: PresentationBox, owner: string, field: string): void {
    if (!box || typeof box !== 'object' || Array.isArray(box)
        || ![box.x, box.y, box.width, box.height].every(entry => typeof entry === 'number' && Number.isFinite(entry))
        || box.width <= 0 || box.height <= 0) throw new Error(`${owner}: ${field} must contain finite x/y and positive width/height`);
}

export function presentationData(value: unknown, owner: string): PresentationData {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${owner}: presentation data must be an object`);
    const data = value as PresentationData;
    if (data.values !== undefined && (!data.values || typeof data.values !== 'object' || Array.isArray(data.values)
        || Object.keys(data.values).some(key => {
            const entry = data.values![key];
            return typeof entry !== 'string' && (typeof entry !== 'number' || !Number.isFinite(entry));
        }))) {
        throw new Error(`${owner}: values must contain finite numbers or strings`);
    }
    for (const field of ['bodyAssetId', 'rotorAssetId'] as const) {
        if (data[field] !== undefined && data[field] !== null && (typeof data[field] !== 'string' || !data[field]!.trim())) {
            throw new Error(`${owner}: ${field} must be a registered ID or null`);
        }
    }
    for (const field of ['bodyBox', 'rotorBox'] as const) {
        const box = data[field];
        if (box !== undefined) validateBox(box, owner, field);
    }
    if (data.rootSize !== undefined && (!Array.isArray(data.rootSize) || data.rootSize.length !== 2
        || !Array.from(data.rootSize).every(entry => typeof entry === 'number' && Number.isFinite(entry) && entry > 0))) {
        throw new Error(`${owner}: rootSize must contain two positive finite dimensions`);
    }
    if (data.accentAssetIds !== undefined) {
        if (!Array.isArray(data.accentAssetIds)) throw new Error(`${owner}: accentAssetIds must be an array`);
        for (let i = 0; i < data.accentAssetIds.length; i++) {
            const id = data.accentAssetIds[i];
            if (id !== null && (typeof id !== 'string' || !id.trim())) throw new Error(`${owner}: accentAssetIds[${i}] must be a registered ID or null`);
        }
    }
    for (const field of ['accentBoxes', 'labelBoxes'] as const) {
        const boxes = data[field];
        if (boxes !== undefined) {
            if (!Array.isArray(boxes)) throw new Error(`${owner}: ${field} must be an array`);
            for (let i = 0; i < boxes.length; i++) validateBox(boxes[i], owner, `${field}[${i}]`);
        }
    }
    if (data.labelFontSizes !== undefined && (!Array.isArray(data.labelFontSizes)
        || !Array.from(data.labelFontSizes).every(size => typeof size === 'number' && Number.isFinite(size) && size > 0))) {
        throw new Error(`${owner}: labelFontSizes must contain positive finite numbers`);
    }
    return data;
}
export function parsePresentationData(json: string, owner: string): PresentationData {
    let value: unknown;
    try { value = json.trim() ? JSON.parse(json) : {}; }
    catch { throw new Error(`${owner}: invalid presentation JSON`); }
    return presentationData(value, owner);
}
export function mergePresentationData(base: PresentationData, override: PresentationData): PresentationData {
    return { ...base, ...override, values: { ...base.values, ...override.values } };
}
export function validateValueBindings(owner: string, labels: readonly Label[], labelKeys: readonly string[],
    bars: readonly ProgressBar[], barKeys: readonly string[], values: PresentationData['values']): void {
    if (labels.length !== labelKeys.length || bars.length !== barKeys.length) throw new Error(`${owner}: value binding array lengths differ`);
    for (let i = 0; i < labels.length; i++) {
        requireBinding(owner, `labels[${i}]`, labels[i]);
        if (!labelKeys[i] || !Object.prototype.hasOwnProperty.call(values || {}, labelKeys[i])) throw new Error(`${owner}: missing value '${labelKeys[i]}'`);
    }
    for (let i = 0; i < bars.length; i++) {
        requireBinding(owner, `progressBars[${i}]`, bars[i]);
        const value = values?.[barKeys[i]];
        if (!barKeys[i] || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
            throw new Error(`${owner}: progress '${barKeys[i]}' must be a number in 0..1`);
        }
    }
}
export function applyValueBindings(labels: readonly Label[], labelKeys: readonly string[], bars: readonly ProgressBar[],
    barKeys: readonly string[], values: PresentationData['values']): void {
    labels.forEach((label, i) => { label.string = String(values![labelKeys[i]]); });
    bars.forEach((bar, i) => { bar.progress = values![barKeys[i]] as number; });
}
interface OriginalBox extends PresentationBox { node: Node; transform: UITransform; z: number; }
function captureBox(node: Node | null): OriginalBox | null {
    if (!node) return null;
    const transform = node.getComponent(UITransform);
    if (!transform) return null;
    const { x, y, z } = node.position;
    return { node, transform, x, y, z, width: transform.width, height: transform.height };
}
function applyBox(original: OriginalBox | null, box: PresentationBox | undefined): void {
    if (!original) return;
    requireBinding('PresentationItem', 'bound UITransform', original.transform).setContentSize(box?.width ?? original.width, box?.height ?? original.height);
    requireBinding('PresentationItem', 'bound node', original.node).setPosition(box?.x ?? original.x, box?.y ?? original.y, original.z);
}

/** Display-only root on reusable item Prefabs. ResourceScope belongs to the page. */
@ccclass('PresentationItem')
export class PresentationItem extends Component {
    @property(Sprite) public body: Sprite | null = null;
    @property(Sprite) public rotor: Sprite | null = null;
    @property(Node) public rotorRoot: Node | null = null;
    @property([Sprite]) public accents: Sprite[] = [];
    @property([Label]) public labels: Label[] = [];
    @property([CCString]) public labelKeys: string[] = [];
    @property([ProgressBar]) public bars: ProgressBar[] = [];
    @property([CCString]) public barKeys: string[] = [];
    @property(CCString) public previewData = '';
    private revision = 0;
    private disposed = false;
    private capturedDefaults = false;
    private originalBody: SpriteFrame | null = null;
    private originalRotor: SpriteFrame | null = null;
    private originalBodyBox: OriginalBox | null = null;
    private originalRotorBox: OriginalBox | null = null;
    private originalAccents: (SpriteFrame | null)[] = [];
    private originalAccentBoxes: (OriginalBox | null)[] = [];
    private originalLabelBoxes: (OriginalBox | null)[] = [];
    private originalLabelFonts: { fontSize: number; lineHeight: number }[] = [];
    private originalRoot: { transform: UITransform; width: number; height: number } | null = null;

    public async present(scope: ResourceScope, overrides: PresentationData = {}): Promise<void> {
        const revision = ++this.revision;
        if (!this.canWrite(revision)) return;
        if (scope.isReleased) throw new Error('PresentationItem: borrowed resource scope is released');
        const data = mergePresentationData(parsePresentationData(this.previewData, 'PresentationItem.previewData'), presentationData(overrides, 'PresentationItem'));
        validateValueBindings('PresentationItem', this.labels, this.labelKeys, this.bars, this.barKeys, data.values);
        if (data.bodyAssetId !== undefined || data.bodyBox !== undefined) requireBinding('PresentationItem', 'body', this.body);
        if (data.rotorAssetId !== undefined || data.rotorBox !== undefined) {
            requireBinding('PresentationItem', 'rotor', this.rotor);
            requireBinding('PresentationItem', 'rotorRoot', this.rotorRoot);
        }
        if (data.bodyBox !== undefined) requireBinding('PresentationItem', 'body.UITransform', this.body!.node.getComponent(UITransform));
        if (data.rotorBox !== undefined) requireBinding('PresentationItem', 'rotor.UITransform', this.rotor!.node.getComponent(UITransform));
        if (data.rootSize !== undefined) requireBinding('PresentationItem', 'root.UITransform', this.node.getComponent(UITransform));
        if ((data.accentAssetIds !== undefined && data.accentAssetIds.length !== this.accents.length)
            || (data.accentBoxes !== undefined && data.accentBoxes.length !== this.accents.length)
            || (data.labelBoxes !== undefined && data.labelBoxes.length !== this.labels.length)
            || (data.labelFontSizes !== undefined && data.labelFontSizes.length !== this.labels.length)) {
            throw new Error('PresentationItem: accent/label array lengths do not match Inspector bindings');
        }
        this.accents.forEach((accent, i) => {
            requireBinding('PresentationItem', `accents[${i}]`, accent);
            if (data.accentBoxes !== undefined) requireBinding('PresentationItem', `accents[${i}].UITransform`, accent.node.getComponent(UITransform));
        });
        if (data.labelBoxes !== undefined) this.labels.forEach((label, i) => requireBinding('PresentationItem', `labels[${i}].UITransform`, label.node.getComponent(UITransform)));
        if (!this.capturedDefaults) {
            this.originalBody = this.body?.spriteFrame ?? null;
            this.originalRotor = this.rotor?.spriteFrame ?? null;
            this.originalBodyBox = captureBox(this.body?.node ?? null);
            this.originalRotorBox = captureBox(this.rotor?.node ?? null);
            this.originalAccents = this.accents.map(accent => accent.spriteFrame);
            this.originalAccentBoxes = this.accents.map(accent => captureBox(accent.node));
            this.originalLabelBoxes = this.labels.map(label => captureBox(label.node));
            this.originalLabelFonts = this.labels.map(label => ({ fontSize: label.fontSize, lineHeight: label.lineHeight }));
            const transform = this.node.getComponent(UITransform);
            if (transform) this.originalRoot = { transform, width: transform.width, height: transform.height };
            this.capturedDefaults = true;
        }
        if (data.labelFontSizes !== undefined) this.originalLabelFonts.forEach((original, i) => {
            if (!(original.fontSize > 0)) throw new Error(`PresentationItem: labels[${i}] has invalid original fontSize`);
        });
        try {
            const [body, rotor, accents] = await Promise.all([
                data.bodyAssetId ? scope.load(data.bodyAssetId, SpriteFrame) : Promise.resolve(data.bodyAssetId === null ? null : this.originalBody),
                data.rotorAssetId ? scope.load(data.rotorAssetId, SpriteFrame) : Promise.resolve(data.rotorAssetId === null ? null : this.originalRotor),
                Promise.all(this.accents.map((_, i) => {
                    const id = data.accentAssetIds?.[i];
                    return id ? scope.load(id, SpriteFrame) : Promise.resolve(id === null ? null : this.originalAccents[i]);
                })),
            ]);
            if (!this.canWrite(revision) || scope.isReleased) return;
            if (this.body) this.body.spriteFrame = body;
            if (this.rotor) this.rotor.spriteFrame = rotor;
            this.accents.forEach((accent, i) => { accent.spriteFrame = accents[i]; });
            applyValueBindings(this.labels, this.labelKeys, this.bars, this.barKeys, data.values);
            this.labels.forEach((label, i) => {
                const original = this.originalLabelFonts[i], size = data.labelFontSizes?.[i];
                label.fontSize = size ?? original.fontSize;
                label.lineHeight = size === undefined ? original.lineHeight : original.lineHeight * size / original.fontSize;
            });
            if (this.originalRoot) requireBinding('PresentationItem', 'root.UITransform', this.originalRoot.transform)
                .setContentSize(data.rootSize?.[0] ?? this.originalRoot.width, data.rootSize?.[1] ?? this.originalRoot.height);
            applyBox(this.originalBodyBox, data.bodyBox);
            applyBox(this.originalRotorBox, data.rotorBox);
            this.originalAccentBoxes.forEach((box, i) => applyBox(box, data.accentBoxes?.[i]));
            this.originalLabelBoxes.forEach((box, i) => applyBox(box, data.labelBoxes?.[i]));
        } catch (error) { if (this.canWrite(revision) && !scope.isReleased) throw error; }
    }

    public cancelPending(): void { this.revision++; }
    public onDisable(): void { this.cancelPending(); }
    public onDestroy(): void { this.disposed = true; this.cancelPending(); }
    private canWrite(revision: number): boolean {
        return !this.disposed && revision === this.revision && isValid(this, true) && this.enabled && this.node.activeInHierarchy;
    }
}
