import { Component, Label, Node, Sprite, SpriteFrame, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';

const { ccclass, property } = _decorator;

export type AchievementAction = 'collect' | 'go' | 'collected';
const ACTION_KEYS: Record<AchievementAction, string> = {
    collect: 'block.52ea23b04b5c.text.e2bd277de25a',
    go: 'block.52ea23b04b5c.text.f6ac8e1767a4',
    collected: 'hg.daily.achievement_collected',
};

/** 成就行：徽章（未达成/达成）、进度、操作（收藏徽章 / 去挑战 / 已收藏）。点击回调由 AchievementPage 设置。 */
@ccclass('AchievementRow')
export class AchievementRow extends Component {
    @property(Sprite) badge: Sprite = null!;
    @property(LocalizedLabel) nameLabel: LocalizedLabel = null!;
    @property(Label) progressLabel: Label = null!;
    @property(Node) actionButton: Node = null!;
    @property(LocalizedLabel) actionLabel: LocalizedLabel = null!;

    onActionTap: (action: AchievementAction) => void = () => {};
    private action: AchievementAction = 'go';

    show(frame: SpriteFrame, progress: number, target: number, action: AchievementAction): void {
        this.action = action;
        this.badge.spriteFrame = frame;
        this.progressLabel.string = `${Math.min(progress, target)}/${target}`;
        this.actionLabel.setKey(ACTION_KEYS[action]);
    }

    onAction(_event: unknown, _data: string): void {
        this.onActionTap(this.action);
    }
}
