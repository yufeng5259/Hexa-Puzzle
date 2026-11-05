import { Label, Node, _decorator } from 'cc';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 无尽无位置：收获结束或看视频清出空间续局. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('EndlessRevivePopup')
@uiView({ bundle: 'endless', path: 'prefabs/popups/EndlessRevivePopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class EndlessRevivePopup extends PopupBase {
    @property(Label) honeyLabel: Label = null!;
    @property(Node) clearAdButton: Node = null!;

    onHarvest(_event: unknown, _data: string): void {
        throw new Error('EndlessRevivePopup.onHarvest not implemented');
    }

    onClearAd(_event: unknown, _data: string): void {
        throw new Error('EndlessRevivePopup.onClearAd not implemented');
    }
}
