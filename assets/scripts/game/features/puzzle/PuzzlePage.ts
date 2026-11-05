import { Button, EventTouch, Label, Node, UITransform, Vec3, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { settleWin } from '../../domain/Mainline';
import { HexCell, LevelDefinition } from '../../domain/puzzle/LevelDefinition';
import { fitTray, insideHex } from '../../domain/puzzle/PuzzleLayout';
import { PuzzleSession } from '../../domain/puzzle/PuzzleSession';
import { spendHint } from '../../domain/Wallet';
import { services } from '../../Services';
import { today } from '../../Today';
import { HexBoard, PieceShape } from '../board/HexBoard';
import { HelpPopup } from '../common/HelpPopup';
import { ChallengeFailPopup } from './ChallengeFailPopup';
import { HintEmptyPopup } from './HintEmptyPopup';
import { PausePopup } from './PausePopup';
import { PuzzleWinPopup } from './PuzzleWinPopup';

const { ccclass, property } = _decorator;

export interface PuzzlePageArgs {
    /** Mainline number; the attempt for it must already be in the save (created by LevelPreviewPopup). */
    level: number;
}

/** Pieces of one level take distinct colors in order (5 colors; levels have at most 7 pieces). */
export const pieceColor = (index: number): number => index % 5;
/** The dragged piece floats above the finger by this many cell radii. */
const LIFT = 1.4;
const HINT_LABEL_SECONDS = 1.5;

interface TrayPiece {
    id: string;
    shape: PieceShape;
    home: { x: number; y: number; scale: number };
}

/** 拼图局（普通 / 限步共用，F010–F013、F016）。 */
@ccclass('PuzzlePage')
@uiView({ bundle: 'puzzle', path: 'prefabs/pages/PuzzlePage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class PuzzlePage extends ViewBase<PuzzlePageArgs> {
    @property(HexBoard) board: HexBoard = null!;
    @property(LocalizedLabel) hintUsedLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) remainTitleLabel: LocalizedLabel = null!;
    @property(Label) remainLabel: Label = null!;
    @property(Label) targetLabel: Label = null!;
    @property(Label) hintStockLabel: Label = null!;
    @property(Node) trayRoot: Node = null!;
    @property(Button) undoButton: Button = null!;
    @property remainKeyPieces = "block.5d8513851521.text.55a87ff8eb1b";
    @property remainKeyMoves = "block.4cfc10f27941.text.55a87ff8eb1b";

    private level!: LevelDefinition;
    private session!: PuzzleSession;
    private pieces: TrayPiece[] = [];
    private dragging: TrayPiece | null = null;
    private hintPiece: string | null = null;
    private readonly scratch = new Vec3();
    private readonly onSave = (): void => this.renderStock();

    protected onOpen(): void {
        for (const target of [this.board.node, this.trayRoot]) {
            target.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
            target.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
            target.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            // Releasing outside the node that took the touch arrives as TOUCH_CANCEL: it is still a drop.
            target.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        }
    }

    protected setInfo(): void {
        const attempt = services.save.data.attempt;
        if (!attempt || attempt.levelNumber !== this.args.level) throw new Error('No saved attempt for level ' + this.args.level);
        const level = services.catalog.getMainline(attempt.levelNumber);
        this.level = level.moveLimit === null ? level : { ...level, moveLimit: level.moveLimit + attempt.extraMoves };
        this.session = new PuzzleSession(this.level, attempt.attemptId);
        this.session.restore(attempt.placements, attempt.moves);
        this.build(attempt.placements);
        this.titleLabel.setParams({ level: attempt.levelNumber });
        this.remainTitleLabel.setKey(level.mode === 'challenge' ? this.remainKeyMoves : this.remainKeyPieces);
        this.render();
    }

    protected changeListener(enabled: boolean): void {
        services.save.subscribe(enabled, this.onSave);
    }

    /** Pop-ups and backgrounding cancel a drag without committing it (F012). */
    protected onHide(): void {
        this.cancelDrag();
    }

    protected onClose(): void {
        this.clearPieces();
        this.board.clear();
    }

    onBack(): void {
        void services.ui.open(PausePopup, { level: this.args.level });
    }

    onPause(_event: unknown, _data: string): void {
        this.onBack();
    }

    onHintAdd(_event: unknown, _data: string): void {
        void services.ui.open(HintEmptyPopup);
    }

    /** Show the answer outline of one tray piece (F016); repeating the same visible hint is free. */
    onHint(_event: unknown, _data: string): void {
        const target = this.pieces.find(p => p.shape.node.parent === this.trayRoot);
        if (!target || target.id === this.hintPiece) return;
        if (services.save.data.wallet.hints < 1) {
            void services.ui.open(HintEmptyPopup);
            return;
        }
        const before = services.save.data.wallet.hints;
        services.save.transact(draft => {
            spendHint(draft);
            draft.attempt!.hintsUsed++;
        });
        this.hintPiece = target.id;
        this.board.setHint(this.level.pieces.find(p => p.id === target.id)!.targetCells);
        this.hintUsedLabel.node.active = true;
        this.hintUsedLabel.setParams({ value_1: before, value_2: before - 1 });
        this.scheduleOnce(() => { this.hintUsedLabel.node.active = false; }, HINT_LABEL_SECONDS);
    }

    /** Take back the most recently placed piece (F012); costs a move in challenge levels. */
    onUndo(_event: unknown, _data: string): void {
        const last = this.session.snapshot.placements;
        if (!this.session.returnPiece()) return;
        const back = this.pieces.find(p => !(p.id in this.session.snapshot.placements) && p.id in last)!;
        this.toTray(back);
        this.commit();
    }

    onHelp(_event: unknown, _data: string): void {
        void services.ui.open(HelpPopup, { article: 'puzzle' });
    }

    // ---------- build ----------

    private build(placements: Readonly<Record<string, HexCell>>): void {
        this.clearPieces();
        this.board.build([...this.level.targetCells, ...this.level.obstacleCells], this.level.obstacleCells);
        const size = this.trayRoot.getComponent(UITransform)!.contentSize;
        const fit = fitTray(this.level.pieces, size.width, size.height);
        this.pieces = this.level.pieces.map((piece, i) => {
            const shape = this.board.createShape(piece.cells, pieceColor(i), this.trayRoot);
            const slot = fit.pieces[i];
            const scale = fit.radius / this.board.radius;
            return { id: piece.id, shape, home: { x: slot.position.x + slot.centers[0].x, y: slot.position.y + slot.centers[0].y, scale } };
        });
        for (const piece of this.pieces) {
            const placed = placements[piece.id];
            if (placed) this.board.placeShape(piece.shape, placed);
            else this.toTray(piece);
        }
        this.hintPiece = null;
        this.board.setHint([]);
    }

    private clearPieces(): void {
        for (const piece of this.pieces) this.board.releaseShape(piece.shape);
        this.pieces = [];
        this.dragging = null;
    }

    private toTray(piece: TrayPiece): void {
        const node = piece.shape.node;
        node.parent = this.trayRoot;
        node.setPosition(piece.home.x, piece.home.y);
        node.setScale(piece.home.scale, piece.home.scale, 1);
        this.board.setLanded(piece.shape, false);
    }

    // ---------- input ----------

    private onTouchStart(event: EventTouch): void {
        if (this.dragging || this.session.snapshot.status !== 'active') return;
        const ui = event.getUILocation();
        this.scratch.set(ui.x, ui.y, 0);
        const piece = this.pieces.find(p => this.hits(p, this.scratch));
        if (!piece) return;
        this.dragging = piece;
        piece.shape.node.parent = this.node;
        piece.shape.node.setScale(1, 1, 1);
        this.follow(this.scratch);
    }

    private onTouchMove(event: EventTouch): void {
        if (!this.dragging) return;
        const ui = event.getUILocation();
        this.scratch.set(ui.x, ui.y, 0);
        this.follow(this.scratch);
    }

    private onTouchEnd(event: EventTouch): void {
        const piece = this.dragging;
        if (!piece) return;
        this.dragging = null;
        const ui = event.getUILocation();
        this.scratch.set(ui.x, ui.y + this.board.radius * LIFT, 0);
        const anchor = this.board.cellAt(this.board.toLocal(this.scratch));
        const placed = this.session.snapshot.placements[piece.id];
        if (this.session.place(piece.id, anchor)) {
            this.board.placeShape(piece.shape, anchor);
            if (this.hintPiece === piece.id) this.clearHint();
            this.commit();
        } else if (placed && !this.overBoard(this.scratch)) {
            this.session.returnPiece(piece.id);
            this.toTray(piece);
            this.commit();
        } else if (placed) {
            this.board.placeShape(piece.shape, placed);
        } else {
            this.toTray(piece);
        }
    }

    private cancelDrag(): void {
        const piece = this.dragging;
        if (!piece) return;
        this.dragging = null;
        const placed = this.session.snapshot.placements[piece.id];
        if (placed) this.board.placeShape(piece.shape, placed);
        else this.toTray(piece);
    }

    private follow(ui: Vec3): void {
        const p = this.node.getComponent(UITransform)!.convertToNodeSpaceAR(ui);
        this.dragging!.shape.node.setPosition(p.x, p.y + this.board.radius * LIFT);
    }

    /** Exact hex hit test against each cell of a piece, in the piece node's own space. */
    private hits(piece: TrayPiece, ui: Vec3): boolean {
        const local = piece.shape.node.getComponent(UITransform)!.convertToNodeSpaceAR(ui);
        const R = this.board.radius;
        return piece.shape.cells.some(cell => {
            const x = 1.5 * R * cell.q, y = Math.sqrt(3) * R * (cell.r + cell.q / 2);
            return insideHex({ x: local.x - x, y: local.y - y }, R);
        });
    }

    private overBoard(ui: Vec3): boolean {
        const p = this.board.node.getComponent(UITransform)!.convertToNodeSpaceAR(ui);
        const size = this.board.node.getComponent(UITransform)!.contentSize;
        return Math.abs(p.x) <= size.width / 2 && Math.abs(p.y) <= size.height / 2;
    }

    private clearHint(): void {
        this.hintPiece = null;
        this.board.setHint([]);
    }

    // ---------- state ----------

    /** Persist the attempt after every counted change, then resolve win / fail. */
    private commit(): void {
        const snap = this.session.snapshot;
        services.save.transact(draft => {
            draft.attempt!.placements = JSON.parse(JSON.stringify(snap.placements));
            draft.attempt!.moves = snap.moves;
        });
        this.render();
        if (snap.status === 'completed') {
            const attempt = services.save.data.attempt!;
            const receipt = settleWin(services.save, services.config.mainline, this.level, attempt, today());
            void services.ui.open(PuzzleWinPopup, receipt);
        } else if (snap.status === 'failed') {
            void services.ui.open(ChallengeFailPopup, { level: this.args.level });
        }
    }

    private render(): void {
        const snap = this.session.snapshot;
        const placed = Object.keys(snap.placements);
        this.remainLabel.string = String(this.level.moveLimit === null
            ? this.level.pieces.length - placed.length
            : Math.max(0, this.level.moveLimit - snap.moves));
        const filled = this.level.pieces.filter(p => placed.indexOf(p.id) >= 0).reduce((n, p) => n + p.cells.length, 0);
        this.targetLabel.string = `${filled}/${this.level.targetCells.length}`;
        this.undoButton.interactable = placed.length > 0 && snap.status === 'active';
        this.renderStock();
    }

    private renderStock(): void {
        this.hintStockLabel.string = String(services.save.data.wallet.hints);
    }
}
