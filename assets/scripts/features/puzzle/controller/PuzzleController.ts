import { _decorator, Camera, Color, Component, Game, game, Graphics, Input, input, isValid, Node, UITransform, Vec3, view } from 'cc';
import type { EventTouch } from 'cc';
import { requireBinding } from '../../../framework/components/Binding';
import type { HexCell } from '../data/LevelDefinition';
import { PuzzleBoardPresentation } from '../presentation/PuzzleBoardPresentation';
import { nearestAxial, pieceCenter, type Point2 } from '../presentation/PuzzleLayout';
import { PuzzlePiecePresentation } from '../presentation/PuzzlePiecePresentation';
import type { PuzzleSession, PuzzleSessionSnapshot } from '../session/PuzzleSession';
const { ccclass, property } = _decorator;

interface Drag {
    pointerId: number;
    piece: PuzzlePiecePresentation;
    grab: Point2;
    candidate: HexCell | null;
    valid: boolean;
    outside: boolean;
}

/** Engine input adapter. Session owns rules; the page owns all displayed assets. */
@ccclass('PuzzleController')
export class PuzzleController extends Component {
    @property(PuzzleBoardPresentation) public board: PuzzleBoardPresentation | null = null;
    @property(Node) public dragRoot: Node | null = null;
    @property(Node) public previewRoot: Node | null = null;
    @property(Graphics) public previewGraphics: Graphics | null = null;
    /** Injected by the scene composition root; Prefabs cannot serialize a scene camera. */
    public inputCamera: Camera | null = null;
    public onOutcome: ((status: 'completed' | 'failed') => void) | null = null;
    private session: PuzzleSession | null = null;
    private drag: Drag | null = null;
    private listening = false;
    private notifiedAttempt: string | null = null;
    private disposed = false;

    public get snapshot(): PuzzleSessionSnapshot | null { return this.session?.snapshot || null; }
    public get draggingPieceId(): string | null { return this.drag?.piece.pieceId || null; }

    public bind(session: PuzzleSession): void {
        if (this.disposed) throw new Error('PuzzleController: cannot bind after destroy');
        this.suspend();
        const board = requireBinding('PuzzleController', 'board', this.board);
        if (board.levelId !== session.level.id) throw new Error('PuzzleController: present the same level before bind');
        requireBinding('PuzzleController', 'dragRoot.UITransform', this.dragRoot?.getComponent(UITransform));
        requireBinding('PuzzleController', 'previewRoot.UITransform', this.previewRoot?.getComponent(UITransform));
        const graphics = requireBinding('PuzzleController', 'previewGraphics', this.previewGraphics);
        if (graphics.node !== this.previewRoot) throw new Error('PuzzleController: previewGraphics must belong to previewRoot');
        if (this.session?.attemptId !== session.attemptId) this.notifiedAttempt = null;
        this.session = session;
        board.renderSnapshot(session.snapshot);
        this.resume();
    }

    public onReturnPiece(): void {
        if (!this.listening || !this.session || this.session.snapshot.status !== 'active') return;
        this.cancelDrag();
        const changed = this.session.returnPiece();
        this.project();
        if (changed) this.deliverOutcome();
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
        game.on(Game.EVENT_HIDE, this.cancelDrag, this);
        view.on('canvas-resize', this.cancelDrag, this);
        this.board?.boardMount?.on(Node.EventType.SIZE_CHANGED, this.cancelDrag, this);
        this.node.on(Node.EventType.SIZE_CHANGED, this.cancelDrag, this);
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
            game.off(Game.EVENT_HIDE, this.cancelDrag, this);
            view.off('canvas-resize', this.cancelDrag, this);
            if (isValid(this.board?.boardMount, true)) this.board!.boardMount!.off(Node.EventType.SIZE_CHANGED, this.cancelDrag, this);
            if (isValid(this.node, true)) this.node.off(Node.EventType.SIZE_CHANGED, this.cancelDrag, this);
        }
        this.cancelDrag();
    }

    public onDisable(): void { this.suspend(); }
    public onDestroy(): void {
        if (this.disposed) return;
        this.suspend(); this.disposed = true; this.session = null; this.onOutcome = null; this.inputCamera = null;
    }

    private onStart(event: EventTouch): void {
        if (!this.listening || this.drag || !this.session || this.session.snapshot.status !== 'active') return;
        const pointerId = event.getID();
        if (pointerId === null) return;
        const world = this.worldPoint(event);
        const entries = [...this.board!.pieceEntries()].reverse();
        // Pick across all actual hexes even when UI dispatch targets a rectangle
        // containing an empty corner or hole in a different piece.
        const entry = entries.find(value => value.item.containsLocal(this.local(value.node, world)));
        if (!entry) return;
        const local = this.local(entry.node, world);
        this.session.select(entry.item.pieceId);
        this.drag = { pointerId, piece: entry.item,
            grab: { x: local.x / entry.item.radius, y: local.y / entry.item.radius },
            candidate: null, valid: false, outside: true };
        this.updateDrag(world);
    }
    private onMove(event: EventTouch): void {
        if (this.drag && event.getID() === this.drag.pointerId) this.updateDrag(this.worldPoint(event));
    }
    private onEnd(event: EventTouch): void {
        if (!this.drag || event.getID() !== this.drag.pointerId || !this.session) return;
        this.updateDrag(this.worldPoint(event));
        const drag = this.drag; this.drag = null; this.clearPreview();
        let changed = false;
        if (drag.outside && this.session.snapshot.placements[drag.piece.pieceId]) changed = this.session.returnPiece(drag.piece.pieceId);
        else if (drag.valid && drag.candidate) changed = this.session.place(drag.piece.pieceId, drag.candidate);
        this.project();
        if (changed) this.deliverOutcome();
    }
    private onCancel(event: EventTouch): void {
        if (this.drag && event.getID() === this.drag.pointerId) this.cancelDrag();
    }
    private cancelDrag(): void {
        if (!this.drag) { this.clearPreview(); return; }
        this.drag = null; this.clearPreview(); this.project();
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
        drag.valid = !drag.outside && this.session.canPlace(drag.piece.pieceId, drag.candidate);
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
        if (!drag || !board?.boardFit || !graphics || !drag.candidate) return;
        graphics.clear();
        if (drag.outside) { this.previewRoot!.active = false; return; }
        this.previewRoot!.active = true;
        graphics.lineWidth = 3;
        graphics.strokeColor = drag.valid ? new Color(100, 233, 141, 255) : new Color(239, 104, 91, 255);
        graphics.fillColor = drag.valid ? new Color(100, 233, 141, 65) : new Color(239, 104, 91, 65);
        const boardUI = board.boardMount!.getComponent(UITransform)!, previewUI = this.previewRoot!.getComponent(UITransform)!;
        const radius = board.boardFit.radius;
        for (const cell of drag.piece.cells) {
            const center = board.pointOfCell({ q: cell.q + drag.candidate.q, r: cell.r + drag.candidate.r });
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
        if (isValid(this.previewGraphics, true)) this.previewGraphics!.clear();
        if (isValid(this.previewRoot, true)) this.previewRoot!.active = false;
    }
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
