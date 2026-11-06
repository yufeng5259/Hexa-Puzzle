import { Component, Label, Node, _decorator } from 'cc';

const { ccclass, property } = _decorator;

/** 野餐里程碑刻度（5/10/15/20）：只做显示，不单独发奖。 */
@ccclass('MilestoneNode')
export class MilestoneNode extends Component {
    @property(Label) valueLabel: Label = null!;
    @property(Node) check: Node = null!;

    show(mark: number, points: number): void {
        this.valueLabel.string = String(mark);
        this.check.active = points >= mark;
    }
}
