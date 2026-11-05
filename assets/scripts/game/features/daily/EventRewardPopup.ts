import { Label, _decorator } from 'cc';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 花园野餐活动奖励. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('EventRewardPopup')
@uiView({ bundle: 'meta', path: 'prefabs/popups/EventRewardPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class EventRewardPopup extends PopupBase {
    @property(Label) rewardLabel: Label = null!;

    onClaim(_event: unknown, _data: string): void {
        throw new Error('EventRewardPopup.onClaim not implemented');
    }
}
