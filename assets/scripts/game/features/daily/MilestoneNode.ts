import { Component, Label, Node, _decorator } from 'cc';

const { ccclass, property } = _decorator;

/** Component on groups of EventDetailPage. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('MilestoneNode')
export class MilestoneNode extends Component {
    @property(Label) valueLabel: Label = null!;
    @property(Node) check: Node = null!;

}
