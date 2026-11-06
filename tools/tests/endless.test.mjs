// Endless view-facing rules. Run: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const build = new URL('../../.test-build/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const { newSave } = require(build + 'game/save/SaveData.js');
const Endless = require(build + 'game/domain/Endless.js');
const cfg = JSON.parse(fs.readFileSync(new URL('../../assets/bundles/common/config/economy.json', import.meta.url), 'utf8')).endless;

test('projected harvest matches the paid harvest and respects the daily cap', () => {
  const save = newSave(0, 0, 5);
  assert.equal(Endless.projectedHarvest(save, cfg, 2400, 'd'), 120);
  save.endless.dailyDay = 'd';
  save.endless.dailyGranted = 235;
  assert.equal(Endless.projectedHarvest(save, cfg, 2400, 'd'), 5);
  assert.equal(Endless.projectedHarvest(save, cfg, 2400, 'e'), 120, 'a new day resets the cap');
  assert.equal(Endless.projectedHarvest(save, cfg, 99, 'e'), 0);
});
