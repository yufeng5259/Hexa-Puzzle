import { SpriteFrame, _decorator } from 'cc';
import { AchievementRow } from './AchievementRow';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 成就与本机纪录. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('AchievementPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/AchievementPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class AchievementPage extends ViewBase {
    @property([AchievementRow]) rows: AchievementRow[] = [];
    @property(LocalizedLabel) recordsLabel: LocalizedLabel = null!;
    @property([SpriteFrame]) badgeFrames: SpriteFrame[] = [];

    onHome(_event: unknown, _data: string): void {
        throw new Error('AchievementPage.onHome not implemented');
    }
}
