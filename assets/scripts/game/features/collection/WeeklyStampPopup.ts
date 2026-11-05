import { Label, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 每周纪念印记回看. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('WeeklyStampPopup')
@uiView({ bundle: 'meta', path: 'prefabs/popups/WeeklyStampPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class WeeklyStampPopup extends PopupBase {
    @property(Label) dateLabel: Label = null!;
    @property(LocalizedLabel) conditionLabel: LocalizedLabel = null!;

}
