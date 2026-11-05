import { Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { CompanionCard } from './CompanionCard';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 三位蜂友列表（家园伙伴）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('CompanionListPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/CompanionListPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class CompanionListPage extends ViewBase {
    @property(LocalizedLabel) subtitleLabel: LocalizedLabel = null!;
    @property([CompanionCard]) cards: CompanionCard[] = [];
    @property(Sprite) xiaomiOutfit: Sprite = null!;
    @property(LocalizedLabel) totalLabel: LocalizedLabel = null!;
    @property(Sprite) totalFill: Sprite = null!;

    onGrowth(_event: unknown, _data: string): void {
        throw new Error('CompanionListPage.onGrowth not implemented');
    }

    onAlbum(_event: unknown, _data: string): void {
        throw new Error('CompanionListPage.onAlbum not implemented');
    }
}
