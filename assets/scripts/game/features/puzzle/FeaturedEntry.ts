import { Component, Label, Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';

const { ccclass, property } = _decorator;

/** 每日精选的一项：关号、复玩奖励。点击回调由 FeaturedPopup 设置。 */
@ccclass('FeaturedEntry')
export class FeaturedEntry extends Component {
    @property(Node) previewRoot: Node = null!;
    @property(LocalizedLabel) levelLabel: LocalizedLabel = null!;
    @property(Label) rewardLabel: Label = null!;

    onSelect: (level: number) => void = () => {};
    private level = 0;

    show(level: number, honey: number): void {
        this.level = level;
        this.levelLabel.setParams({ level });
        this.rewardLabel.string = '+' + honey;
    }

    onPlay(_event: unknown, _data: string): void {
        this.onSelect(this.level);
    }
}
