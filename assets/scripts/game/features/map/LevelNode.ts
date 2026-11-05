import { Component, Label, Node, Sprite, _decorator } from 'cc';

const { ccclass, property } = _decorator;

/** Component on groups of MapPage. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('LevelNode')
export class LevelNode extends Component {
    @property(Node) shieldGold: Node = null!;
    @property(Label) numberLabel: Label = null!;
    @property(Node) challengeMark: Node = null!;
    @property([Sprite]) starsGold: Sprite[] = [];

    onTap(_event: unknown, _data: string): void {
        throw new Error('LevelNode.onTap not implemented');
    }
}
