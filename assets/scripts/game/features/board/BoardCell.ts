import { Component, Node, _decorator } from 'cc';

const { ccclass, property } = _decorator;

export type BoardCellState = 'groove' | 'obstacle';

/** 棋盘格（对象池）：凹槽常显；障碍、提示轮廓为状态节点。 */
@ccclass('BoardCell')
export class BoardCell extends Component {
    @property(Node) groove: Node = null!;
    @property(Node) hint: Node = null!;
    @property(Node) obstacle: Node = null!;

    setState(state: BoardCellState): void {
        this.obstacle.active = state === 'obstacle';
        this.hint.active = false;
    }

    setHint(on: boolean): void {
        this.hint.active = on;
    }
}
