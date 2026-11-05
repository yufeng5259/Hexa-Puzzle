import { Label, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 无尽入口：开始新局 / 继续未完成的一局. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('EndlessIntroPopup')
@uiView({ bundle: 'endless', path: 'prefabs/popups/EndlessIntroPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class EndlessIntroPopup extends PopupBase {
    @property(Label) scoreLabel: Label = null!;
    @property(Label) bestLabel: Label = null!;
    @property(LocalizedLabel) startLabel: LocalizedLabel = null!;

    onRecords(_event: unknown, _data: string): void {
        throw new Error('EndlessIntroPopup.onRecords not implemented');
    }

    onSupply(_event: unknown, _data: string): void {
        throw new Error('EndlessIntroPopup.onSupply not implemented');
    }

    onStart(_event: unknown, _data: string): void {
        throw new Error('EndlessIntroPopup.onStart not implemented');
    }
}
