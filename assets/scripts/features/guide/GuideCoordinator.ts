import { isValid, type Node } from 'cc';
import type { MetaManager, GuideStepRow } from '../config/MetaManager';
import type { GameServices, ProgressionEvent } from '../progression/GameServices';
import type { FirstReleasePuzzleView } from '../puzzle/ui/FirstReleasePuzzleView';
import type { HomeBuildView } from '../home/ui/HomeBuildView';
import type { FirstReleaseDialogView } from '../common/ui/FirstReleaseDialogView';
import { GuideManager, type GuideEvent } from './GuideManager';
import { GuideTargetRegistry } from './GuideTargetRegistry';
import type { GuideOverlayView, GuideTarget } from './GuideOverlayView';
import { guidePresentation } from './GuidePresentation';

const TEXT: Record<string, string> = {
    'guide.drag': '把这块拼图拖到亮起的位置', 'guide.finishPuzzle': '把剩余拼块放入棋盘，完成拼图吧！',
    'guide.drag2': '再把这块拼图拖到亮起的位置', 'guide.drag3': '最后一块，拖到亮起的位置吧！',
    'guide.home': '获得蜜蜂币啦，回家建造吧！', 'guide.build': '点击锤子，进入建造',
    'guide.upgrade': '用刚赚到的蜜蜂币，升级第一栋建筑！',
};
type Cell = { q: number; r: number };

/** What the composition root currently shows; the coordinator never navigates by itself. */
export interface GuideRoute {
    route: string;
    homeMode: 'home' | 'build';
    dialogKind: string;
    puzzle: FirstReleasePuzzleView | null;
    home: HomeBuildView | null;
    dialog: FirstReleaseDialogView | null;
}
export interface GuideHost {
    route(): GuideRoute;
    notice(message: string, sticky: boolean): void;
    clearNotice(): void;
    /** Node the player taps to recover from a failed guide save/presentation. */
    recoveryNode(): Node;
}

/** Owns every first-session guide concern: targets, resume, event delivery, retry and input gates. */
export class GuideCoordinator {
    private readonly steps: readonly GuideStepRow[];
    private readonly manager: GuideManager;
    public readonly targets = new GuideTargetRegistry<GuideTarget>();
    private retryPending = false;
    private recovery = false;

    public constructor(private readonly meta: MetaManager, private readonly services: GameServices,
        private readonly overlay: GuideOverlayView, private readonly host: GuideHost, inputRoot: Node) {
        this.steps = meta.getGuideSteps(meta.getConstant<string>('firstGuideGroupId'));
        overlay.configure(this.targets, inputRoot, key => TEXT[key] || key);
        overlay.allowRecoveryTarget = target => this.recovery && target === host.recoveryNode();
        overlay.onTargetsUnavailable = () => { host.route().puzzle?.controller?.cancelDrag(); };
        overlay.onFailure = message => this.fail('引导提示加载失败，点击上方提示重试', message);
        this.manager = new GuideManager(this.steps, {
            present: step => this.present(step),
            clear: () => { overlay.clearGuide(); host.route().puzzle?.controller?.clearGuidePreview(); },
            persistStep: id => { services.setGuideStep(id); },
            onError: message => this.fail('引导进度暂时无法保存，正在重试；也可点击此处重试', message),
        });
    }

    public get recoveryAvailable(): boolean { return this.recovery; }
    public get activeStep(): GuideStepRow | null { return this.manager.activeStep; }

    /** One permission answer for buttons, tray paging and puzzle drags. */
    public allowsAction(action: string): boolean {
        if (this.services.getGuidePhase() === 'complete') return true;
        return this.manager.allowsAction(action) && this.overlay.isReadyForInput;
    }

    /** Installs the teaching constraints on the live puzzle; ordinary rules stay in the session. */
    public attachPuzzle(view: FirstReleasePuzzleView, blocked: () => boolean): void {
        const controller = view.controller!, free = () => this.services.getGuidePhase() === 'complete';
        view.allowAction = action => this.allowsAction(action);
        controller.allowPointerStart = (x, y, id) => !blocked() && this.allowsAction('puzzle:drag') && this.overlay.acceptsPointerStart(x, y, id);
        controller.allowPieceStart = pieceId => free() || this.manager.allowsPiece(pieceId);
        controller.allowPlacement = (pieceId, translation) => this.allowsAction('puzzle:drag') && (free() || this.manager.allowsPlacement(pieceId, translation));
        controller.onDragStateChanged = dragging => {
            if (isValid(this.overlay, true)) this.overlay.setDragging(dragging, dragging ? () => view.draggedGuidePolygons() : null);
        };
    }

    public suspend(): void { this.manager.suspend(); }
    public retry(): void { this.manager.retry(); }

    /** Re-registers the visible targets and resumes from durable state; call after every route/dialog change. */
    public sync(puzzleEntered = false): void { this.bindTargets(); this.resume(puzzleEntered); }

    /** Delivers committed business events in order; placements carry the persisted target cell. */
    public deliver(events: readonly ProgressionEvent[]): void {
        for (const event of events) {
            const detail: GuideEvent = { ...event };
            if (event.type === 'puzzle.placementCommitted' && event.pieceId) {
                const placement = this.services.state.activeAttempt?.snapshot?.placements[event.pieceId];
                if (placement) (detail as Record<string, unknown>).targetCell = placement;
            }
            this.manager.onEvent(detail);
        }
        if (this.services.getGuidePhase() === 'complete') this.resume();
    }

    public tick(): void {
        if (!this.retryPending) return;
        this.retryPending = false; this.manager.retry(); this.reconcilePlacements();
    }

    public dispose(): void { this.manager.dispose(); this.targets.clear(); }

    private fail(notice: string, message: string): void {
        this.retryPending = true; this.recovery = true;
        this.host.notice(notice, true); console.warn(message);
    }

    private present(step: GuideStepRow): void {
        this.overlay.presentStep(step);
        if (this.overlay.isReadyForInput) {
            this.retryPending = false;
            if (this.recovery) { this.recovery = false; this.host.clearNotice(); }
        }
        if (step.params.highlightProvider === 'puzzlePlacementPreview') {
            this.host.route().puzzle?.controller?.setGuidePreview(step.params.pieceId as string, step.params.targetCell as Cell, guidePresentation(step.params.presentation));
        }
    }

    /** Registers only what the current page shows; IDs come from the configured steps. */
    public bindTargets(): void {
        this.targets.clear();
        const route = this.host.route();
        if (route.route === 'puzzle' && route.puzzle?.session) {
            const puzzle = route.puzzle;
            puzzle.session!.level.pieces.forEach((piece, i) => {
                const id = 'puzzle.target' + i;
                const step = this.steps.find(row => row.params.dragDestinationTargetId === id && row.params.pieceId === piece.id);
                this.targets.register('puzzle.piece' + i, puzzle.guidePieceTarget(piece.id));
                this.targets.register(id, puzzle.guideDestinationTarget(piece.id, step?.params.targetCell as Cell | undefined));
            });
        }
        const ids = new Set(this.steps.map(step => step.targetId).filter((id): id is string => !!id && !id.startsWith('puzzle.')));
        if ((route.route === 'home' || route.route === 'build') && route.home) {
            for (const id of ids) { const target = route.home.getTarget(id); if (target) this.targets.register(id, target); }
        }
        if (route.dialogKind && route.dialog) {
            // A dialog only exposes the targets of its own kind, e.g. result.* on the result dialog.
            for (const id of ids) {
                if (!id.startsWith(route.dialogKind + '.')) continue;
                const target = route.dialog.getTarget(id); if (target) this.targets.register(id, target);
            }
        }
    }

    private resume(puzzleEntered = false): void {
        const route = this.host.route(), state = this.services.state;
        const context = { phase: this.services.getGuidePhase(),
            pageId: route.dialogKind === 'welcome' ? 'welcome' : route.dialogKind === 'result' ? 'result' : route.route === 'build' ? 'home' : route.route,
            mode: route.homeMode, stepId: state.guide.stepId, attemptId: state.activeAttempt?.attemptId,
            mapId: state.currentMapId, placements: state.activeAttempt?.snapshot?.placements ?? {} };
        if (context.phase === 'complete') {
            this.manager.onEvent({ type: 'guide.completed', mapId: context.mapId }); this.manager.resume(context); return;
        }
        if (puzzleEntered && context.phase === 'puzzle') {
            // A restarted teaching attempt has a new identity and needs its own drag lesson.
            // Resuming a saved attempt keeps its committed step; old-attempt win events stay rejected.
            if (!state.activeAttempt?.snapshot) context.stepId = null;
            this.manager.resume(context); this.reconcilePlacements(); return;
        }
        if (context.phase === 'welcome') { this.manager.resume(context); return; }
        const active = this.manager.activeStep;
        if (!active || context.phase === 'build' && active.pageId === 'puzzle') {
            // A timed-out or temporarily missing puzzle target may have suspended event delivery.
            // Durable first-win state still resumes the reward/build lesson on the actual page.
            this.manager.resume(context);
        } else {
            this.manager.retry();
            // Only actual laid-out page readiness advances configured cross-page steps.
            this.manager.onEvent({ type: 'page.ready', pageId: context.pageId, mode: context.mode, attemptId: context.attemptId, mapId: context.mapId });
            this.manager.pageReady(context.pageId, context.mode);
        }
        this.reconcilePlacements();
    }

    /** Placements committed before their step was saved still complete their drag lessons. */
    private reconcilePlacements(): void {
        const attempt = this.services.state.activeAttempt;
        if (!attempt) return;
        for (let i = 0; i < this.steps.length; i++) {
            const step = this.manager.activeStep;
            if (step?.action !== 'drag') return;
            const pieceId = step.params.pieceId as string, targetCell = attempt.snapshot?.placements[pieceId];
            if (!targetCell || !this.manager.onEvent({ type: 'puzzle.placementCommitted', attemptId: attempt.attemptId, pieceId, targetCell })) return;
        }
    }
}
