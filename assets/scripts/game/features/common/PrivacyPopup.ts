import { _decorator } from 'cc';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 隐私与本机数据说明. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('PrivacyPopup')
@uiView({ bundle: 'common', path: 'prefabs/popups/PrivacyPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class PrivacyPopup extends PopupBase {


}
