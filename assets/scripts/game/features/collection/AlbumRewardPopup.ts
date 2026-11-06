import { Label, Sprite, SpriteFrame, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { collectionConfig, showArt } from '../../CollectionConfig';
import { claimAlbum, isAlbumClaimed, PHOTOS_PER_BOOK } from '../../domain/Collection';
import { services } from '../../Services';
import { Toast } from '../common/Toast';

const { ccclass, property } = _decorator;

export interface AlbumRewardArgs { book: number; }

/** 相册集齐奖励（F040）：每册一次，1 提示 + 该册外观（album:{book}）。 */
@ccclass('AlbumRewardPopup')
@uiView({ bundle: 'meta', path: 'prefabs/popups/AlbumRewardPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class AlbumRewardPopup extends PopupBase<AlbumRewardArgs> {
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(Sprite) bookPhoto: Sprite = null!;
    @property(LocalizedLabel) bookNameLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) countLabel: LocalizedLabel = null!;
    @property(Label) hintRewardLabel: Label = null!;
    @property(Sprite) outfitIcon: Sprite = null!;
    @property(LocalizedLabel) outfitNameLabel: LocalizedLabel = null!;
    @property([SpriteFrame]) bookPhotos: SpriteFrame[] = [];

    protected setInfo(): void {
        const cfg = collectionConfig();
        const book = this.args.book;
        const album = cfg.albums[book];
        const outfit = cfg.outfits.find(o => o.id === album.outfit)!;
        this.titleLabel.setParams({ count: book + 1 });
        this.bookPhoto.spriteFrame = this.bookPhotos[book];
        this.bookNameLabel.setKey(album.themeKey);
        this.countLabel.setParams({ value_1: PHOTOS_PER_BOOK, value_2: PHOTOS_PER_BOOK });
        this.hintRewardLabel.string = '+' + cfg.albumReward.hints;
        this.outfitNameLabel.setKey(outfit.nameKey);
        void showArt(this, this.outfitIcon, outfit.icon);
    }

    onClaim(_event: unknown, _data: string): void {
        const book = this.args.book;
        if (isAlbumClaimed(services.save.data, book)) Toast.show('hg.collection.album_claimed');
        else services.save.transact(draft => { claimAlbum(draft, collectionConfig(), book); });
        this.close();
    }
}
