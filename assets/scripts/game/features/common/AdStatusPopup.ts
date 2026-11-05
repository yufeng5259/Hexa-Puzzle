import { Label, Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 激励视频状态（加载 / 暂无 / 确认中 / 冷却）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('AdStatusPopup')
@uiView({ bundle: 'common', path: 'prefabs/popups/AdStatusPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class AdStatusPopup extends PopupBase {
    @property([Node]) states: Node[] = [];
    @property(LocalizedLabel) loadingRewardLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) confirmRewardLabel: LocalizedLabel = null!;
    @property(Label) cooldownLabel: Label = null!;

    onCancel(_event: unknown, _data: string): void {
        throw new Error('AdStatusPopup.onCancel not implemented');
    }

    onRetry(_event: unknown, _data: string): void {
        throw new Error('AdStatusPopup.onRetry not implemented');
    }
}
