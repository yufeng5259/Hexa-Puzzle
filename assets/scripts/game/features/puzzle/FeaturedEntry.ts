import { Component, Label, Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';

const { ccclass, property } = _decorator;

/** Component on groups of FeaturedPopup. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('FeaturedEntry')
export class FeaturedEntry extends Component {
    @property(Node) previewRoot: Node = null!;
    @property(LocalizedLabel) levelLabel: LocalizedLabel = null!;
    @property(Label) rewardLabel: Label = null!;

    onPlay(_event: unknown, _data: string): void {
        throw new Error('FeaturedEntry.onPlay not implemented');
    }
}
