import { Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 章节剧情 / 蜂友故事（三步，可回看）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('StoryPopup')
@uiView({ bundle: 'meta', path: 'prefabs/popups/StoryPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class StoryPopup extends PopupBase {
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) subtitleLabel: LocalizedLabel = null!;
    @property(Sprite) image: Sprite = null!;
    @property([Sprite]) stepIcons: Sprite[] = [];
    @property([LocalizedLabel]) stepLabels: LocalizedLabel[] = [];
    @property(LocalizedLabel) continueLabel: LocalizedLabel = null!;

    onContinue(_event: unknown, _data: string): void {
        throw new Error('StoryPopup.onContinue not implemented');
    }
}
