import { Component, Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';

const { ccclass, property } = _decorator;

/** 亲密里程碑节点（5 / 15 / 30）：已达成显示勾与「已解锁」，未达成显示锁与「亲密 N」。 */
@ccclass('AffinityNode')
export class AffinityNode extends Component {
    @property(Node) doneNode: Node = null!;
    @property(Node) lockNode: Node = null!;
    @property(LocalizedLabel) conditionLabel: LocalizedLabel = null!;

    onPick: () => void = () => {};

    show(done: boolean, doneKey: string, lockedKey: string, milestone: number): void {
        this.doneNode.active = done;
        this.lockNode.active = !done;
        if (done) this.conditionLabel.setKey(doneKey);
        else this.conditionLabel.setKey(lockedKey, { count: milestone });
    }

    onSelect(_event: unknown, _data: string): void {
        this.onPick();
    }
}
