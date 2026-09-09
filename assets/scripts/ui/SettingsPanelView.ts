import { _decorator, Component } from 'cc';
import type { GameSettings } from '../audio/GameSettingsService';
import type { I18nKey, Locale } from '../i18n/I18nService';
import { bindAction, selectVariant, setActionEnabled, setLabelVisible, setVisible } from './PrefabUi';
const { ccclass } = _decorator;
export interface SettingsPanelViewModel {
  snapshot: () => GameSettings; currentLocale: Locale;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
  onClose: () => void; onLegacy: () => void; privacyRequired: boolean; onPrivacy: () => Promise<void>;
  onToggleMusic: () => void; onToggleEffects: () => void; onToggleVibration: () => void; onLocale: (locale: Locale) => void;
}
@ccclass('SettingsPanelView')
export class SettingsPanelView extends Component {
  private model: SettingsPanelViewModel | null = null;
  private currentLocale: Locale = 'zh-Hans';
  private privacyBusy = false;
  private privacyRequired = false;
  public async setup(model: SettingsPanelViewModel): Promise<void> {
    this.model = model;
    this.currentLocale = model.currentLocale;
    this.privacyRequired = model.privacyRequired;
    const update = (): void => {
      selectVariant(this.node, '11-settings', this.currentLocale);
      const snapshot = model.snapshot();
      for (const [id, enabled] of [['music', snapshot.musicEnabled], ['sound', snapshot.effectsEnabled], ['vibration', snapshot.vibrationEnabled]] as const) {
        setVisible(this.node, `img_${id}-toggle-on`, enabled);
        setVisible(this.node, `img_${id}-toggle-off`, !enabled);
      }
      this.setPrivacyRequired(this.privacyRequired);
    };
    update();
    bindAction(this.node, 'close', model.onClose);
    bindAction(this.node, 'music', () => { model.onToggleMusic(); update(); });
    bindAction(this.node, 'sound', () => { model.onToggleEffects(); update(); });
    bindAction(this.node, 'vibration', () => { model.onToggleVibration(); update(); });
    bindAction(this.node, 'language-zh', () => { this.currentLocale = 'zh-Hans'; model.onLocale('zh-Hans'); update(); });
    bindAction(this.node, 'language-en', () => { this.currentLocale = 'en'; model.onLocale('en'); update(); });
    bindAction(this.node, 'legacy', model.onLegacy);
    bindAction(this.node, 'privacy', () => { void this.runPrivacy(); });
  }
  public setPrivacyRequired(required: boolean): void {
    this.privacyRequired = required;
    for (const id of ['privacy-row', 'privacy-icon', 'privacy-chevron']) setVisible(this.node, `img_${id}`, required);
    setLabelVisible(this.node, 'privacy-label', required, this.currentLocale);
    setVisible(this.node, 'hit_privacy', required);
    setActionEnabled(this.node, 'privacy', required && !this.privacyBusy);
  }
  private async runPrivacy(): Promise<void> {
    if (!this.model || this.privacyBusy || !this.privacyRequired) return;
    this.privacyBusy = true;
    this.setPrivacyRequired(this.privacyRequired);
    try { await this.model.onPrivacy(); }
    finally {
      if (!this.node.isValid) return;
      this.privacyBusy = false;
      this.setPrivacyRequired(this.privacyRequired);
    }
  }
}
