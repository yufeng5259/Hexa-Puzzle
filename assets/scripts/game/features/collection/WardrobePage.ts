import { Sprite, _decorator } from 'cc';
import { OutfitCell } from './OutfitCell';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 外观衣柜（小蜜 5 件外观）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('WardrobePage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/WardrobePage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class WardrobePage extends ViewBase {
    @property(Sprite) previewBee: Sprite = null!;
    @property(Sprite) previewOutfit: Sprite = null!;
    @property(Sprite) currentIcon: Sprite = null!;
    @property([OutfitCell]) outfits: OutfitCell[] = [];
    @property(LocalizedLabel) useLabel: LocalizedLabel = null!;

    onUse(_event: unknown, _data: string): void {
        throw new Error('WardrobePage.onUse not implemented');
    }
}
