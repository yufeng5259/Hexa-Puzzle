import { _decorator } from 'cc';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 当前内容完成：三园全部建成后的回流入口. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('JourneyCompletePopup')
@uiView({ bundle: 'garden', path: 'prefabs/popups/JourneyCompletePopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class JourneyCompletePopup extends PopupBase {


    onFeatured(_event: unknown, _data: string): void {
        throw new Error('JourneyCompletePopup.onFeatured not implemented');
    }

    onEndless(_event: unknown, _data: string): void {
        throw new Error('JourneyCompletePopup.onEndless not implemented');
    }

    onAlbum(_event: unknown, _data: string): void {
        throw new Error('JourneyCompletePopup.onAlbum not implemented');
    }
}
