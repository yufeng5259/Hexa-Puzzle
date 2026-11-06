import { Label, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

export interface WeeklyStampArgs {
    /** weekKey (Monday date) of the stamp. */
    week: string;
    games: number;
    activeDays: number;
}

/** 每周纪念印记回看（F042）：日期与达成条件；只看不领。 */
@ccclass('WeeklyStampPopup')
@uiView({ bundle: 'meta', path: 'prefabs/popups/WeeklyStampPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class WeeklyStampPopup extends PopupBase<WeeklyStampArgs> {
    @property(Label) dateLabel: Label = null!;
    @property(LocalizedLabel) conditionLabel: LocalizedLabel = null!;

    protected setInfo(): void {
        this.dateLabel.string = this.args.week;
        this.conditionLabel.setParams({ value_1: this.args.games, value_2: this.args.activeDays });
    }
}
