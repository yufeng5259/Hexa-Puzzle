export type Cleanup = () => void;

/** Engine-independent visible subscription lifetime and request identity. */
export class ViewLifetime {
    private visible = false;
    private closed = false;
    private revision = 0;
    private cleanups: Cleanup[] = [];
    public get isVisible(): boolean { return this.visible; }
    public get isClosed(): boolean { return this.closed; }
    public show(): boolean {
        if (this.closed) throw new Error('Cannot show a closed view');
        if (this.visible) return false;
        this.visible = true; this.revision++; return true;
    }
    public hide(): boolean {
        if (!this.visible) return false;
        this.visible = false; this.revision++;
        const cleanups = this.cleanups; this.cleanups = [];
        let failure: unknown;
        for (const cleanup of cleanups.reverse()) {
            try { cleanup(); } catch (error) { if (!failure) failure = error; }
        }
        if (failure) throw failure;
        return true;
    }
    public addCleanup(cleanup: Cleanup): void {
        if (!this.visible || this.closed) throw new Error('Visible cleanup requires a shown view');
        this.cleanups.push(cleanup);
    }
    public requestIdentity(): () => boolean {
        const revision = this.revision;
        return () => this.visible && !this.closed && this.revision === revision;
    }
    public close(): void {
        if (this.closed) return;
        try { this.hide(); } finally { this.closed = true; this.revision++; }
    }
}
