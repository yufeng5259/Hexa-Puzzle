import { Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { MilestoneNode } from './MilestoneNode';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 主题活动总览（花园野餐）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('EventPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/EventPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class EventPage extends ViewBase {
    @property(LocalizedLabel) progressLabel: LocalizedLabel = null!;
    @property(Sprite) progressFill: Sprite = null!;
    @property([MilestoneNode]) milestones: MilestoneNode[] = [];

    onDetail(_event: unknown, _data: string): void {
        throw new Error('EventPage.onDetail not implemented');
    }
}
