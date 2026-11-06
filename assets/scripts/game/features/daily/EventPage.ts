import { Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { dailyRules, picnicClaimed, picnicOpen, picnicPoints } from '../../domain/Daily';
import { services } from '../../Services';
import { Toast } from '../common/Toast';
import { EventDetailPage } from './EventDetailPage';
import { EventRewardPopup } from './EventRewardPopup';
import { MilestoneNode } from './MilestoneNode';
import { renderPicnic } from './Picnic';

const { ccclass, property } = _decorator;

/** 主题活动总览：花园野餐（T33-01，F045）。第二园开放后，有效局累计点数，满点领一次花蜜。 */
@ccclass('EventPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/EventPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class EventPage extends ViewBase {
    @property(LocalizedLabel) progressLabel: LocalizedLabel = null!;
    @property(Sprite) progressFill: Sprite = null!;
    @property([MilestoneNode]) milestones: MilestoneNode[] = [];
    @property(LocalizedLabel) rewardNoteLabel: LocalizedLabel = null!;

    private readonly onSave = (): void => this.render();

    protected setInfo(): void {
        this.render();
    }

    protected changeListener(enabled: boolean): void {
        services.save.subscribe(enabled, this.onSave);
    }

    onDetail(_event: unknown, _data: string): void {
        const save = services.save.data;
        if (!picnicOpen(save)) Toast.show('hg.daily.event_locked');
        else if (picnicPoints(save) >= dailyRules().picnic.target && !picnicClaimed(save)) void services.ui.open(EventRewardPopup);
        else void services.ui.open(EventDetailPage, { overview: this });
    }

    private render(): void {
        renderPicnic(this.progressLabel, this.progressFill, this.milestones, this.rewardNoteLabel);
    }
}
