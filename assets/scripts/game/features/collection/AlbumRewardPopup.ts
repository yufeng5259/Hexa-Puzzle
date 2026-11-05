import { Label, Sprite, SpriteFrame, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 相册集齐奖励（三册共用，换图换文案）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('AlbumRewardPopup')
@uiView({ bundle: 'meta', path: 'prefabs/popups/AlbumRewardPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class AlbumRewardPopup extends PopupBase {
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(Sprite) bookPhoto: Sprite = null!;
    @property(LocalizedLabel) bookNameLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) countLabel: LocalizedLabel = null!;
    @property(Label) hintRewardLabel: Label = null!;
    @property(Sprite) outfitIcon: Sprite = null!;
    @property(LocalizedLabel) outfitNameLabel: LocalizedLabel = null!;
    @property([SpriteFrame]) bookPhotos: SpriteFrame[] = [];

    onClaim(_event: unknown, _data: string): void {
        throw new Error('AlbumRewardPopup.onClaim not implemented');
    }
}
