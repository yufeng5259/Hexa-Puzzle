import { Label, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { claimPicnic, dailyRules } from '../../domain/Daily';
import { services } from '../../Services';

const { ccclass, property } = _decorator;

/** 野餐奖励（T35-01，F045）：满点后领一次花蜜。 */
@ccclass('EventRewardPopup')
@uiView({ bundle: 'meta', path: 'prefabs/popups/EventRewardPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class EventRewardPopup extends PopupBase {
    @property(Label) rewardLabel: Label = null!;
    @property(LocalizedLabel) noteLabel: LocalizedLabel = null!;

    protected setInfo(): void {
        const rules = dailyRules().picnic;
        this.rewardLabel.string = '+' + rules.honey;
        this.noteLabel.setParams({ count: rules.target });
    }

    onClaim(_event: unknown, _data: string): void {
        claimPicnic(services.save);
        this.close();
    }
}
