import { Label, Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 通用确认弹窗（退出本局 / 重新开始 / 无尽收获）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('ConfirmPopup')
@uiView({ bundle: 'common', path: 'prefabs/popups/ConfirmPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class ConfirmPopup extends PopupBase {
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) messageLabel: LocalizedLabel = null!;
    @property(Node) bee: Node = null!;
    @property(Node) valueCard: Node = null!;
    @property(Label) valueLabel: Label = null!;
    @property(LocalizedLabel) valueCaptionLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) confirmLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) cancelLabel: LocalizedLabel = null!;

    onConfirm(_event: unknown, _data: string): void {
        throw new Error('ConfirmPopup.onConfirm not implemented');
    }

    onCancel(_event: unknown, _data: string): void {
        throw new Error('ConfirmPopup.onCancel not implemented');
    }
}
