import { Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { collectionConfig, showArt } from '../../CollectionConfig';
import { hasPhoto, markPhotoSeen, PHOTOS_PER_BOOK } from '../../domain/Collection';
import { services } from '../../Services';

const { ccclass, property } = _decorator;

export interface PhotoDetailArgs { photoId: number; }

/** 照片详情（F039）：建筑名或整园合影、所属相册、来源；查看后清除「新」标记。 */
@ccclass('PhotoDetailPopup')
@uiView({ bundle: 'meta', path: 'prefabs/popups/PhotoDetailPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class PhotoDetailPopup extends PopupBase<PhotoDetailArgs> {
    @property(LocalizedLabel) nameLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) bookLabel: LocalizedLabel = null!;
    @property(Sprite) photo: Sprite = null!;
    @property(LocalizedLabel) sourceLabel: LocalizedLabel = null!;

    protected setInfo(): void {
        const id = this.args.photoId;
        if (!hasPhoto(services.save.data, id)) throw new Error('Photo not recorded: ' + id);
        const cfg = collectionConfig();
        const book = Math.floor(id / PHOTOS_PER_BOOK), slot = id % PHOTOS_PER_BOOK;
        const album = cfg.albums[book];
        const theme = services.i18n.t(album.themeKey);
        const group = slot === PHOTOS_PER_BOOK - 1;
        const name = group ? 'hg.collection.group_photo' : cfg.buildingKeys[slot];
        this.nameLabel.setKey(name);
        this.bookLabel.setKey(album.themeKey);
        this.sourceLabel.setKey(group ? 'hg.collection.photo_source_group' : 'hg.collection.photo_source_build',
            group ? { theme } : { name: services.i18n.t(name) });
        void showArt(this, this.photo, album.photos[slot]);
        if (services.save.data.collection.newPhotos.indexOf(id) >= 0) services.save.transact(draft => markPhotoSeen(draft, id));
    }
}
