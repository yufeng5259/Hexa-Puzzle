import { Component, Label, Node, Sprite, _decorator } from 'cc';

const { ccclass, property } = _decorator;

export interface LevelNodeState {
    number: number;
    unlocked: boolean;
    challenge: boolean;
    /** 0–3 gold stars; classic levels show 3 once cleared, challenge levels their best. */
    stars: number;
}

/** 地图关卡节点：金/灰盾、关号、限步标记、星级。点击回调由 MapPage 设置。 */
@ccclass('LevelNode')
export class LevelNode extends Component {
    @property(Node) shieldGold: Node = null!;
    @property(Label) numberLabel: Label = null!;
    @property(Node) challengeMark: Node = null!;
    @property([Sprite]) starsGold: Sprite[] = [];

    onSelect: (level: number) => void = () => {};
    private level = 0;

    show(state: LevelNodeState): void {
        this.level = state.number;
        this.numberLabel.string = String(state.number);
        this.shieldGold.active = state.unlocked;
        this.challengeMark.active = state.challenge;
        this.starsGold.forEach((star, i) => { star.node.active = i < state.stars; });
    }

    onTap(_event: unknown, _data: string): void {
        this.onSelect(this.level);
    }
}
