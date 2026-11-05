import { Component, Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';

const { ccclass, property } = _decorator;

/** Component on groups of CompanionDetailPage. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('AffinityNode')
export class AffinityNode extends Component {
    @property(Node) doneNode: Node = null!;
    @property(Node) lockNode: Node = null!;
    @property(LocalizedLabel) conditionLabel: LocalizedLabel = null!;

    onSelect(_event: unknown, _data: string): void {
        throw new Error('AffinityNode.onSelect not implemented');
    }
}
