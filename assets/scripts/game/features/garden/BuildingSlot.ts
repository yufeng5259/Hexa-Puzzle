import { Component, Label, Node, Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';

const { ccclass, property } = _decorator;

export interface BuildingSlotState {
    level: number;
    maxLevel: number;
    /** Next upgrade price, or null at max level. */
    price: number | null;
}

/** 家园建筑槽：本体、价签（名称·价格）、五级进度、直接升级、满级标记。点击回调由 GardenPage 设置。 */
@ccclass('BuildingSlot')
export class BuildingSlot extends Component {
    @property(Sprite) body: Sprite = null!;
    @property(Sprite) fill: Sprite = null!;
    @property(LocalizedLabel) priceLabel: LocalizedLabel = null!;
    @property(Label) levelLabel: Label = null!;
    @property(Node) upgradeButton: Node = null!;
    @property(Node) maxMark: Node = null!;

    onSelect: () => void = () => {};

    show(state: BuildingSlotState, name: string): void {
        const max = state.price === null;
        this.fill.fillRange = state.level / state.maxLevel;
        this.levelLabel.string = `${state.level}/${state.maxLevel}`;
        this.upgradeButton.active = !max;
        this.maxMark.active = max;
        if (max) this.priceLabel.setKey('hg.garden.max', { name });
        else this.priceLabel.setKey('hg.garden.price', { name, count: state.price! });
    }

    onUpgrade(_event: unknown, _data: string): void {
        this.onSelect();
    }
}
