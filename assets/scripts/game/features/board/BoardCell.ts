import { Component, Node, _decorator } from 'cc';

const { ccclass, property } = _decorator;

/** 棋盘格（对象池）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('BoardCell')
export class BoardCell extends Component {
    @property(Node) groove: Node = null!;
    @property(Node) hint: Node = null!;
    @property(Node) obstacle: Node = null!;

}
