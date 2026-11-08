/** Targets are registered by their owning view, never discovered by node names. */
export class GuideTargetRegistry<T> {
    private readonly targets = new Map<string, T>();
    public register(id: string, target: T): () => void {
        if (!id || !target) throw new Error('Guide target requires an ID and target');
        if (this.targets.has(id)) throw new Error(`Guide target already registered: ${id}`);
        this.targets.set(id, target);
        return () => { if (this.targets.get(id) === target) this.targets.delete(id); };
    }
    public resolve(id: string): T | null { return this.targets.get(id) ?? null; }
    public clear(): void { this.targets.clear(); }
}
