// Garden flow tests. Run: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const build = new URL('../../.test-build/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const load = p => require(build + p);
const { newSave } = load('game/save/SaveData.js');
const { SaveService } = load('game/save/SaveService.js');
const Garden = load('game/domain/Garden.js');

const readConfig = name => JSON.parse(fs.readFileSync(new URL('../../assets/bundles/common/config/' + name, import.meta.url), 'utf8'));
const economy = readConfig('economy.json');
const cfg = economy.garden;
// Upgrades record activities, which the daily module counts with its own rules.
load('game/domain/Daily.js').configureDaily(readConfig('daily.json'), economy);
const layout = JSON.parse(fs.readFileSync(new URL('../../assets/bundles/garden/config/layout.json', import.meta.url), 'utf8'));
const store = () => ({ data: null, read() { return this.data && JSON.parse(JSON.stringify(this.data)); }, write(d) { this.data = JSON.parse(JSON.stringify(d)); } });
const service = honey => new SaveService(store(), () => newSave(honey, 5, cfg.buildingCount));
const buildAll = save => { for (let b = 0; b < cfg.buildingCount; b++) for (let l = 0; l < cfg.maxLevel; l++) save.transact(d => Garden.upgrade(d, cfg, b, l, 'd')); };

test('layout has a placement for every theme and building', () => {
  for (const theme of cfg.themes) {
    assert.equal(layout[theme].length, cfg.buildingCount, theme);
    for (const p of layout[theme]) assert.ok(p.width > 0 && p.center.length === 2);
  }
});

test('chapter step: building → claim → next → … → journey on the last garden', () => {
  const save = service(1e6);
  assert.equal(Garden.chapterStep(save.data, cfg), null);
  buildAll(save);
  assert.equal(Garden.chapterStep(save.data, cfg), 'claim');
  Garden.claimChapter(save, cfg);
  assert.equal(Garden.chapterStep(save.data, cfg), 'next');
  save.transact(d => Garden.depart(d, cfg, 0, 'd'));
  assert.equal(Garden.chapterStep(save.data, cfg), null);
  buildAll(save); Garden.claimChapter(save, cfg); save.transact(d => Garden.depart(d, cfg, 1, 'd'));
  buildAll(save);
  assert.equal(Garden.chapterStep(save.data, cfg), 'claim');
  Garden.claimChapter(save, cfg);
  assert.equal(Garden.chapterStep(save.data, cfg), 'journey');
  assert.equal(Garden.isJourneyComplete(save.data, cfg), true);
});

test('world map progress: past full, current live, future empty', () => {
  const save = service(1e6);
  buildAll(save); Garden.claimChapter(save, cfg); save.transact(d => Garden.depart(d, cfg, 0, 'd'));
  save.transact(d => Garden.upgrade(d, cfg, 2, 0, 'd'));
  assert.deepEqual([0, 1, 2].map(c => Garden.chapterProgress(save.data, cfg, c)), [25, 1, 0]);
});

test('shortage (F025): exact difference, zero when affordable or maxed', () => {
  const save = service(15);
  assert.equal(Garden.shortage(save.data, cfg, 0), 25);
  const rich = service(1e6);
  for (let l = 0; l < cfg.maxLevel; l++) rich.transact(d => Garden.upgrade(d, cfg, 0, l, 'd'));
  assert.equal(Garden.shortage(rich.data, cfg, 0), 0);
  assert.equal(Garden.nextPrice(cfg, 0, cfg.maxLevel), null);
});
