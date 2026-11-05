import { Label, Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 本地存档摘要. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('LocalSavePopup')
@uiView({ bundle: 'common', path: 'prefabs/popups/LocalSavePopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class LocalSavePopup extends PopupBase {
    @property(LocalizedLabel) progressLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) statusLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) buildLabel: LocalizedLabel = null!;
    @property(Label) honeyLabel: Label = null!;
    @property(Node) continueButton: Node = null!;

    onSave(_event: unknown, _data: string): void {
        throw new Error('LocalSavePopup.onSave not implemented');
    }

    onContinue(_event: unknown, _data: string): void {
        throw new Error('LocalSavePopup.onContinue not implemented');
    }
}
