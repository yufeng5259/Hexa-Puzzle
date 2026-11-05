import { Component, Label, Node, Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';

const { ccclass, property } = _decorator;

/** Component on groups of CompanionListPage. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('CompanionCard')
export class CompanionCard extends Component {
    @property(Sprite) portrait: Sprite = null!;
    @property(LocalizedLabel) nameLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) roleLabel: LocalizedLabel = null!;
    @property(Node) unlockedNode: Node = null!;
    @property(Label) affinityLabel: Label = null!;
    @property(Node) followingTag: Node = null!;
    @property(Node) lockedNode: Node = null!;
    @property(LocalizedLabel) conditionLabel: LocalizedLabel = null!;

    onSelect(_event: unknown, _data: string): void {
        throw new Error('CompanionCard.onSelect not implemented');
    }
}
