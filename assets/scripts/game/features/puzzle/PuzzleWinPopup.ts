import { Label, Node, Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 拼图胜利结算（普通/限步星级）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('PuzzleWinPopup')
@uiView({ bundle: 'puzzle', path: 'prefabs/popups/PuzzleWinPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class PuzzleWinPopup extends PopupBase {
    @property(Node) starLight: Node = null!;
    @property(Node) starsRow: Node = null!;
    @property([Sprite]) stars: Sprite[] = [];
    @property(Node) pilotBee: Node = null!;
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) levelLabel: LocalizedLabel = null!;
    @property(Label) rewardLabel: Label = null!;
    @property(LocalizedLabel) bestLabel: LocalizedLabel = null!;
    @property(Node) bonusAdButton: Node = null!;
    @property(LocalizedLabel) bonusAdLabel: LocalizedLabel = null!;

    onNext(_event: unknown, _data: string): void {
        throw new Error('PuzzleWinPopup.onNext not implemented');
    }

    onBonusAd(_event: unknown, _data: string): void {
        throw new Error('PuzzleWinPopup.onBonusAd not implemented');
    }

    onHome(_event: unknown, _data: string): void {
        throw new Error('PuzzleWinPopup.onHome not implemented');
    }
}
