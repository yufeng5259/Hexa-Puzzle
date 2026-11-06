import { Component, Label, Node, Sprite, SpriteFrame, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';

const { ccclass, property } = _decorator;

export type WorldMapNodeState = 'past' | 'current' | 'locked';

/** 世界地图上的一座园：章号、金/灰盾、进度或锁定说明；点击回调由 WorldMapPage 设置。 */
@ccclass('WorldMapNode')
export class WorldMapNode extends Component {
    @property(Label) progressLabel: Label = null!;
    @property(LocalizedLabel) lockedLabel: LocalizedLabel = null!;
    @property(Sprite) shield: Sprite = null!;
    @property(Label) indexLabel: Label = null!;
    @property(Node) homeButton: Node = null!;
    @property(Node) lockGroup: Node = null!;

    onSelect: () => void = () => {};

    show(index: number, state: WorldMapNodeState, progress: number, total: number, openShield: SpriteFrame, lockedShield: SpriteFrame): void {
        const open = state !== 'locked';
        this.indexLabel.string = String(index + 1);
        this.shield.spriteFrame = open ? openShield : lockedShield;
        this.progressLabel.node.active = open;
        this.progressLabel.string = `${progress}/${total}`;
        this.lockedLabel.node.active = !open;
        this.lockGroup.active = !open;
        this.homeButton.active = open;
    }

    onHome(_event: unknown, _data: string): void {
        this.onSelect();
    }
}
