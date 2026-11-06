import { _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { MailRule } from '../../domain/Daily';

const { ccclass, property } = _decorator;

/** 信件详情（T49-01，F050）：标题、两段正文、署名；打开即已读（由信箱提交）。 */
@ccclass('MailDetailPopup')
@uiView({ bundle: 'meta', path: 'prefabs/popups/MailDetailPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class MailDetailPopup extends PopupBase<MailRule> {
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) body1Label: LocalizedLabel = null!;
    @property(LocalizedLabel) body2Label: LocalizedLabel = null!;
    @property(LocalizedLabel) signatureLabel: LocalizedLabel = null!;

    protected setInfo(): void {
        const mail = this.args;
        this.titleLabel.setKey(mail.detailTitleKey);
        this.body1Label.setKey(mail.bodyKeys[0]);
        this.body2Label.setKey(mail.bodyKeys[1]);
        this.signatureLabel.setKey(mail.signatureKey);
    }

    onOk(_event: unknown, _data: string): void {
        this.close();
    }
}
