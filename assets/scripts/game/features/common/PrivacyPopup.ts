import { _decorator } from 'cc';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass } = _decorator;

/** 隐私与本机数据说明（F051）：静态说明，返回关闭。 */
@ccclass('PrivacyPopup')
@uiView({ bundle: 'common', path: 'prefabs/popups/PrivacyPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class PrivacyPopup extends PopupBase {}
