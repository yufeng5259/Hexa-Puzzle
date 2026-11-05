import { Component, Label, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';

const { ccclass, property } = _decorator;

/** Component on groups of PuzzleWinPopup. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('TopHud')
export class TopHud extends Component {
    @property(LocalizedLabel) levelLabel: LocalizedLabel = null!;
    @property(Label) honeyLabel: Label = null!;
    @property(Label) hintLabel: Label = null!;

    onAvatar(_event: unknown, _data: string): void {
        throw new Error('TopHud.onAvatar not implemented');
    }

    onSettings(_event: unknown, _data: string): void {
        throw new Error('TopHud.onSettings not implemented');
    }
}
