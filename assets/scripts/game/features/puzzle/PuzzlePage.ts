import { Button, Label, Node, _decorator } from 'cc';
import { HexBoard } from '../board/HexBoard';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 拼图局（普通 / 限步共用）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('PuzzlePage')
@uiView({ bundle: 'puzzle', path: 'prefabs/pages/PuzzlePage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class PuzzlePage extends ViewBase {
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

    onPause(_event: unknown, _data: string): void {
        throw new Error('PuzzlePage.onPause not implemented');
    }

    onHintAdd(_event: unknown, _data: string): void {
        throw new Error('PuzzlePage.onHintAdd not implemented');
    }

    onHint(_event: unknown, _data: string): void {
        throw new Error('PuzzlePage.onHint not implemented');
    }

    onUndo(_event: unknown, _data: string): void {
        throw new Error('PuzzlePage.onUndo not implemented');
    }

    onHelp(_event: unknown, _data: string): void {
        throw new Error('PuzzlePage.onHelp not implemented');
    }
}
