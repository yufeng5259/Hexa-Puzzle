const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { validateCatalog, validateLevels } = require('../../.omx/tmp/g005-tests/data/LevelValidator.js');
const { LevelRepository } = require('../../.omx/tmp/g005-tests/data/LevelRepository.js');
const { SaveService, defaultSave, normalizeSave } = require('../../.omx/tmp/g005-tests/data/SaveService.js');

(async () => {
  const root = path.resolve(__dirname, '../..');
  const readJson = async (resource) => JSON.parse(await readFile(path.join(root, 'assets/resources', `${resource}.json`), 'utf8'));
  const catalog = await readJson('data/catalog');
  assert.deepEqual(validateCatalog(catalog), []);
  const expected = { classic: { levels: 80, pieces: 439, cells: 1952 }, novice: { levels: 80, pieces: 441, cells: 1958 } };
  for (const map of catalog.categories[0].maps) {
    const result = validateLevels(await readJson(map.resource), 80);
    assert.deepEqual(result.issues, []);
    assert.deepEqual({ levels: result.statistics.levels, pieces: result.statistics.pieces, cells: result.statistics.cells }, expected[map.id]);
    for (const texture of result.statistics.textureNames) await readFile(path.join(root, 'assets/resources/gameplay/tiles', texture.replace('_png', '.png')));
  }
  const repository = new LevelRepository(readJson);
  assert.equal((await repository.getLevels('classic')).length, 80);
  assert.equal((await repository.getLevel('novice', 79)).length, 6);
  await assert.rejects(() => repository.getLevel('classic', 80), RangeError);
  class MemoryStorage {
    constructor() { this.values = new Map(); }
    getItem(key) { return this.values.get(key) ?? null; }
    setItem(key, value) { this.values.set(key, value); }
  }
  const storage = new MemoryStorage();
  const saves = new SaveService(storage);
  assert.deepEqual(saves.snapshot(), defaultSave());
  assert.equal(saves.consumeHint(), true);
  assert.equal(saves.snapshot().hints, 4);
  assert.equal(saves.completeLevel('classic', 0).firstCompletion, true);
  assert.deepEqual(saves.snapshot(), { version: 1, money: 100, hints: 5, maps: { classic: { maxCompleted: 1 } } });
  assert.equal(saves.completeLevel('classic', 0).firstCompletion, false);
  assert.equal(saves.snapshot().money, 200);
  assert.equal(saves.snapshot().hints, 5);
  assert.deepEqual(normalizeSave({ tipCount: 7, money: 300, Basic_Classic: { maxLevel: 9 }, Basic_Novice: { maxLevel: 999 } }), { version: 1, money: 300, hints: 7, maps: { classic: { maxCompleted: 9 }, novice: { maxCompleted: 80 } } });
  storage.setItem('hexa-puzzle.save', '{bad');
  assert.deepEqual(saves.reload(), defaultSave());
  const hintSaves = new SaveService(new MemoryStorage());
  for (let index = 0; index < 5; index += 1) assert.equal(hintSaves.consumeHint(), true);
  assert.equal(hintSaves.snapshot().hints, 0);
  assert.equal(hintSaves.consumeHint(), false);
  console.log('G005: catalog, 160 levels, resources, repository, and save migration validated.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
