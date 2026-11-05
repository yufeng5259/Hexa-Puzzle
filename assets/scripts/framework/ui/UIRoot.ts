import { _decorator, Component, Node } from 'cc';

const { ccclass, property } = _decorator;

/** BigHero ViewRoots: layer nodes are placed in Boot.scene and bound here (indexed by UILayer). */
@ccclass('UIRoot')
export class UIRoot extends Component {
    @property([Node]) layers: Node[] = [];
    /** Full-screen BlockInputEvents node, active while a transition or load is running. */
    @property(Node) block: Node = null!;
    /** Loading indicator shown when a view load takes longer than a moment. */
    @property(Node) loading: Node = null!;
}
