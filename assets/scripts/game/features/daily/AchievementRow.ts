import { Component, Label, Node, Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';

const { ccclass, property } = _decorator;

/** Component on groups of AchievementPage. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('AchievementRow')
export class AchievementRow extends Component {
    @property(Sprite) badge: Sprite = null!;
    @property(LocalizedLabel) nameLabel: LocalizedLabel = null!;
    @property(Label) progressLabel: Label = null!;
    @property(Node) actionButton: Node = null!;
    @property(LocalizedLabel) actionLabel: LocalizedLabel = null!;

    onAction(_event: unknown, _data: string): void {
        throw new Error('AchievementRow.onAction not implemented');
    }
}
