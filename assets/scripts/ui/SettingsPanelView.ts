import { _decorator, Component, sys } from 'cc';
import type { GameSettings } from '../audio/GameSettingsService';
import type { I18nKey, Locale } from '../i18n/I18nService';
import { bindAction, selectVariant, setActionEnabled, setLabelVisible, setVisible } from './PrefabUi';
const { ccclass } = _decorator;
export interface SettingsPanelViewModel {
  snapshot: () => GameSettings; currentLocale: Locale;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
  onClose: () => void; privacyRequired: boolean; onPrivacy: () => Promise<void>;
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
    this.refresh();
    bindAction(this.node, 'close', model.onClose);
    bindAction(this.node, 'music', () => { model.onToggleMusic(); this.refresh(); });
    bindAction(this.node, 'sound', () => { model.onToggleEffects(); this.refresh(); });
    bindAction(this.node, 'vibration', () => { model.onToggleVibration(); this.refresh(); });
    bindAction(this.node, 'language-zh', () => model.onLocale('zh-Hans'));
    bindAction(this.node, 'language-en', () => model.onLocale('en'));
    bindAction(this.node, 'privacy', () => { void this.runPrivacy(); });

    if (sys.platform === sys.Platform.WECHAT_GAME) {
      for (const id of ['language-en-button', 'language-zh-button', 'en_language-en-selected', 'zh_language-zh-selected', 'language-row', 'language-icon', 'language-chevron']) setVisible(this.node, `img_${id}`, false);
      setLabelVisible(this.node, 'zh_language-label', false, this.currentLocale);
      setLabelVisible(this.node, 'en_language-label', false, this.currentLocale);
      setLabelVisible(this.node, 'language-label', false, this.currentLocale);
      setVisible(this.node, 'hit_language', false);
      for (const id of ['zh_language-label', 'en_language-label', 'zh_language-zh', 'en_language-zh', 'zh_language-en', 'en_language-en']) setVisible(this.node, `${id}`, false);
      setActionEnabled(this.node, 'language', false && !this.privacyBusy);
    }

  }
  public setLocale(locale: Locale): void {
    this.currentLocale = locale;
    this.refresh();
  }
  private refresh(): void {
    const model = this.model;
    if (!model) return;
    selectVariant(this.node, '11-settings', this.currentLocale);
    const snapshot = model.snapshot();
    for (const [id, enabled] of [['music', snapshot.musicEnabled], ['sound', snapshot.effectsEnabled], ['vibration', snapshot.vibrationEnabled]] as const) {
      setVisible(this.node, `img_${id}-toggle-on`, enabled);
      setVisible(this.node, `img_${id}-toggle-off`, !enabled);
    }
    for (const id of ['legacy-row', 'legacy-icon', 'legacy-chevron']) setVisible(this.node, `img_${id}`, false);
    setLabelVisible(this.node, 'legacy-label', false, this.currentLocale);
    setVisible(this.node, 'hit_legacy', false);
    setActionEnabled(this.node, 'legacy', false);
    this.setPrivacyRequired(this.privacyRequired);
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
