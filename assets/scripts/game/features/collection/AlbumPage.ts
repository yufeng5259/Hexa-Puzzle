import { Sprite, SpriteFrame, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { collectionConfig, showArt } from '../../CollectionConfig';
import { bookCount, hasPhoto, isAlbumClaimed, PHOTOS_PER_BOOK } from '../../domain/Collection';
import { services } from '../../Services';
import { Toast } from '../common/Toast';
import { AlbumRewardPopup } from './AlbumRewardPopup';
import { PhotoCell } from './PhotoCell';
import { PhotoDetailPopup } from './PhotoDetailPopup';

const { ccclass, property } = _decorator;

/** 旅行相册（F039/F040）：3 册页签，每册 6 张，打开时显示当前园；集齐未领时弹出集齐奖励。 */
@ccclass('AlbumPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/AlbumPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class AlbumPage extends ViewBase {
    @property([Sprite]) tabBgs: Sprite[] = [];
    @property(LocalizedLabel) bookNameLabel: LocalizedLabel = null!;
    @property([PhotoCell]) photos: PhotoCell[] = [];
    @property(LocalizedLabel) progressLabel: LocalizedLabel = null!;
    @property(SpriteFrame) tabOn: SpriteFrame = null!;
    @property(SpriteFrame) tabOff: SpriteFrame = null!;

    private book = 0;
    private readonly onSave = (): void => this.render();

    protected onOpen(): void {
        this.photos.forEach((cell, slot) => { cell.onPick = () => this.pick(slot); });
    }

    protected setInfo(): void {
        this.book = services.save.data.garden.chapter;
        this.render();
    }

    protected changeListener(enabled: boolean): void {
        services.save.subscribe(enabled, this.onSave);
    }

    onTab(_event: unknown, data: string): void {
        this.book = Number(data);
        this.render();
    }

    private pick(slot: number): void {
        const photoId = this.book * PHOTOS_PER_BOOK + slot;
        if (!hasPhoto(services.save.data, photoId)) {
            Toast.show('hg.collection.photo_pending');
            return;
        }
        void services.ui.open(PhotoDetailPopup, { photoId });
    }

    private render(): void {
        const cfg = collectionConfig();
        const save = services.save.data;
        const album = cfg.albums[this.book];
        this.tabBgs.forEach((bg, i) => { bg.spriteFrame = i === this.book ? this.tabOn : this.tabOff; });
        this.bookNameLabel.setKey('hg.collection.book_name', { theme: services.i18n.t(album.themeKey) });
        this.photos.forEach((cell, slot) => {
            const id = this.book * PHOTOS_PER_BOOK + slot;
            const recorded = hasPhoto(save, id);
            cell.show(recorded, save.collection.newPhotos.indexOf(id) >= 0);
            if (recorded) void showArt(this, cell.photo, album.photos[slot]);
        });
        const count = bookCount(save, this.book);
        this.progressLabel.setParams({ value_1: count, value_2: PHOTOS_PER_BOOK });
        if (count === PHOTOS_PER_BOOK && !isAlbumClaimed(save, this.book)) void services.ui.open(AlbumRewardPopup, { book: this.book });
    }
}
