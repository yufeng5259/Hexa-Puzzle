import type { GuideStepRow } from '../config/MetaManager';
export interface GuideEvent { readonly type: string; readonly [key: string]: unknown }
export interface GuideContext { phase: 'puzzle' | 'build' | 'welcome' | 'complete'; pageId: string; mode?: string; stepId?: string | null; attemptId?: string; mapId?: string; placements?: Readonly<Record<string, { q: number; r: number }>> }
export interface GuidePorts {
    present(step: GuideStepRow): void;
    clear(): void;
    persistStep?(id: string | null): void;
    onError?(message: string): void;
}
/** Configured transitions consume committed business events, not button clicks. */
export class GuideManager {
    private readonly byId: Map<string, GuideStepRow>;
    private step: GuideStepRow | null = null;
    private context: GuideContext | null = null;
    private suspended = false;
    private pendingEvent: GuideEvent | null = null;
    private pendingStep: GuideStepRow | null | undefined;
    public constructor(private readonly steps: readonly GuideStepRow[], private readonly ports: GuidePorts) {
        this.byId = new Map(steps.map(step => [step.id, step]));
        if (this.byId.size !== steps.length) throw new Error('Duplicate guide steps');
        for (const step of steps) if (step.nextStepId && !this.byId.has(step.nextStepId)) throw new Error(`Missing guide next step: ${step.nextStepId}`);
    }
    public get activeStep(): GuideStepRow | null { return this.step; }
    public get currentStep(): GuideStepRow | null { return this.step; }
    /** Permission follows durable teaching state, never whether a visual happens to be visible. */
    public allowsAction(action: string): boolean {
        if (this.context?.phase === 'complete') return true;
        if (!this.step || this.suspended) return false;
        if (this.step.skippable) return true;
        const allowed = this.step.params.allowedActions;
        return Array.isArray(allowed) && allowed.includes(action);
    }
    public allowsPiece(pieceId: string): boolean {
        return this.allowsAction('puzzle:drag') && (this.step?.action !== 'drag' || this.step.params.pieceId === pieceId);
    }
    public allowsPlacement(pieceId: string, target: { q: number; r: number }): boolean {
        if (!this.allowsPiece(pieceId)) return false;
        if (this.step?.action !== 'drag') return true;
        const expected = this.step.params.targetCell as { q: number; r: number } | undefined;
        return !!expected && expected.q === target.q && expected.r === target.r;
    }
    /** Entry point for later configured groups; trigger and page must explicitly match. */
    public start(stepId: string, context: GuideContext, trigger: GuideEvent): boolean {
        const step = this.byId.get(stepId);
        if (!step) throw new Error(`Unknown guide step: ${stepId}`);
        if (step.triggerEvent !== trigger.type) return false;
        this.context = { ...context }; this.suspended = false; this.pendingEvent = null;
        return this.setStep(step);
    }
    public resume(context: GuideContext): void {
        this.context = { ...context }; this.suspended = false; this.pendingEvent = null;
        if (context.phase === 'complete') { this.step = null; this.ports.clear(); return; }
        let step: GuideStepRow | undefined;
        if (context.phase === 'puzzle') {
            const saved = context.stepId ? this.byId.get(context.stepId) : undefined;
            const lessons = this.steps.filter(item => item.action === 'drag' && item.pageId === 'puzzle');
            if (context.placements) {
                // Saved placements remain authoritative when an older save only taught one piece,
                // or the business placement committed before the guide step could be saved.
                step = lessons.find(item => {
                    const target = item.params.targetCell as { q: number; r: number } | undefined;
                    const placed = context.placements![item.params.pieceId as string];
                    return !target || !placed || placed.q !== target.q || placed.r !== target.r;
                }) ?? this.steps.find(item => item.action === 'wait' && item.pageId === 'puzzle');
            } else step = saved?.pageId === 'puzzle' ? saved : lessons[0];
        } else if (context.phase === 'welcome') step = this.steps.find(item => item.targetId === 'welcome.claim');
        else if (context.pageId === 'result') step = this.steps.find(item => item.targetId === 'result.home');
        else if (context.mode === 'build' || context.pageId === 'build') step = this.steps.find(item => item.targetId === 'building.slot1.upgrade');
        else step = this.steps.find(item => item.targetId === 'home.build');
        this.setStep(step ?? null);
    }
    public onEvent(event: GuideEvent): boolean {
        if (this.suspended || !this.step || !this.context) return false;
        const step = this.step;
        if (event.type !== step.completeEvent || !this.matches(step, event)) return false;
        const next = step.nextStepId ? this.byId.get(step.nextStepId)! : null;
        if (event.type === 'page.ready' && typeof event.pageId === 'string') {
            this.context.pageId = event.pageId;
            this.context.mode = typeof event.mode === 'string' ? event.mode : undefined;
        }
        const applied = this.setStep(next);
        this.pendingEvent = applied ? null : event;
        return applied;
    }
    /** Page readiness may arrive before its business step's completion event. */
    public pageReady(pageId: string, mode?: string): void {
        if (!this.context) return;
        this.context.pageId = pageId; this.context.mode = mode;
        this.render();
    }
    public suspend(): void { this.suspended = true; this.ports.clear(); }
    public retry(): void {
        this.suspended = false;
        if (this.pendingEvent) this.onEvent(this.pendingEvent);
        else if (this.pendingStep !== undefined) this.setStep(this.pendingStep);
        else this.render();
    }
    public dispose(): void { this.suspended = true; this.step = null; this.context = null; this.pendingEvent = null; this.pendingStep = undefined; this.ports.clear(); }
    private matches(step: GuideStepRow, event: GuideEvent): boolean {
        if (event.attemptId && this.context?.attemptId && event.attemptId !== this.context.attemptId) return false;
        if (event.mapId && this.context?.mapId && event.mapId !== this.context.mapId) return false;
        for (const key of ['mapId', 'slotId', 'pieceId', 'pageId', 'mode']) {
            const expected = step.params[key];
            if (expected !== undefined && event[key] !== expected) return false;
        }
        const expectedStage = step.params.expectedStage;
        if (expectedStage !== undefined && (typeof event.stage !== 'number' || event.stage < Number(expectedStage))) return false;
        const target = step.params.targetCell as { q?: unknown; r?: unknown } | undefined;
        const actual = event.targetCell as { q?: unknown; r?: unknown } | undefined;
        if (target && (!actual || target.q !== actual.q || target.r !== actual.r)) return false;
        return true;
    }
    private setStep(next: GuideStepRow | null): boolean {
        try { this.ports.persistStep?.(next?.id ?? null); }
        catch (error) { this.pendingStep = next; this.ports.clear(); this.ports.onError?.(`Guide state save failed: ${String(error)}`); return false; }
        this.pendingStep = undefined; this.step = next; this.render();
        return true;
    }
    private render(): void {
        this.ports.clear();
        if (!this.suspended && this.step && this.context && this.pageMatches(this.step)) {
            try { this.ports.present(this.step); }
            catch (error) { this.ports.clear(); this.ports.onError?.(`Guide presentation failed: ${String(error)}`); }
        }
    }
    private pageMatches(step: GuideStepRow): boolean {
        return step.pageId === this.context!.pageId || step.pageId === 'build' && this.context!.pageId === 'home' && this.context!.mode === 'build';
    }
}
