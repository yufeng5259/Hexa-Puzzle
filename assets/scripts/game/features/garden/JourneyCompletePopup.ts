import { _decorator } from 'cc';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { isEndlessUnlocked } from '../../domain/Mainline';
import { services } from '../../Services';
import { AlbumPage } from '../collection/AlbumPage';
import { Toast } from '../common/Toast';
import { EndlessIntroPopup } from '../endless/EndlessIntroPopup';
import { FeaturedPopup } from '../puzzle/FeaturedPopup';

const { ccclass } = _decorator;

/** 当前内容完成（T18-01，F028）：三园建完后的无消费回流入口。 */
@ccclass('JourneyCompletePopup')
@uiView({ bundle: 'garden', path: 'prefabs/popups/JourneyCompletePopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class JourneyCompletePopup extends PopupBase {
    onFeatured(_event: unknown, _data: string): void {
        this.close();
        void services.ui.open(FeaturedPopup);
    }

    onEndless(_event: unknown, _data: string): void {
        const { mainline } = services.config;
        if (!isEndlessUnlocked(services.save.data, mainline)) {
            Toast.show('hg.map.endless_locked', { level: mainline.endlessUnlockLevel });
            return;
        }
        this.close();
        void services.ui.open(EndlessIntroPopup);
    }

    onAlbum(_event: unknown, _data: string): void {
        this.close();
        void services.ui.open(AlbumPage);
    }
}
