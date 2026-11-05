import { Component, Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';

const { ccclass, property } = _decorator;

/** Component on groups of WardrobePage. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('OutfitCell')
export class OutfitCell extends Component {
    @property(Node) usingNode: Node = null!;
    @property(Node) lockNode: Node = null!;
    @property(LocalizedLabel) statusLabel: LocalizedLabel = null!;

    onSelect(_event: unknown, _data: string): void {
        throw new Error('OutfitCell.onSelect not implemented');
    }
}
