import { SpriteFrame, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { achievementCollected, achievementProgress, collectAchievement, dailyRules } from '../../domain/Daily';
import { services } from '../../Services';
import { AchievementRow } from './AchievementRow';

const { ccclass, property } = _decorator;

/** 成就与本机纪录（T31-01，F044）：三枚徽章，达成后收藏（不发货币）；本机纪录一行。 */
@ccclass('AchievementPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/AchievementPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class AchievementPage extends ViewBase {
    @property([AchievementRow]) rows: AchievementRow[] = [];
    @property(LocalizedLabel) recordsLabel: LocalizedLabel = null!;
    /** Per row: [not reached, reached]. */
    @property([SpriteFrame]) badgeFrames: SpriteFrame[] = [];

    private readonly onSave = (): void => this.render();

    protected onOpen(): void {
        this.rows.forEach((row, i) => {
            row.onActionTap = action => {
                if (action === 'collect') collectAchievement(services.save, dailyRules().achievements[i].id);
                else if (action === 'go') this.close();
            };
        });
    }

    protected setInfo(): void {
        this.render();
    }

    protected changeListener(enabled: boolean): void {
        services.save.subscribe(enabled, this.onSave);
    }

    onHome(_event: unknown, _data: string): void {
        this.close();
    }

    private render(): void {
        const save = services.save.data;
        dailyRules().achievements.forEach((rule, i) => {
            const progress = achievementProgress(save, rule);
            const reached = progress >= rule.target;
            const action = achievementCollected(save, rule.id) ? 'collected' : reached ? 'collect' : 'go';
            this.rows[i].show(this.badgeFrames[i * 2 + (reached ? 1 : 0)], progress, rule.target, action);
        });
        this.recordsLabel.setParams({ score: save.endless.best, levels: save.mainline.cleared.length });
    }
}
