import { _decorator } from 'cc';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { SettingsState } from '../../domain/Settings';
import { services } from '../../Services';
import { HelpPopup } from './HelpPopup';
import { LocalSavePopup } from './LocalSavePopup';
import { PrivacyPopup } from './PrivacyPopup';
import { SettingRow } from './SettingRow';

const { ccclass, property } = _decorator;

/** Row order in the prefab: music, sfx, vibrate, reduceMotion, largeText. */
const KEYS: (keyof SettingsState)[] = ['music', 'sfx', 'vibrate', 'reduceMotion', 'largeText'];

/** 声音与易用设置（F047）：5 个开关存入存档；音频与震动服务接入前只保存选择。 */
@ccclass('SettingsPopup')
@uiView({ bundle: 'common', path: 'prefabs/popups/SettingsPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class SettingsPopup extends PopupBase {
    @property([SettingRow]) rows: SettingRow[] = [];

    protected onOpen(): void {
        this.rows.forEach(row => { row.onToggled = id => this.toggle(id as keyof SettingsState); });
    }

    protected setInfo(): void {
        this.render();
    }

    onHelp(_event: unknown, _data: string): void {
        void services.ui.open(HelpPopup, {});
    }

    onLocalSave(_event: unknown, _data: string): void {
        void services.ui.open(LocalSavePopup);
    }

    onPrivacy(_event: unknown, _data: string): void {
        void services.ui.open(PrivacyPopup);
    }

    private toggle(key: keyof SettingsState): void {
        if (KEYS.indexOf(key) < 0) throw new Error('Unknown setting ' + key);
        services.save.transact(draft => { draft.settings[key] = !draft.settings[key]; });
        this.render();
    }

    private render(): void {
        const settings = services.save.data.settings;
        this.rows.forEach((row, i) => row.show(settings[KEYS[i]]));
    }
}
