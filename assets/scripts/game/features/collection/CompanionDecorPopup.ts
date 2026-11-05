import { Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 蜂友专属装饰（亲密 30）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('CompanionDecorPopup')
@uiView({ bundle: 'meta', path: 'prefabs/popups/CompanionDecorPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class CompanionDecorPopup extends PopupBase {
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) subtitleLabel: LocalizedLabel = null!;
    @property(Sprite) portraitBefore: Sprite = null!;
    @property(Sprite) portraitAfter: Sprite = null!;
    @property(Sprite) decor: Sprite = null!;
    @property(LocalizedLabel) wornLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) descLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) toggleLabel: LocalizedLabel = null!;

    onToggleWear(_event: unknown, _data: string): void {
        throw new Error('CompanionDecorPopup.onToggleWear not implemented');
    }
}
