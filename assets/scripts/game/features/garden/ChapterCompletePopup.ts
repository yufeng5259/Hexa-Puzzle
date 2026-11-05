import { Label, Node, Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 整园完工奖励（每园唯一一次）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('ChapterCompletePopup')
@uiView({ bundle: 'garden', path: 'prefabs/popups/ChapterCompletePopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class ChapterCompletePopup extends PopupBase {
    @property(LocalizedLabel) chapterNameLabel: LocalizedLabel = null!;
    @property(Sprite) photo: Sprite = null!;
    @property(Label) honeyLabel: Label = null!;
    @property(Label) hintLabel: Label = null!;
    @property(Node) claimButton: Node = null!;

    onClaim(_event: unknown, _data: string): void {
        throw new Error('ChapterCompletePopup.onClaim not implemented');
    }

    onHome(_event: unknown, _data: string): void {
        throw new Error('ChapterCompletePopup.onHome not implemented');
    }
}
