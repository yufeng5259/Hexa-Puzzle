import { Sprite, SpriteFrame, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PhotoCell } from './PhotoCell';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 旅行相册（3 册分页，每册 6 张）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('AlbumPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/AlbumPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class AlbumPage extends ViewBase {
    @property([Sprite]) tabBgs: Sprite[] = [];
    @property(LocalizedLabel) bookNameLabel: LocalizedLabel = null!;
    @property([PhotoCell]) photos: PhotoCell[] = [];
    @property(LocalizedLabel) progressLabel: LocalizedLabel = null!;
    @property(SpriteFrame) tabOn: SpriteFrame = null!;
    @property(SpriteFrame) tabOff: SpriteFrame = null!;

    onTab(_event: unknown, _data: string): void {
        throw new Error('AlbumPage.onTab not implemented');
    }
}
