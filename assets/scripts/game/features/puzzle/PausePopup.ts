import { _decorator } from 'cc';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 局内暂停（拼图局之上）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('PausePopup')
@uiView({ bundle: 'puzzle', path: 'prefabs/popups/PausePopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class PausePopup extends PopupBase {


    onResume(_event: unknown, _data: string): void {
        throw new Error('PausePopup.onResume not implemented');
    }

    onSettings(_event: unknown, _data: string): void {
        throw new Error('PausePopup.onSettings not implemented');
    }

    onRestart(_event: unknown, _data: string): void {
        throw new Error('PausePopup.onRestart not implemented');
    }

    onExit(_event: unknown, _data: string): void {
        throw new Error('PausePopup.onExit not implemented');
    }
}
