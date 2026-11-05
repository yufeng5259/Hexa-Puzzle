import { _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 信件详情. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('MailDetailPopup')
@uiView({ bundle: 'meta', path: 'prefabs/popups/MailDetailPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class MailDetailPopup extends PopupBase {
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) body1Label: LocalizedLabel = null!;
    @property(LocalizedLabel) body2Label: LocalizedLabel = null!;
    @property(LocalizedLabel) signatureLabel: LocalizedLabel = null!;

    onOk(_event: unknown, _data: string): void {
        throw new Error('MailDetailPopup.onOk not implemented');
    }
}
