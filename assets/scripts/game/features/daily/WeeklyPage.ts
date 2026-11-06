import { Label, Node, Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { claimWeekly, dailyRules, weeklyClaimed, weeklyDone, weeklyProgress } from '../../domain/Daily';
import { services } from '../../Services';
import { today } from '../../Today';

const { ccclass, property } = _decorator;

/** 每周目标（T30-01，F042）：本周有效局与活跃天数，达成后领周礼与纪念印记。 */
@ccclass('WeeklyPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/WeeklyPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class WeeklyPage extends ViewBase {
    @property([Sprite]) dayChecks: Sprite[] = [];
    @property([Label]) dayLabels: Label[] = [];
    @property(LocalizedLabel) progressLabel: LocalizedLabel = null!;
    @property(Sprite) progressFill: Sprite = null!;
    @property(Label) rewardLabel: Label = null!;
    @property(Node) stamp: Node = null!;
    @property(Node) claimButton: Node = null!;
    @property(Node) claimedMark: Node = null!;

    private readonly onSave = (): void => this.render();

    protected setInfo(): void {
        this.render();
    }

    protected changeListener(enabled: boolean): void {
        services.save.subscribe(enabled, this.onSave);
    }

    onClaim(_event: unknown, _data: string): void {
        claimWeekly(services.save, today());
    }

    /** Active days fill the seven slots in order; unfilled slots show their number. */
    private render(): void {
        const day = today();
        const goal = dailyRules().weekly;
        const p = weeklyProgress(services.save.data, day);
        this.dayChecks.forEach((check, i) => {
            check.node.active = i < p.activeDays;
            this.dayLabels[i].node.active = i >= p.activeDays;
            this.dayLabels[i].string = String(i + 1);
        });
        this.progressLabel.setParams({ value_1: Math.min(p.games, goal.games), value_2: goal.games,
            value_3: Math.min(p.activeDays, goal.activeDays), value_4: goal.activeDays });
        this.progressFill.fillRange = (Math.min(1, p.games / goal.games) + Math.min(1, p.activeDays / goal.activeDays)) / 2;
        this.rewardLabel.string = '+' + goal.honey;
        const claimed = weeklyClaimed(services.save.data, day);
        this.claimButton.active = weeklyDone(services.save.data, day) && !claimed;
        this.claimedMark.active = claimed;
        this.stamp.active = true;
    }
}
