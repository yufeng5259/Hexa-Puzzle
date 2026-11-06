import { Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { collectionConfig, showArt } from '../../CollectionConfig';
import { affinityOf, isCompanionOpen } from '../../domain/Collection';
import { services } from '../../Services';
import { AlbumPage } from './AlbumPage';
import { CompanionCard } from './CompanionCard';
import { CompanionDetailPage } from './CompanionDetailPage';

const { ccclass, property } = _decorator;

/** 三位蜂友列表（F035）：认识状态、亲密、跟随；小蜜挂件随衣柜外观变化。 */
@ccclass('CompanionListPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/CompanionListPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class CompanionListPage extends ViewBase {
    @property(LocalizedLabel) subtitleLabel: LocalizedLabel = null!;
    @property([CompanionCard]) cards: CompanionCard[] = [];
    @property(Sprite) xiaomiOutfit: Sprite = null!;
    @property(LocalizedLabel) totalLabel: LocalizedLabel = null!;
    @property(Sprite) totalFill: Sprite = null!;

    private readonly onSave = (): void => this.render();

    protected onOpen(): void {
        const cfg = collectionConfig();
        this.cards.forEach((card, i) => { card.onOpenDetail = () => void services.ui.open(CompanionDetailPage, { bee: cfg.companions[i].id }); });
    }

    protected setInfo(): void {
        this.render();
    }

    protected changeListener(enabled: boolean): void {
        services.save.subscribe(enabled, this.onSave);
    }

    onGrowth(_event: unknown, _data: string): void {
        void services.ui.open(CompanionDetailPage, { bee: services.save.data.collection.follow });
    }

    onAlbum(_event: unknown, _data: string): void {
        void services.ui.open(AlbumPage);
    }

    private render(): void {
        const cfg = collectionConfig();
        const save = services.save.data;
        const max = cfg.affinity.max;
        let total = 0;
        cfg.companions.forEach((bee, i) => {
            const affinity = affinityOf(save, bee.id);
            total += affinity;
            this.cards[i].show({ open: isCompanionOpen(save, cfg, bee.id), affinity, max, following: save.collection.follow === bee.id, unlockChapter: bee.unlockChapter });
        });
        const all = max * cfg.companions.length;
        this.subtitleLabel.setParams({ value_1: total, value_2: all });
        this.totalLabel.setParams({ value_1: total, value_2: all });
        this.totalFill.fillRange = total / all;
        const outfit = cfg.outfits.find(o => o.id === save.collection.wornOutfit)!;
        void showArt(this, this.xiaomiOutfit, outfit.icon);
    }
}
