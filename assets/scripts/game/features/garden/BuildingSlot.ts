import { Component, Label, Node, Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';

const { ccclass, property } = _decorator;

/** Component on groups of GardenPage. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('BuildingSlot')
export class BuildingSlot extends Component {
    @property(Sprite) body: Sprite = null!;
    @property(Node) fill: Node = null!;
    @property(LocalizedLabel) priceLabel: LocalizedLabel = null!;
    @property(Label) levelLabel: Label = null!;
    @property(Node) upgradeButton: Node = null!;
    @property(Node) maxMark: Node = null!;

    onUpgrade(_event: unknown, _data: string): void {
        throw new Error('BuildingSlot.onUpgrade not implemented');
    }
}
