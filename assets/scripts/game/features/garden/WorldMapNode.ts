import { Component, Label, Node, Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';

const { ccclass, property } = _decorator;

/** Component on groups of WorldMapPage. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('WorldMapNode')
export class WorldMapNode extends Component {
    @property(Label) progressLabel: Label = null!;
    @property(LocalizedLabel) lockedLabel: LocalizedLabel = null!;
    @property(Sprite) shield: Sprite = null!;
    @property(Label) indexLabel: Label = null!;
    @property(Node) homeButton: Node = null!;
    @property(Node) lockGroup: Node = null!;

    onHome(_event: unknown, _data: string): void {
        throw new Error('WorldMapNode.onHome not implemented');
    }
}
