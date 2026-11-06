import { Sprite, SpriteFrame, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { cancelArt, collectionConfig, showArt } from '../../CollectionConfig';
import { wearOutfit } from '../../domain/Collection';
import { services } from '../../Services';
import { OutfitCell } from './OutfitCell';

const { ccclass, property } = _decorator;

/**
 * 外观衣柜（F038）：5 件外观，格子顺序与 collection.json 的 outfits 一致。
 * 预览：晴天围巾是叠在小蜜身上的挂件；其余外观用 R-24 整只小蜜组合图替换小蜜本体并隐藏挂件。
 */
@ccclass('WardrobePage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/WardrobePage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class WardrobePage extends ViewBase {
    @property(Sprite) previewBee: Sprite = null!;
    @property(Sprite) previewOutfit: Sprite = null!;
    @property(Sprite) currentIcon: Sprite = null!;
    @property([OutfitCell]) outfits: OutfitCell[] = [];
    @property(LocalizedLabel) useLabel: LocalizedLabel = null!;

    private selected = 0;
    /** Prefab-authored: the plain bee, and the "正在使用" key of the first cell / use button. */
    private plainBee: SpriteFrame | null = null;
    private usingKey = '';
    private useKey = '';

    protected onOpen(): void {
        this.plainBee = this.previewBee.spriteFrame;
        this.usingKey = this.outfits[0].statusLabel.key;
        this.useKey = this.useLabel.key;
        this.outfits.forEach((cell, i) => { cell.onPick = () => this.select(i); });
    }

    protected setInfo(): void {
        const worn = services.save.data.collection.wornOutfit;
        this.select(collectionConfig().outfits.findIndex(o => o.id === worn));
    }

    onUse(_event: unknown, _data: string): void {
        const id = collectionConfig().outfits[this.selected].id;
        const c = services.save.data.collection;
        if (c.wornOutfit === id || c.outfits.indexOf(id) < 0) return;
        services.save.transact(draft => wearOutfit(draft, id));
        this.render();
    }

    private select(index: number): void {
        this.selected = index;
        this.render();
    }

    private render(): void {
        const cfg = collectionConfig();
        const c = services.save.data.collection;
        cfg.outfits.forEach((o, i) => {
            const count = o.signinDay ?? (o.album !== undefined ? o.album + 1 : 0);
            this.outfits[i].show(c.wornOutfit === o.id, c.outfits.indexOf(o.id) >= 0, this.usingKey, { count });
        });
        const chosen = cfg.outfits[this.selected];
        const owned = c.outfits.indexOf(chosen.id) >= 0;
        this.useLabel.setKey(c.wornOutfit === chosen.id ? this.useKey : owned ? 'hg.collection.wear' : 'hg.collection.not_owned');
        this.previewOutfit.node.active = chosen.preview === null;
        if (chosen.preview) void showArt(this, this.previewBee, chosen.preview);
        else {
            cancelArt(this.previewBee);
            this.previewBee.spriteFrame = this.plainBee;
            void showArt(this, this.previewOutfit, chosen.icon);
        }
        void showArt(this, this.currentIcon, cfg.outfits.find(o => o.id === c.wornOutfit)!.icon);
    }
}
