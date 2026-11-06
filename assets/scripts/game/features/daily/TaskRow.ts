import { Component, Label, Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';

const { ccclass, property } = _decorator;

export interface TaskRowView {
    titleKey: string;
    progress: number;
    target: number;
    honey: number;
    claimed: boolean;
}

/** 每日任务行：标题、进度、奖励；完成后可领，领后显示已领取。点击回调由 TasksPage 设置。 */
@ccclass('TaskRow')
export class TaskRow extends Component {
    @property(Node) doneMark: Node = null!;
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(Label) progressLabel: Label = null!;
    @property(Label) rewardLabel: Label = null!;
    @property(Node) claimButton: Node = null!;
    @property(Node) claimedMark: Node = null!;
    @property(Node) lockedMark: Node = null!;

    onClaimTask: () => void = () => {};

    show(view: TaskRowView): void {
        const done = view.progress >= view.target;
        this.titleLabel.setKey(view.titleKey);
        this.progressLabel.string = `${view.progress}/${view.target}`;
        this.rewardLabel.string = '+' + view.honey;
        this.doneMark.active = done;
        this.claimButton.active = done && !view.claimed;
        this.claimedMark.active = view.claimed;
        this.lockedMark.active = false;
    }

    onClaim(_event: unknown, _data: string): void {
        this.onClaimTask();
    }
}
