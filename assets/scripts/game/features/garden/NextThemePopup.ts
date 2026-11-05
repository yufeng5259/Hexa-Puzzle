import { Sprite, SpriteFrame, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 下一主题：前往清风水湾 / 云上蜂谷. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('NextThemePopup')
@uiView({ bundle: 'garden', path: 'prefabs/popups/NextThemePopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class NextThemePopup extends PopupBase {
    @property(LocalizedLabel) themeNameLabel: LocalizedLabel = null!;
    @property(Sprite) preview: Sprite = null!;
    @property([SpriteFrame]) previewFrames: SpriteFrame[] = [];

    onGo(_event: unknown, _data: string): void {
        throw new Error('NextThemePopup.onGo not implemented');
    }

    onHome(_event: unknown, _data: string): void {
        throw new Error('NextThemePopup.onHome not implemented');
    }
}
