import { _decorator, Camera, Color, Component, Game, game, Graphics, Input, input, isValid, Node, UIOpacity, UITransform, Vec3, view } from 'cc';
import type { EventTouch } from 'cc';
import { requireBinding } from '../../../framework/components/Binding';
import type { HexCell } from '../data/LevelDefinition';
import { PuzzleBoardPresentation } from '../presentation/PuzzleBoardPresentation';
import { nearestAxial, pieceCenter, type Point2 } from '../presentation/PuzzleLayout';
import { PuzzlePiecePresentation } from '../presentation/PuzzlePiecePresentation';
import type { PuzzleSession, PuzzleSessionSnapshot } from '../session/PuzzleSession';
const { ccclass, property } = _decorator;
const VALID_STROKE = new Color(100, 233, 141, 255), VALID_FILL = new Color(100, 233, 141, 65);
const INVALID_STROKE = new Color(239, 104, 91, 255), INVALID_FILL = new Color(239, 104, 91, 65);

interface Drag {
    pointerId: number;
    piece: PuzzlePiecePresentation;
    grab: Point2;
    candidate: HexCell | null;
    valid: boolean;
    outside: boolean;
}
export interface GuidePreviewPresentation { pulseDuration?: number; pulseMinOpacity?: number; pulseMaxOpacity?: number }

/** Engine input adapter. Session owns rules; the page owns all displayed assets. */
@ccclass('PuzzleController')
export class PuzzleController extends Component {
    @property(PuzzleBoardPresentation) public board: PuzzleBoardPresentation | null = null;
    @property(Node) public dragRoot: Node | null = null;
    @property(Node) public previewRoot: Node | null = null;
    @property(Graphics) public previewGraphics: Graphics | null = null;
    @property(UIOpacity) public previewOpacity: UIOpacity | null = null;
    /** Injected by the scene composition root; Prefabs cannot serialize a scene camera. */
    public inputCamera: Camera | null = null;
    public onOutcome: ((status: 'completed' | 'failed') => void) | null = null;
    public onError: ((error: unknown) => void) | null = null;
    public onDragStateChanged: ((dragging: boolean) => void) | null = null;
    /** Optional teaching constraint; the normal session still owns all placement rules. */
    public allowPlacement: ((pieceId: string, translation: HexCell) => boolean) | null = null;
    public allowPointerStart: ((x: number, y: number, pointerId: number) => boolean) | null = null;
    public allowPieceStart: ((pieceId: string) => boolean) | null = null;
    private guidePreview: { pieceId: string; target: HexCell; duration: number; min: number; max: number } | null = null;
    private pulseElapsed = 0;
    private background = false;
    private session: PuzzleSession | null = null;
    private drag: Drag | null = null;
    private listening = false;
    private notifiedAttempt: string | null = null;
    private disposed = false;
    /** Footprint currently drawn for the player's drag; unchanged candidates are not redrawn. */
    private drawnKey = '';
    /** UI capture and global input may both deliver one engine event; process it once. */
    private lastEvent: { event: EventTouch; x: number; y: number } | null = null;

    public get snapshot(): PuzzleSessionSnapshot | null { return this.session?.snapshot || null; }
    public get draggingPieceId(): string | null { return this.drag?.piece.pieceId || null; }

    /** Uses exactly the ordinary drop renderer; a lesson owns the preview until explicitly cleared. */
    public setGuidePreview(pieceId: string, targetCell: HexCell, presentation: GuidePreviewPresentation = {}): void {
        if (!this.session?.level.pieces.some(piece => piece.id === pieceId)) throw new Error('Unknown guide preview piece: ' + pieceId);
        requireBinding('PuzzleController', 'previewOpacity', this.previewOpacity);
        const next = { pieceId, target: { ...targetCell }, duration: presentation.pulseDuration ?? 1.1,
            min: presentation.pulseMinOpacity ?? 70, max: presentation.pulseMaxOpacity ?? 190 };
        if (![next.target.q, next.target.r].every(Number.isSafeInteger) || !Number.isFinite(next.duration) || next.duration <= 0
            || !Number.isFinite(next.min) || !Number.isFinite(next.max) || next.min < 0 || next.max > 255 || next.min > next.max)
            throw new Error('Invalid guide preview placement or pulse parameters');
        if (JSON.stringify(next) !== JSON.stringify(this.guidePreview)) this.pulseElapsed = 0;
        this.guidePreview = next; this.refreshGuidePreview();
    }
    public clearGuidePreview(): void {
        this.guidePreview = null; this.pulseElapsed = 0;
        if (isValid(this.previewOpacity, true)) this.previewOpacity!.opacity = 255;
        this.clearPreview();
        if (this.drag && this.listening) this.drawCandidate();
    }
    public update(dt: number): void {
        if (!this.guidePreview || !this.listening || this.background) return;
        this.pulseElapsed += dt; this.refreshGuidePreview();
    }
    private refreshGuidePreview(): void {
        const lesson = this.guidePreview;
        if (!lesson || !this.listening || this.background || !this.node.activeInHierarchy) return;
        const piece = this.session?.level.pieces.find(item => item.id === lesson.pieceId);
        if (!piece) return;
        this.drawPlacement(piece.cells, lesson.target, true);
        this.previewOpacity!.opacity = lesson.min + (lesson.max - lesson.min) * (1 - Math.cos(this.pulseElapsed * Math.PI * 2 / lesson.duration)) / 2;
    }

    public bind(session: PuzzleSession): void {
        if (this.disposed) throw new Error('PuzzleController: cannot bind after destroy');
        this.suspend();
        const board = requireBinding('PuzzleController', 'board', this.board);
        if (board.levelId !== session.level.id) throw new Error('PuzzleController: present the same level before bind');
        requireBinding('PuzzleController', 'dragRoot.UITransform', this.dragRoot?.getComponent(UITransform));
        requireBinding('PuzzleController', 'previewRoot.UITransform', this.previewRoot?.getComponent(UITransform));
        const graphics = requireBinding('PuzzleController', 'previewGraphics', this.previewGraphics);
        if (graphics.node !== this.previewRoot) throw new Error('PuzzleController: previewGraphics must belong to previewRoot');
        if (this.session?.attemptId !== session.attemptId) { this.notifiedAttempt = null; this.clearGuidePreview(); }
        this.session = session;
        board.renderSnapshot(session.snapshot);
        this.resume();
    }

    public onReturnPiece(): void {
        if (!this.listening || !this.session || this.session.snapshot.status !== 'active') return;
        this.cancelDrag();
        try { if (this.session.returnPiece()) this.deliverOutcome(); }
        catch(error) { this.onError?.(error); }
        finally { this.project(); }
    }

    public resume(): void {
        if (this.disposed || this.listening || !this.session || !this.enabled || !this.node.activeInHierarchy) return;
        this.listening = true;
        // Creator 3.8 dispatches UI before global input and swallows claimed UI
        // touches. Capture the authored page subtree before its Button handlers.
        this.node.on(Node.EventType.TOUCH_START, this.onStart, this, true);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onMove, this, true);
        this.node.on(Node.EventType.TOUCH_END, this.onEnd, this, true);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onCancel, this, true);
        input.on(Input.EventType.TOUCH_START, this.onStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onMove, this);
        input.on(Input.EventType.TOUCH_END, this.onEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onCancel, this);
        game.on(Game.EVENT_HIDE, this.onBackground, this);
        game.on(Game.EVENT_SHOW, this.onForeground, this);
        view.on('canvas-resize', this.cancelDrag, this);
        this.board?.boardMount?.on(Node.EventType.SIZE_CHANGED, this.cancelDrag, this);
        this.node.on(Node.EventType.SIZE_CHANGED, this.cancelDrag, this);
        this.refreshGuidePreview();
    }

    public suspend(): void {
        if (this.listening) {
            this.listening = false;
            if (isValid(this.node, true)) {
                this.node.off(Node.EventType.TOUCH_START, this.onStart, this, true);
                this.node.off(Node.EventType.TOUCH_MOVE, this.onMove, this, true);
                this.node.off(Node.EventType.TOUCH_END, this.onEnd, this, true);
                this.node.off(Node.EventType.TOUCH_CANCEL, this.onCancel, this, true);
            }
            input.off(Input.EventType.TOUCH_START, this.onStart, this);
            input.off(Input.EventType.TOUCH_MOVE, this.onMove, this);
            input.off(Input.EventType.TOUCH_END, this.onEnd, this);
            input.off(Input.EventType.TOUCH_CANCEL, this.onCancel, this);
            game.off(Game.EVENT_HIDE, this.onBackground, this);
            game.off(Game.EVENT_SHOW, this.onForeground, this);
            view.off('canvas-resize', this.cancelDrag, this);
            if (isValid(this.board?.boardMount, true)) this.board!.boardMount!.off(Node.EventType.SIZE_CHANGED, this.cancelDrag, this);
            if (isValid(this.node, true)) this.node.off(Node.EventType.SIZE_CHANGED, this.cancelDrag, this);
        }
        this.cancelDrag();
        this.hidePreview();
    }

    public onDisable(): void { this.suspend(); }
    public onDestroy(): void {
        if (this.disposed) return;
        this.suspend(); this.guidePreview = null; this.disposed = true; this.session = null; this.onOutcome = null; this.inputCamera = null; this.onDragStateChanged = null; this.allowPlacement = null; this.allowPieceStart = null; this.allowPointerStart = null;
    }

    private duplicate(event: EventTouch): boolean {
        const point = event.getUILocation(), last = this.lastEvent;
        if (last && last.event === event && last.x === point.x && last.y === point.y) return true;
        this.lastEvent = { event, x: point.x, y: point.y };
        return false;
    }
    private onStart(event: EventTouch): void {
        if (this.duplicate(event)) return;
        if (!this.listening || this.drag || !this.session || this.session.snapshot.status !== 'active') return;
        const pointerId = event.getID();
        if (pointerId === null) return;
        const world = this.worldPoint(event);
        if (this.allowPointerStart && !this.allowPointerStart(world.x,world.y,pointerId)) return;
        const entries = [...this.board!.pieceEntries()].reverse();
        // Pick across all actual hexes even when UI dispatch targets a rectangle
        // containing an empty corner or hole in a different piece.
        const entry = entries.find(value => {
            if (value.node.parent === this.board!.piecesMount && this.board!.trayViewport) {
                const node=this.board!.trayViewport!,ui=node.getComponent(UITransform)!,p=this.local(node,world);
                if(p.x < -ui.width*ui.anchorX || p.x > ui.width*(1-ui.anchorX) || p.y < -ui.height*ui.anchorY || p.y > ui.height*(1-ui.anchorY)) return false;
            }
            return value.item.containsLocal(this.local(value.node, world));
        });
        if (!entry || this.allowPieceStart && !this.allowPieceStart(entry.item.pieceId)) return;
        if (entry.node.parent === this.board!.piecesMount && this.board!.isTraySettling) return;
        const local = this.local(entry.node, world);
        try { this.session.select(entry.item.pieceId); } catch(error) { this.onError?.(error); return; }
        if (this.board?.trayScroll) this.board.trayScroll.enabled=false;
        this.drag = { pointerId, piece: entry.item,
            grab: { x: local.x / entry.item.radius, y: local.y / entry.item.radius },
            candidate: null, valid: false, outside: true };
        this.onDragStateChanged?.(true);
        this.updateDrag(world);
    }
    private onMove(event: EventTouch): void {
        if (this.duplicate(event)) return;
        if (this.drag && event.getID() === this.drag.pointerId) this.updateDrag(this.worldPoint(event));
    }
    private onEnd(event: EventTouch): void {
        if (this.duplicate(event)) return;
        if (!this.drag || event.getID() !== this.drag.pointerId || !this.session) return;
        this.updateDrag(this.worldPoint(event));
        const drag = this.drag; this.drag = null; this.clearPreview();
        let changed = false;
        try {
            if (drag.outside && this.session.snapshot.placements[drag.piece.pieceId]) changed = this.session.returnPiece(drag.piece.pieceId);
            else if (drag.valid && drag.candidate) changed = this.session.place(drag.piece.pieceId, drag.candidate);
            if (changed) this.deliverOutcome();
        } catch(error) { this.onError?.(error); }
        finally { if(this.board?.trayScroll) this.board.trayScroll.enabled=!this.board.isTraySettling; this.project(); this.onDragStateChanged?.(false); }
    }
    private onCancel(event: EventTouch): void {
        if (this.duplicate(event)) return;
        if (this.drag && event.getID() === this.drag.pointerId) this.cancelDrag();
    }
    /** Drops an in-progress gesture without placing; the piece returns to its committed pose. */
    public cancelDrag(): void {
        if(this.board?.trayScroll) this.board.trayScroll.enabled=!this.board.isTraySettling;
        if (!this.drag) { this.clearPreview(); return; }
        this.drag = null; this.clearPreview(); this.project(); this.onDragStateChanged?.(false);
    }

    private updateDrag(world: Point2): void {
        const drag = this.drag, board = this.board;
        if (!drag || !board?.boardFit || !this.session) return;
        const radius = board.boardFit.radius, pointer = this.local(board.boardMount!, world);
        const center = { x: pointer.x - drag.grab.x * radius, y: pointer.y - drag.grab.y * radius };
        const shapeCenter = pieceCenter(drag.piece.cells, radius);
        drag.candidate = nearestAxial({ x: center.x - shapeCenter.x - board.boardOffset.x,
            y: center.y - shapeCenter.y - board.boardOffset.y }, radius);
        const ui = board.boardMount!.getComponent(UITransform)!;
        drag.outside = pointer.x < -ui.width * ui.anchorX || pointer.x > ui.width * (1 - ui.anchorX)
            || pointer.y < -ui.height * ui.anchorY || pointer.y > ui.height * (1 - ui.anchorY);
        drag.valid = !drag.outside && this.session.canPlace(drag.piece.pieceId, drag.candidate)
            && (!this.allowPlacement || this.allowPlacement(drag.piece.pieceId, drag.candidate));
        const root = this.dragRoot!, boardUI = board.boardMount!.getComponent(UITransform)!;
        const worldCenter = boardUI.convertToWorldSpaceAR(new Vec3(center.x, center.y, 0));
        const rootCenter = root.getComponent(UITransform)!.convertToNodeSpaceAR(worldCenter);
        drag.piece.node.parent = root;
        drag.piece.node.setPosition(rootCenter);
        const boardScale = board.boardMount!.worldScale, dragScale = root.worldScale;
        const scale = radius / drag.piece.radius;
        drag.piece.node.setScale(scale * boardScale.x / dragScale.x, scale * boardScale.y / dragScale.y, 1);
        this.drawCandidate();
    }
    private drawCandidate(): void {
        const drag = this.drag, board = this.board, graphics = this.previewGraphics;
        if (this.guidePreview) { this.refreshGuidePreview(); return; }
        if (!drag || !board?.boardFit || !graphics || !drag.candidate) return;
        if (drag.outside) { this.hidePreview(); return; }
        const key = drag.piece.pieceId + ':' + drag.candidate.q + ',' + drag.candidate.r + ':' + drag.valid;
        if (key === this.drawnKey && this.previewRoot?.active) return;
        this.drawPlacement(drag.piece.cells, drag.candidate, drag.valid);
        this.drawnKey = key;
    }
    private drawPlacement(cells: readonly HexCell[], translation: HexCell, valid: boolean): void {
        const board = this.board, graphics = this.previewGraphics;
        if (!board?.boardFit || !graphics) return;
        graphics.clear(); this.drawnKey = '';
        this.previewRoot!.active = true;
        // Cells are created first; placed pieces are subsequent children of this same mount.
        if (this.previewRoot!.parent === board.boardMount) {
            const placed = board.pieceEntries().map(entry => entry.node).filter(node => node.parent === board.boardMount);
            const first = board.boardMount!.children.findIndex(node => placed.includes(node));
            this.previewRoot!.setSiblingIndex(first < 0 ? board.boardMount!.children.length - 1 : Math.max(0, first - (this.previewRoot!.getSiblingIndex() < first ? 1 : 0)));
        }
        graphics.lineWidth = 3;
        graphics.strokeColor = valid ? VALID_STROKE : INVALID_STROKE;
        graphics.fillColor = valid ? VALID_FILL : INVALID_FILL;
        const boardUI = board.boardMount!.getComponent(UITransform)!, previewUI = this.previewRoot!.getComponent(UITransform)!;
        const radius = board.boardFit.radius;
        for (const cell of cells) {
            const center = board.pointOfCell({ q: cell.q + translation.q, r: cell.r + translation.r });
            for (let i = 0; i < 6; i++) {
                const angle = i * Math.PI / 3;
                const point = previewUI.convertToNodeSpaceAR(boardUI.convertToWorldSpaceAR(new Vec3(center.x + Math.cos(angle) * radius,
                    center.y + Math.sin(angle) * radius, 0)));
                if (i === 0) graphics.moveTo(point.x, point.y); else graphics.lineTo(point.x, point.y);
            }
            graphics.close(); graphics.fill(); graphics.stroke();
        }
    }
    private clearPreview(): void {
        if (this.guidePreview && this.listening && !this.background) { this.refreshGuidePreview(); return; }
        this.hidePreview();
    }
    private hidePreview(): void {
        this.drawnKey = '';
        if (isValid(this.previewGraphics, true)) this.previewGraphics!.clear();
        if (isValid(this.previewRoot, true)) this.previewRoot!.active = false;
    }
    private onBackground(): void { this.background = true; this.cancelDrag(); this.hidePreview(); }
    private onForeground(): void { this.background = false; this.refreshGuidePreview(); }
    private project(): void {
        if (this.session && isValid(this.board, true)) this.board!.renderSnapshot(this.session.snapshot);
    }
    private deliverOutcome(): void {
        const snapshot = this.session?.snapshot;
        if (!snapshot || snapshot.status === 'active' || this.notifiedAttempt === snapshot.attemptId) return;
        this.notifiedAttempt = snapshot.attemptId;
        this.onOutcome?.(snapshot.status);
    }
    private local(node: Node, world: Point2): Vec3 {
        return requireBinding('PuzzleController', 'UITransform', node.getComponent(UITransform)).convertToNodeSpaceAR(new Vec3(world.x, world.y, 0));
    }
    private worldPoint(event: EventTouch): Point2 {
        if (!this.inputCamera) return event.getUILocation();
        // getUILocation undoes view scaling but does not undo the Canvas camera
        // projection. Our source page camera and design center need not coincide.
        const screen = event.getLocation();
        const world = this.inputCamera.screenToWorld(new Vec3(screen.x, screen.y, 0));
        return { x: world.x, y: world.y };
    }
}
