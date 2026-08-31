export const SETTINGS_KEY = 'hexa-puzzle.settings';
export const SETTINGS_VERSION = 1;

export interface SettingsStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface GameSettings { version: 1; musicEnabled: boolean; effectsEnabled: boolean }

export function defaultSettings(): GameSettings {
  return { version: SETTINGS_VERSION, musicEnabled: true, effectsEnabled: true };
}

export function normalizeSettings(value: unknown): GameSettings {
  if (!value || typeof value !== 'object') return defaultSettings();
  const source = value as Record<string, unknown>;
  if (source.version !== SETTINGS_VERSION) return defaultSettings();
  return {
    version: SETTINGS_VERSION,
    musicEnabled: typeof source.musicEnabled === 'boolean' ? source.musicEnabled : true,
    effectsEnabled: typeof source.effectsEnabled === 'boolean' ? source.effectsEnabled : true,
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
    this.settings.musicEnabled = enabled;
    this.settings.effectsEnabled = enabled;
    this.storage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    return this.snapshot();
  }
}
