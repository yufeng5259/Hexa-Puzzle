import { _decorator } from 'cc';
import { SettingRow } from './SettingRow';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 声音与易用设置. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('SettingsPopup')
@uiView({ bundle: 'common', path: 'prefabs/popups/SettingsPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class SettingsPopup extends PopupBase {
    @property([SettingRow]) rows: SettingRow[] = [];

    onHelp(_event: unknown, _data: string): void {
        throw new Error('SettingsPopup.onHelp not implemented');
    }

    onLocalSave(_event: unknown, _data: string): void {
        throw new Error('SettingsPopup.onLocalSave not implemented');
    }

    onPrivacy(_event: unknown, _data: string): void {
        throw new Error('SettingsPopup.onPrivacy not implemented');
    }
}
