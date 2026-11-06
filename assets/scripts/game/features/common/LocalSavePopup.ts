import { Label, Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { gardenProgress } from '../../domain/Garden';
import { reachableLevel } from '../../domain/Mainline';
import { services } from '../../Services';
import { Toast } from './Toast';

const { ccclass, property } = _decorator;

/** 本地存档摘要（F065）：可玩关号与当前园、建设进度、花蜜；保存为一次显式提交。 */
@ccclass('LocalSavePopup')
@uiView({ bundle: 'common', path: 'prefabs/popups/LocalSavePopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class LocalSavePopup extends PopupBase {
    @property(LocalizedLabel) progressLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) statusLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) buildLabel: LocalizedLabel = null!;
    @property(Label) honeyLabel: Label = null!;
    @property(Node) continueButton: Node = null!;

    protected setInfo(): void {
        const save = services.save.data;
        const { mainline, garden } = services.config;
        this.progressLabel.setParams({ value_1: reachableLevel(save, mainline), value_2: save.garden.chapter + 1 });
        this.buildLabel.setParams({ value_1: gardenProgress(save), value_2: garden.maxLevel * garden.buildingCount });
        this.honeyLabel.string = String(save.wallet.honey);
        this.continueButton.active = !!save.attempt;
    }

    /** Every command already commits; this writes the current snapshot again and confirms. */
    onSave(_event: unknown, _data: string): void {
        services.save.transact(() => undefined);
        Toast.show('hg.common.saved');
    }

    onContinue(_event: unknown, _data: string): void {
        this.close();
    }
}
