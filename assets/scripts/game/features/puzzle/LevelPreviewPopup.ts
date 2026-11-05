import { Label, Node, UITransform, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { isCleared, startAttempt } from '../../domain/Mainline';
import { LevelDefinition } from '../../domain/puzzle/LevelDefinition';
import { fitTray } from '../../domain/puzzle/PuzzleLayout';
import { services } from '../../Services';
import { HexBoard, PieceShape } from '../board/HexBoard';
import { ConfirmPopup } from '../common/ConfirmPopup';
import { PuzzlePage, pieceColor } from './PuzzlePage';

const { ccclass, property } = _decorator;

export interface LevelPreviewArgs { level: number; }

/** 开局预览（普通 T01-01 / 限步 T04-01，F009）：只读棋盘与托盘、规则数字、本次可得花蜜。 */
@ccclass('LevelPreviewPopup')
@uiView({ bundle: 'puzzle', path: 'prefabs/popups/LevelPreviewPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class LevelPreviewPopup extends PopupBase<LevelPreviewArgs> {
    @property(HexBoard) board: HexBoard = null!;
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) remainTitleLabel: LocalizedLabel = null!;
    @property(Label) remainLabel: Label = null!;
    @property(Label) targetLabel: Label = null!;
    @property(Label) hintStockLabel: Label = null!;
    @property(Node) trayRoot: Node = null!;
    @property(LocalizedLabel) rewardLabel: LocalizedLabel = null!;
    @property remainKeyPieces = "block.fb14446e7454.text.55a87ff8eb1b";
    @property remainKeyMoves = "block.92709cf7dc5a.text.55a87ff8eb1b";
    @property rewardKeyFirst = "block.92709cf7dc5a.text.594272093dde";
    @property rewardKeyReplay = "block.fb14446e7454.text.594272093dde";

    private shapes: PieceShape[] = [];

    protected setInfo(): void {
        const n = this.args.level;
        const level = services.catalog.getMainline(n);
        const { mainline } = services.config;
        const challenge = level.mode === 'challenge';
        this.titleLabel.setParams({ level: n });
        this.remainTitleLabel.setKey(challenge ? this.remainKeyMoves : this.remainKeyPieces);
        this.remainLabel.string = String(challenge ? level.moveLimit : level.pieces.length);
        this.targetLabel.string = String(level.targetCells.length);
        this.hintStockLabel.string = String(services.save.data.wallet.hints);
        const first = !isCleared(services.save.data, n);
        const honey = first ? (challenge ? mainline.challengeFirstClear : mainline.classicFirstClear) : challenge ? 0 : mainline.replay;
        this.rewardLabel.setKey(first ? this.rewardKeyFirst : this.rewardKeyReplay, { count: honey });
        this.showLevel(level);
    }

    protected onClose(): void {
        this.releaseShapes();
        this.board.clear();
    }

    onStart(_event: unknown, _data: string): void {
        const n = this.args.level;
        const pending = services.save.data.attempt;
        if (pending && pending.levelNumber !== n) {
            ConfirmPopup.ask({
                titleKey: 'block.533290b5cce3.text.065c8903bb20', messageKey: 'hg.puzzle.discard_attempt',
                confirmKey: 'block.533290b5cce3.text.51c07da06e63', cancelKey: 'block.533290b5cce3.text.ee92c5c44254',
                params: { level: pending.levelNumber },
                onConfirm: () => this.beginLevel(n),
            });
            return;
        }
        this.beginLevel(n);
    }

    private beginLevel(n: number): void {
        const pending = services.save.data.attempt;
        if (!pending || pending.levelNumber !== n) services.save.transact(draft => { startAttempt(draft, n); });
        this.close();
        void services.ui.open(PuzzlePage, { level: n });
    }

    private showLevel(level: LevelDefinition): void {
        this.releaseShapes();
        this.board.build([...level.targetCells, ...level.obstacleCells], level.obstacleCells);
        const size = this.trayRoot.getComponent(UITransform)!.contentSize;
        const fit = fitTray(level.pieces, size.width, size.height);
        this.shapes = level.pieces.map((piece, i) => {
            const shape = this.board.createShape(piece.cells, pieceColor(piece.textureName), this.trayRoot);
            const slot = fit.pieces[i];
            const scale = fit.radius / this.board.radius;
            shape.node.setPosition(slot.position.x + slot.centers[0].x, slot.position.y + slot.centers[0].y);
            shape.node.setScale(scale, scale, 1);
            return shape;
        });
    }

    private releaseShapes(): void {
        for (const shape of this.shapes) this.board.releaseShape(shape);
        this.shapes = [];
    }
}
