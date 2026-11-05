import { Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { MilestoneNode } from './MilestoneNode';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 花园野餐进度. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('EventDetailPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/EventDetailPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class EventDetailPage extends ViewBase {
    @property(LocalizedLabel) progressLabel: LocalizedLabel = null!;
    @property(Sprite) progressFill: Sprite = null!;
    @property([MilestoneNode]) milestones: MilestoneNode[] = [];

    onPlay(_event: unknown, _data: string): void {
        throw new Error('EventDetailPage.onPlay not implemented');
    }
}
