import { Label, Node, _decorator } from 'cc';
import { TextParams } from '../../../framework/i18n/I18n';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { services } from '../../Services';

const { ccclass, property } = _decorator;

export interface ConfirmArgs {
    titleKey: string;
    messageKey: string;
    confirmKey: string;
    cancelKey: string;
    params?: TextParams;
    /** Optional value card (e.g. honey to harvest). */
    value?: { captionKey: string; amount: number };
    onConfirm: () => void;
    onCancel?: () => void;
}

/** 通用确认框（T37-01 / T38-01 / T13-01）：标题、说明、可选数值卡、确认与取消。 */
@ccclass('ConfirmPopup')
@uiView({ bundle: 'common', path: 'prefabs/popups/ConfirmPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class ConfirmPopup extends PopupBase<ConfirmArgs> {
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) messageLabel: LocalizedLabel = null!;
    @property(Node) bee: Node = null!;
    @property(Node) valueCard: Node = null!;
    @property(Label) valueLabel: Label = null!;
    @property(LocalizedLabel) valueCaptionLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) confirmLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) cancelLabel: LocalizedLabel = null!;

    static ask(args: ConfirmArgs): void {
        void services.ui.open(ConfirmPopup, args);
    }

    protected setInfo(): void {
        const a = this.args;
        this.titleLabel.setKey(a.titleKey, a.params);
        this.messageLabel.setKey(a.messageKey, a.params);
        this.confirmLabel.setKey(a.confirmKey);
        this.cancelLabel.setKey(a.cancelKey);
        this.valueCard.active = !!a.value;
        this.bee.active = !a.value;
        if (a.value) {
            this.valueCaptionLabel.setKey(a.value.captionKey);
            this.valueLabel.string = String(a.value.amount);
        }
    }

    onConfirm(_event: unknown, _data: string): void {
        const done = this.args.onConfirm;
        this.close();
        done();
    }

    onCancel(_event: unknown, _data: string): void {
        this.onBack();
    }

    onBack(): void {
        const cancel = this.args.onCancel;
        this.close();
        if (cancel) cancel();
    }
}
