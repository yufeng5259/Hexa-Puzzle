import { Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { AffinityNode } from './AffinityNode';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 蜂友成长（亲密度与 5/15/30 里程碑）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('CompanionDetailPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/CompanionDetailPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class CompanionDetailPage extends ViewBase {
    @property(LocalizedLabel) subtitleLabel: LocalizedLabel = null!;
    @property(Sprite) portrait: Sprite = null!;
    @property(LocalizedLabel) nameLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) affinityLabel: LocalizedLabel = null!;
    @property(Sprite) affinityFill: Sprite = null!;
    @property([AffinityNode]) milestones: AffinityNode[] = [];
    @property(LocalizedLabel) followLabel: LocalizedLabel = null!;

    onFollow(_event: unknown, _data: string): void {
        throw new Error('CompanionDetailPage.onFollow not implemented');
    }

    onTasks(_event: unknown, _data: string): void {
        throw new Error('CompanionDetailPage.onTasks not implemented');
    }
}
