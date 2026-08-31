const assert = require('node:assert/strict');
const { GameSettingsService, defaultSettings, normalizeSettings } = require('../../.omx/tmp/g005-tests/audio/GameSettingsService.js');

class MemoryStorage {
  constructor(initial) { this.value = initial ?? null; }
  getItem() { return this.value; }
  setItem(_key, value) { this.value = value; }
}

assert.deepEqual(defaultSettings(), { version: 1, musicEnabled: true, effectsEnabled: true });
assert.deepEqual(normalizeSettings(null), defaultSettings());
assert.deepEqual(normalizeSettings({ version: 2, musicEnabled: false }), defaultSettings());
assert.deepEqual(normalizeSettings({ version: 1, musicEnabled: false }), { version: 1, musicEnabled: false, effectsEnabled: true });
const corrupt = new GameSettingsService(new MemoryStorage('{bad'));
assert.deepEqual(corrupt.snapshot(), defaultSettings());
const storage = new MemoryStorage();
const settings = new GameSettingsService(storage);
assert.deepEqual(settings.setSoundEnabled(false), { version: 1, musicEnabled: false, effectsEnabled: false });
assert.deepEqual(new GameSettingsService(storage).snapshot(), { version: 1, musicEnabled: false, effectsEnabled: false });
console.log('G009: versioned local audio settings and corruption fallback validated.');
