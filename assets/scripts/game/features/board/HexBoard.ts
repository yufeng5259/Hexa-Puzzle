import { Component, Graphics, Node, Prefab, _decorator } from 'cc';

const { ccclass, property } = _decorator;

/** Component on groups of EndlessPage. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('HexBoard')
export class HexBoard extends Component {
    @property(Graphics) frame: Graphics = null!;
    @property(Node) cells: Node = null!;
    @property(Node) pieces: Node = null!;
    @property(Prefab) cellPrefab: Prefab = null!;
    @property(Prefab) piecePrefab: Prefab = null!;

}
