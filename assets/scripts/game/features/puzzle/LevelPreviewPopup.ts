import { Label, Node, _decorator } from 'cc';
import { HexBoard } from '../board/HexBoard';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 开局预览（普通 / 限步共用）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('LevelPreviewPopup')
@uiView({ bundle: 'puzzle', path: 'prefabs/popups/LevelPreviewPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class LevelPreviewPopup extends PopupBase {
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

    onStart(_event: unknown, _data: string): void {
        throw new Error('LevelPreviewPopup.onStart not implemented');
    }
}
