import { Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 照片详情. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('PhotoDetailPopup')
@uiView({ bundle: 'meta', path: 'prefabs/popups/PhotoDetailPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class PhotoDetailPopup extends PopupBase {
    @property(LocalizedLabel) nameLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) bookLabel: LocalizedLabel = null!;
    @property(Sprite) photo: Sprite = null!;
    @property(LocalizedLabel) sourceLabel: LocalizedLabel = null!;

}
