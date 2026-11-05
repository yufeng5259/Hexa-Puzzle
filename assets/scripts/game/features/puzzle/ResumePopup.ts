import { Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 未完成拼图续玩卡（地图之上）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('ResumePopup')
@uiView({ bundle: 'puzzle', path: 'prefabs/popups/ResumePopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class ResumePopup extends PopupBase {
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(Node) snapshotRoot: Node = null!;
    @property(LocalizedLabel) progressLabel: LocalizedLabel = null!;

    onResume(_event: unknown, _data: string): void {
        throw new Error('ResumePopup.onResume not implemented');
    }

    onRestart(_event: unknown, _data: string): void {
        throw new Error('ResumePopup.onRestart not implemented');
    }
}
