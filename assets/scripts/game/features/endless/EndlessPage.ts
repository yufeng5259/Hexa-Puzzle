import { Button, EventTouch, Label, Node, Sprite, UITransform, Vec3, _decorator } from 'cc';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { recordActivity } from '../../domain/Activity';
import { completeGuide } from '../../Guide';
import { boardCells, canUndo, fits, harvest, hasMove, place, PlacementResult, projectedHarvest, undo } from '../../domain/Endless';
import { HexCell } from '../../domain/puzzle/LevelDefinition';
import { fitCells, insideHex } from '../../domain/puzzle/PuzzleLayout';
import { services } from '../../Services';
import { today } from '../../Today';
import { HexBoard, PieceShape } from '../board/HexBoard';
import { ConfirmPopup } from '../common/ConfirmPopup';
import { HelpPopup } from '../common/HelpPopup';
import { AchievementPage } from '../daily/AchievementPage';
import { SupplyPopup } from '../daily/SupplyPopup';
import { EndlessResultPopup } from './EndlessResultPopup';
import { EndlessRevivePopup } from './EndlessRevivePopup';

const { ccclass, property } = _decorator;

const LIFT = 1.4;
const TRAY_PADDING = 12;
const COMBO_SECONDS = 1;
/** comboWords order in the prefab: 不错, 太棒了, 完美, 超级连击. */
const WORD_GOOD = 0, WORD_GREAT = 1, WORD_PERFECT = 2, WORD_SUPER = 3;
const SUPER_COMBO = 3;

interface TrayPiece {
    slot: number;
    shape: PieceShape;
    home: { x: number; y: number; scale: number };
}

/** 无尽对局（无尽模式 / T13-01 底页，F030–F034）：37 格棋盘、3 块候选、三轴消除、撤回、收获。 */
@ccclass('EndlessPage')
@uiView({ bundle: 'endless', path: 'prefabs/pages/EndlessPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class EndlessPage extends ViewBase {
    @property(Label) scoreLabel: Label = null!;
    @property(Label) bestLabel: Label = null!;
    @property(HexBoard) board: HexBoard = null!;
    @property(Node) comboRoot: Node = null!;
    @property([Sprite]) comboWords: Sprite[] = [];
    @property(Label) gainLabel: Label = null!;
    @property(Button) undoButton: Button = null!;
    @property(Label) undoCountLabel: Label = null!;
    @property([Node]) traySlots: Node[] = [];

    private filled: PieceShape[] = [];
    private tray: TrayPiece[] = [];
    private dragging: TrayPiece | null = null;
    private readonly scratch = new Vec3();
    private readonly hideCombo = (): void => { this.comboRoot.active = false; };

    protected onOpen(): void {
        for (const target of [this.board.node, ...this.traySlots]) {
            target.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
            target.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
            target.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            // Releasing outside the node that took the touch arrives as TOUCH_CANCEL: it is still a drop.
            target.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        }
    }

    protected setInfo(): void {
        if (!services.save.data.endless.run) throw new Error('EndlessPage opened without a saved run');
        this.board.build(boardCells(services.config.endless.radius));
        this.hideCombo();
        this.render();
        this.checkStuck();
    }

    /** Pop-ups and backgrounding cancel a drag without placing (F012/F030). */
    protected onHide(): void {
        this.cancelDrag();
    }

    protected onClose(): void {
        this.unschedule(this.hideCombo);
        this.clearShapes();
        this.board.clear();
    }

    onRecords(_event: unknown, _data: string): void {
        void services.ui.open(AchievementPage);
    }

    onSupply(_event: unknown, _data: string): void {
        void services.ui.open(SupplyPopup);
    }

    /** One free undo per run (F032). */
    onUndo(_event: unknown, _data: string): void {
        if (!canUndo(services.save.data.endless.run!)) return;
        services.save.transact(draft => undo(draft.endless.run!));
        this.hideCombo();
        this.render();
    }

    /** The run is saved after every placement; leaving keeps it for "continue" (F029). */
    onPause(_event: unknown, _data: string): void {
        this.close();
    }

    onHelp(_event: unknown, _data: string): void {
        void services.ui.open(HelpPopup, { article: 'endless' });
    }

    /** Harvest needs a confirmation; cancelling keeps the run untouched (F034). */
    onHarvest(_event: unknown, _data: string): void {
        const run = services.save.data.endless.run!;
        ConfirmPopup.ask({
            titleKey: 'block.51ad87ae47a3.text.065c8903bb20', messageKey: 'block.51ad87ae47a3.text.c443ef8ffa25',
            confirmKey: 'block.51ad87ae47a3.text.e4b2f63c5678', cancelKey: 'block.51ad87ae47a3.text.ee92c5c44254',
            value: { captionKey: 'block.51ad87ae47a3.text.8b01bc0e5386', amount: projectedHarvest(services.save.data, services.config.endless, run.score, today()) },
            onConfirm: () => {
                const receipt = harvest(services.save, services.config.endless, today());
                void services.ui.open(EndlessResultPopup, receipt);
            },
        });
    }

    // ---------- rendering ----------

    /** Rebuild board pieces and tray from the saved run. */
    private render(): void {
        const run = services.save.data.endless.run!;
        this.clearShapes();
        for (const [key, color] of Object.entries(run.board)) {
            const [q, r] = key.split(',').map(Number);
            const shape = this.board.createShape([{ q: 0, r: 0 }], color, this.board.pieces);
            this.board.placeShape(shape, { q, r });
            this.filled.push(shape);
        }
        run.tray.forEach((piece, slot) => {
            if (!piece) return;
            const size = this.traySlots[slot].getComponent(UITransform)!.contentSize;
            const fit = fitCells(piece.cells, size.width, size.height, TRAY_PADDING);
            const shape = this.board.createShape(piece.cells, piece.color, this.traySlots[slot]);
            const item: TrayPiece = { slot, shape, home: { x: fit.centers[0].x, y: fit.centers[0].y, scale: Math.min(1, fit.radius / this.board.radius) } };
            this.toTray(item);
            this.tray.push(item);
        });
        this.scoreLabel.string = String(run.score);
        this.bestLabel.string = String(Math.max(services.save.data.endless.best, run.score));
        this.undoCountLabel.string = run.undoUsed ? '0' : '1';
        this.undoButton.interactable = canUndo(run);
    }

    private clearShapes(): void {
        for (const shape of this.filled) this.board.releaseShape(shape);
        for (const item of this.tray) this.board.releaseShape(item.shape);
        this.filled = [];
        this.tray = [];
        this.dragging = null;
    }

    private toTray(item: TrayPiece): void {
        const node = item.shape.node;
        node.parent = this.traySlots[item.slot];
        node.setPosition(item.home.x, item.home.y);
        node.setScale(item.home.scale, item.home.scale, 1);
        this.board.setLanded(item.shape, false);
    }

    private showCombo(result: PlacementResult, combo: number): void {
        if (result.lines === 0) return;
        completeGuide('endless.1');
        const word = combo >= SUPER_COMBO ? WORD_SUPER : result.lines >= 3 ? WORD_PERFECT : result.lines === 2 ? WORD_GREAT : WORD_GOOD;
        this.comboWords.forEach((sprite, i) => { sprite.node.active = i === word; });
        this.gainLabel.node.active = true;
        this.gainLabel.string = '+' + (result.cellScore + result.lineScore + result.comboScore);
        this.comboRoot.active = true;
        this.unschedule(this.hideCombo);
        this.scheduleOnce(this.hideCombo, COMBO_SECONDS);
    }

    /** All remaining tray pieces are blocked: offer harvest or the verified clearing (F033). */
    private checkStuck(): void {
        if (!hasMove(services.save.data.endless.run!, services.config.endless)) {
            void services.ui.open(EndlessRevivePopup, { onRevived: () => this.render() });
        }
    }

    // ---------- input ----------

    private onTouchStart(event: EventTouch): void {
        if (this.dragging) return;
        const ui = event.getUILocation();
        this.scratch.set(ui.x, ui.y, 0);
        const item = this.tray.find(t => this.hits(t, this.scratch));
        if (!item) return;
        this.dragging = item;
        item.shape.node.parent = this.node;
        item.shape.node.setScale(1, 1, 1);
        this.follow(this.scratch);
    }

    private onTouchMove(event: EventTouch): void {
        if (!this.dragging) return;
        const ui = event.getUILocation();
        this.scratch.set(ui.x, ui.y, 0);
        this.follow(this.scratch);
    }

    private onTouchEnd(event: EventTouch): void {
        const item = this.dragging;
        if (!item) return;
        this.dragging = null;
        const ui = event.getUILocation();
        this.scratch.set(ui.x, ui.y + this.board.radius * LIFT, 0);
        const anchor = this.board.cellAt(this.board.toLocal(this.scratch));
        const run = services.save.data.endless.run!;
        const piece = run.tray[item.slot]!;
        if (!fits(run, services.config.endless, piece, anchor)) {
            this.toTray(item);
            return;
        }
        this.commitPlacement(item.slot, anchor);
    }

    private commitPlacement(slot: number, anchor: HexCell): void {
        const day = today();
        const result = services.save.transact(draft => {
            const placed = place(draft.endless.run!, services.config.endless, slot, anchor);
            recordActivity(draft, { kind: 'endlessPlace' }, day);
            return placed;
        });
        this.render();
        this.showCombo(result, services.save.data.endless.run!.combo);
        this.checkStuck();
    }

    private cancelDrag(): void {
        const item = this.dragging;
        if (!item) return;
        this.dragging = null;
        this.toTray(item);
    }

    private follow(ui: Vec3): void {
        const p = this.node.getComponent(UITransform)!.convertToNodeSpaceAR(ui);
        this.dragging!.shape.node.setPosition(p.x, p.y + this.board.radius * LIFT);
    }

    /** Exact hex hit test against each cell of a tray piece, in the piece node's own space. */
    private hits(item: TrayPiece, ui: Vec3): boolean {
        const local = item.shape.node.getComponent(UITransform)!.convertToNodeSpaceAR(ui);
        const R = this.board.radius;
        return item.shape.cells.some(cell => {
            const x = 1.5 * R * cell.q, y = Math.sqrt(3) * R * (cell.r + cell.q / 2);
            return insideHex({ x: local.x - x, y: local.y - y }, R);
        });
    }
}
