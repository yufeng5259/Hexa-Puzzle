import { Component, Node, _decorator } from 'cc';

const { ccclass, property } = _decorator;

/** Component on groups of MapPage. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('MapEntry')
export class MapEntry extends Component {
    @property(Node) redDot: Node = null!;

    onClick(_event: unknown, _data: string): void {
        throw new Error('MapEntry.onClick not implemented');
    }
}
