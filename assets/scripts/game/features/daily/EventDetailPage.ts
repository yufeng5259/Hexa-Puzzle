import { Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { dailyRules } from '../../domain/Daily';
import { services } from '../../Services';
import { MilestoneNode } from './MilestoneNode';
import { renderPicnic } from './Picnic';

const { ccclass, property } = _decorator;

export interface EventDetailArgs {
    /** The event overview underneath, closed together when going back to play. */
    overview: ViewBase<void>;
}

/** 花园野餐进度（T34-01，F045）：规则说明与“继续闯关”（回到地图）。 */
@ccclass('EventDetailPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/EventDetailPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class EventDetailPage extends ViewBase<EventDetailArgs> {
    @property(LocalizedLabel) progressLabel: LocalizedLabel = null!;
    @property(Sprite) progressFill: Sprite = null!;
    @property([MilestoneNode]) milestones: MilestoneNode[] = [];
    @property(LocalizedLabel) ruleLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) rewardNoteLabel: LocalizedLabel = null!;

    private readonly onSave = (): void => this.render();

    protected setInfo(): void {
        this.render();
    }

    protected changeListener(enabled: boolean): void {
        services.save.subscribe(enabled, this.onSave);
    }

    /** Back to the map: close this page and the event overview under it. */
    onPlay(_event: unknown, _data: string): void {
        this.args.overview.close();
        this.close();
    }

    private render(): void {
        renderPicnic(this.progressLabel, this.progressFill, this.milestones, this.rewardNoteLabel);
        this.ruleLabel.setParams({ count: dailyRules().picnic.perGame });
    }
}
