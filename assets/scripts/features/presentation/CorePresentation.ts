import { _decorator, CCString, Component, instantiate, isValid, Label, Node, Prefab, ProgressBar } from 'cc';
import { requireBinding } from '../../framework/components/Binding';
import type { ResourceScope } from '../../framework/resources/ResourceScope';
import { applyValueBindings, mergePresentationData, parsePresentationData, PresentationData, presentationData,
    PresentationItem, validateValueBindings } from './PresentationItem';
const { ccclass, property } = _decorator;

export interface CorePresentationData {
    values?: Record<string, string | number>;
    items?: readonly (PresentationData | null)[];
}
interface MountedItem { index: number; mount: Node; prefab: Prefab; node: Node; item: PresentationItem; }

/** One component per stateRoot. Fixed mounts keep source geometry and layer order. */
@ccclass('CorePresentation')
export class CorePresentation extends Component {
    @property(Node) public actionTarget: Node | null = null;
    @property([Node]) public itemMounts: Node[] = [];
    @property([Prefab]) public itemPrefabs: Prefab[] = [];
    @property([CCString]) public itemData: string[] = [];
    @property([Label]) public labels: Label[] = [];
    @property([CCString]) public labelKeys: string[] = [];
    @property([ProgressBar]) public progressBars: ProgressBar[] = [];
    @property([CCString]) public progressKeys: string[] = [];
    @property(CCString) public previewData = '';
    private instances: MountedItem[] = [];
    private revision = 0;
    private disposed = false;
    private actionsBound = false;

    public get mountedItems(): readonly PresentationItem[] { return this.instances.map(entry => entry.item); }

    public async present(scope: ResourceScope, overrides: CorePresentationData = {}, excludedMounts: readonly Node[] = []): Promise<void> {
        const revision = ++this.revision;
        if (!this.canWrite(revision)) return;
        if (scope.isReleased) throw new Error('CorePresentation: borrowed resource scope is released');
        let preview: unknown;
        try { preview = this.previewData.trim() ? JSON.parse(this.previewData) : {}; }
        catch { throw new Error('CorePresentation.previewData: invalid presentation JSON'); }
        const base = this.parseData(preview);
        const extra = this.parseData(overrides);
        const values = { ...base.values, ...extra.values };
        validateValueBindings('CorePresentation', this.labels, this.labelKeys, this.progressBars, this.progressKeys, values);
        if (this.itemMounts.length !== this.itemPrefabs.length || this.itemMounts.length !== this.itemData.length) {
            throw new Error('CorePresentation: item binding array lengths differ');
        }
        if ((base.items?.length ?? 0) > this.itemMounts.length || (extra.items?.length ?? 0) > this.itemMounts.length) {
            throw new Error('CorePresentation: item data exceeds registered mounts');
        }
        const data = this.itemData.map((json, i) => mergePresentationData(
            mergePresentationData(parsePresentationData(json, `CorePresentation.itemData[${i}]`), base.items?.[i] || {}), extra.items?.[i] || {}));
        if (this.itemMounts.length) requireBinding('CorePresentation', 'actionTarget', this.actionTarget);
        this.ensureInstances(excludedMounts);
        this.bindActions();
        applyValueBindings(this.labels, this.labelKeys, this.progressBars, this.progressKeys, values);
        try { await Promise.all(this.instances.map(entry => entry.item.present(scope, data[entry.index]))); }
        catch (error) { if (this.canWrite(revision) && !scope.isReleased) throw error; }
    }

    public onEnable(): void { this.bindActions(); }
    public onDisable(): void {
        this.revision++;
        this.unbindActions();
        for (const entry of this.instances) entry.item.cancelPending();
    }
    public onDestroy(): void {
        this.disposed = true; this.onDisable();
        for (const entry of this.instances) if (isValid(entry.node, true)) entry.node.destroy();
        this.instances = [];
    }
    private parseData(value: unknown): CorePresentationData {
        const data = presentationData(value, 'CorePresentation') as CorePresentationData;
        if (data.items !== undefined) {
            if (!Array.isArray(data.items)) throw new Error('CorePresentation: items must be an array');
            for (const item of data.items) if (item !== null) presentationData(item, 'CorePresentation.items');
        }
        return data;
    }
    private ensureInstances(excludedMounts: readonly Node[]): void {
        for (let i = 0; i < this.itemMounts.length; i++) {
            requireBinding('CorePresentation', `itemMounts[${i}]`, this.itemMounts[i]);
            const prefab = requireBinding('CorePresentation', `itemPrefabs[${i}]`, this.itemPrefabs[i]);
            requireBinding('CorePresentation', `itemPrefabs[${i}].PresentationItem`, prefab.data.getComponent(PresentationItem));
            const previous = this.instances.find(entry => entry.index === i);
            if (previous && (previous.mount !== this.itemMounts[i] || previous.prefab !== prefab)) {
                throw new Error('CorePresentation: mounted Prefab bindings changed after initialization');
            }
        }
        if (this.instances.some(entry => entry.index >= this.itemMounts.length)) throw new Error('CorePresentation: mounted Prefab bindings changed after initialization');
        const excluded = new Set(excludedMounts);
        this.unbindActions();
        this.instances = this.instances.filter(entry => {
            if (!excluded.has(entry.mount)) return true;
            entry.item.cancelPending(); entry.node.destroy(); return false;
        });
        try {
            for (let i = 0; i < this.itemMounts.length; i++) {
                if (excluded.has(this.itemMounts[i]) || this.instances.some(entry => entry.index === i)) continue;
                const node = instantiate(this.itemPrefabs[i]);
                const item = node.getComponent(PresentationItem);
                if (!item) { node.destroy(); throw new Error(`CorePresentation: instance[${i}] is missing PresentationItem`); }
                node.parent = this.itemMounts[i];
                this.instances.push({ index: i, mount: this.itemMounts[i], prefab: this.itemPrefabs[i], node, item });
            }
            this.instances.sort((a, b) => a.index - b.index);
        } catch (error) {
            for (const entry of this.instances) entry.node.destroy();
            this.instances = []; throw error;
        }
    }
    private canWrite(revision: number): boolean {
        return !this.disposed && revision === this.revision && isValid(this, true) && this.enabled && this.node.activeInHierarchy;
    }
    private bindActions(): void {
        if (this.actionsBound || !this.instances.length || this.disposed || !this.enabled || !this.node.activeInHierarchy) return;
        const target = requireBinding('CorePresentation', 'actionTarget', this.actionTarget);
        if (this.instances.some(entry => entry.node === target)) throw new Error('CorePresentation: actionTarget must be the owning page, not an item');
        for (const entry of this.instances) entry.node.on('view-action', this.forwardAction, this);
        this.actionsBound = true;
    }
    private unbindActions(): void {
        if (!this.actionsBound) return;
        for (const entry of this.instances) if (isValid(entry.node, true)) entry.node.off('view-action', this.forwardAction, this);
        this.actionsBound = false;
    }
    private forwardAction(payload: unknown): void {
        if (this.disposed || !this.enabled || !this.node.activeInHierarchy) return;
        const target = requireBinding('CorePresentation', 'actionTarget', this.actionTarget);
        if (target.activeInHierarchy) target.emit('view-action', payload);
    }
}
