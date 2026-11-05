import { _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { FeaturedEntry } from './FeaturedEntry';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 每日精选复玩（3 题）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('FeaturedPopup')
@uiView({ bundle: 'puzzle', path: 'prefabs/popups/FeaturedPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class FeaturedPopup extends PopupBase {
    @property(LocalizedLabel) quotaLabel: LocalizedLabel = null!;
    @property([FeaturedEntry]) entries: FeaturedEntry[] = [];

    onContinue(_event: unknown, _data: string): void {
        throw new Error('FeaturedPopup.onContinue not implemented');
    }
}
