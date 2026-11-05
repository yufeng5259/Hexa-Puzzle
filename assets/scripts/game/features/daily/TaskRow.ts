import { Component, Label, Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';

const { ccclass, property } = _decorator;

/** Component on groups of TasksPage. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('TaskRow')
export class TaskRow extends Component {
    @property(Node) doneMark: Node = null!;
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(Label) progressLabel: Label = null!;
    @property(Label) rewardLabel: Label = null!;
    @property(Node) claimButton: Node = null!;
    @property(Node) claimedMark: Node = null!;
    @property(Node) lockedMark: Node = null!;

    onClaim(_event: unknown, _data: string): void {
        throw new Error('TaskRow.onClaim not implemented');
    }
}
