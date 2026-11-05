import { Label, Node, _decorator } from 'cc';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 提示不足（拼图局之上）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('HintEmptyPopup')
@uiView({ bundle: 'puzzle', path: 'prefabs/popups/HintEmptyPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class HintEmptyPopup extends PopupBase {
    @property(Label) stockLabel: Label = null!;
    @property(Node) adButton: Node = null!;
    @property(Node) freeButton: Node = null!;

    onResume(_event: unknown, _data: string): void {
        throw new Error('HintEmptyPopup.onResume not implemented');
    }

    onHintAd(_event: unknown, _data: string): void {
        throw new Error('HintEmptyPopup.onHintAd not implemented');
    }

    onFreeHint(_event: unknown, _data: string): void {
        throw new Error('HintEmptyPopup.onFreeHint not implemented');
    }
}
