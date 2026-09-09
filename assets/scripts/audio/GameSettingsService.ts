import { DEFAULT_LOCALE, normalizeLocale as normalizeI18nLocale, type Locale } from '../i18n/I18nService';

export const SETTINGS_KEY = 'hexa-puzzle.settings';
export const SETTINGS_VERSION = 3;

export interface SettingsStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface GameSettings { version: 3; musicEnabled: boolean; effectsEnabled: boolean; vibrationEnabled: boolean; locale: Locale }

export const normalizeLocale = normalizeI18nLocale;

export function defaultSettings(): GameSettings {
  return { version: SETTINGS_VERSION, musicEnabled: true, effectsEnabled: true, vibrationEnabled: true, locale: DEFAULT_LOCALE };
}

export function normalizeSettings(value: unknown): GameSettings {
  if (!value || typeof value !== 'object') return defaultSettings();
  const source = value as Record<string, unknown>;
  if (source.version !== 1 && source.version !== 2 && source.version !== SETTINGS_VERSION) return defaultSettings();
  return {
    version: SETTINGS_VERSION,
    musicEnabled: typeof source.musicEnabled === 'boolean' ? source.musicEnabled : true,
    effectsEnabled: typeof source.effectsEnabled === 'boolean' ? source.effectsEnabled : true,
    vibrationEnabled: typeof source.vibrationEnabled === 'boolean' ? source.vibrationEnabled : true,
    locale: normalizeLocale(source.locale),
  };
}

export class GameSettingsService {
  private settings: GameSettings;

  public constructor(private readonly storage: SettingsStorage) {
    this.settings = this.load();
  }

  private load(): GameSettings {
    const raw = this.storage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    try { return normalizeSettings(JSON.parse(raw)); } catch { return defaultSettings(); }
  }

  public snapshot(): GameSettings { return { ...this.settings }; }

  public setSoundEnabled(enabled: boolean): GameSettings {
    return this.setMusicEnabled(enabled);
  }

  public setMusicEnabled(enabled: boolean): GameSettings {
    this.settings.musicEnabled = enabled;
    this.persist();
    return this.snapshot();
  }

  public setEffectsEnabled(enabled: boolean): GameSettings {
    this.settings.effectsEnabled = enabled;
    this.persist();
    return this.snapshot();
  }

  public setVibrationEnabled(enabled: boolean): GameSettings {
    this.settings.vibrationEnabled = enabled;
    this.persist();
    return this.snapshot();
  }

  public setLocale(locale: unknown): GameSettings {
    this.settings.locale = normalizeLocale(locale);
    this.persist();
    return this.snapshot();
  }

  private persist(): void {
    this.storage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
  }
}
