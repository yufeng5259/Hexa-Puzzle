import { Label, Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 每日补给：免费提示与视频花蜜. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('SupplyPopup')
@uiView({ bundle: 'meta', path: 'prefabs/popups/SupplyPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class SupplyPopup extends PopupBase {
    @property(Label) videoAmountLabel: Label = null!;
    @property(LocalizedLabel) videoConditionLabel: LocalizedLabel = null!;
    @property(Node) freeButton: Node = null!;
    @property(Node) freeClaimed: Node = null!;
    @property(Node) videoButton: Node = null!;
    @property(LocalizedLabel) videoButtonLabel: LocalizedLabel = null!;

    onFreeHint(_event: unknown, _data: string): void {
        throw new Error('SupplyPopup.onFreeHint not implemented');
    }

    onVideo(_event: unknown, _data: string): void {
        throw new Error('SupplyPopup.onVideo not implemented');
    }
}
