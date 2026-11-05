import { Label, Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 无尽成绩结算. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('EndlessResultPopup')
@uiView({ bundle: 'endless', path: 'prefabs/popups/EndlessResultPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class EndlessResultPopup extends PopupBase {
    @property(Node) trophy: Node = null!;
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(Label) scoreLabel: Label = null!;
    @property(LocalizedLabel) bestLabel: LocalizedLabel = null!;
    @property(Label) rewardLabel: Label = null!;
    @property(Node) bonusAdButton: Node = null!;
    @property(LocalizedLabel) bonusAdLabel: LocalizedLabel = null!;

    onAgain(_event: unknown, _data: string): void {
        throw new Error('EndlessResultPopup.onAgain not implemented');
    }

    onBonusAd(_event: unknown, _data: string): void {
        throw new Error('EndlessResultPopup.onBonusAd not implemented');
    }
}
