import { Component, Label, Node, Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';

const { ccclass, property } = _decorator;

export interface CompanionCardState {
    open: boolean;
    affinity: number;
    max: number;
    following: boolean;
    unlockChapter: number;
}

/** 蜂友卡：已认识（亲密、成长按钮、跟随标记）/ 未认识（锁与条件）。卡片顺序与 collection.json 的 companions 一致。 */
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

    onOpenDetail: () => void = () => {};

    show(state: CompanionCardState): void {
        this.unlockedNode.active = state.open;
        this.lockedNode.active = !state.open;
        this.followingTag.active = state.open && state.following;
        this.affinityLabel.string = `${state.affinity}/${state.max}`;
        this.conditionLabel.setParams({ count: state.unlockChapter });
    }

    onSelect(_event: unknown, _data: string): void {
        this.onOpenDetail();
    }
}
