// Collection rule tests (F035–F040). Run: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const build = new URL('../../.test-build/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const load = p => require(build + p);
const { newSave } = load('game/save/SaveData.js');
const C = load('game/domain/Collection.js');
const { recordActivity } = load('game/domain/Activity.js');

const json = p => JSON.parse(fs.readFileSync(new URL('../../' + p, import.meta.url), 'utf8'));
const cfg = json('assets/bundles/meta/config/collection.json');
const stories = json('assets/bundles/meta/config/story.json').stories;
const fresh = () => newSave(120, 5, 5);

test('state defaults match the config', () => {
  const s = fresh();
  assert.equal(s.collection.follow, cfg.defaultFollow);
  assert.equal(s.collection.wornOutfit, cfg.initialOutfit);
  assert.deepEqual(s.collection.outfits, [cfg.initialOutfit]);
});

test('companions open by chapter (D07): xiaomi 0, huahua 1, agong 2', () => {
  const s = fresh();
  assert.deepEqual(cfg.companions.map(c => C.isCompanionOpen(s, cfg, c.id)), [true, false, false]);
  assert.throws(() => C.follow(s, cfg, 'huahua'));
  s.garden.chapter = 1;
  C.follow(s, cfg, 'huahua');
  assert.equal(s.collection.follow, 'huahua');
});

test('task affinity: +1 to the followed bee, 3 per day overall, capped at 30 without using quota', () => {
  const s = fresh();
  assert.deepEqual([1, 2, 3, 4].map(() => C.addAffinityForTask(s, cfg, 'd1')), [1, 1, 1, 0]);
  assert.equal(C.affinityOf(s, 'xiaomi'), 3);
  assert.equal(C.addAffinityForTask(s, cfg, 'd2'), 1);
  s.collection.affinity.xiaomi = 30;
  assert.equal(C.addAffinityForTask(s, cfg, 'd2'), 0);
  assert.equal(s.collection.affinityToday, 1);
});

test('stories: chapter by entered chapter, bee by affinity 15, journey end by completion; read is recorded once', () => {
  const s = fresh();
  const byId = id => stories.find(x => x.id === id);
  assert.equal(C.isStoryOpen(s, byId('chapter.1'), false), false);
  s.garden.chapter = 1;
  assert.equal(C.isStoryOpen(s, byId('chapter.1'), false), true);
  assert.equal(C.isStoryOpen(s, byId('chapter.end'), false), false);
  assert.equal(C.isStoryOpen(s, byId('chapter.end'), true), true);
  s.collection.affinity.huahua = 14;
  assert.equal(C.isStoryOpen(s, byId('bee.huahua'), false), false);
  s.collection.affinity.huahua = 15;
  assert.equal(C.isStoryOpen(s, byId('bee.huahua'), false), true);
  assert.equal(C.isStoryOpen(s, byId('bee.agong'), false), false);
  C.markStoryRead(s, 'bee.huahua');
  C.markStoryRead(s, 'bee.huahua');
  assert.deepEqual(s.collection.storiesRead, ['bee.huahua']);
  const honey = s.wallet.honey;
  assert.equal(s.wallet.honey, honey, 'no rewards');
});

test('decor needs affinity 30', () => {
  const s = fresh();
  s.collection.affinity.xiaomi = 29;
  assert.throws(() => C.setDecorWorn(s, cfg, 'xiaomi', true));
  s.collection.affinity.xiaomi = 30;
  C.setDecorWorn(s, cfg, 'xiaomi', true);
  assert.equal(s.collection.decorWorn.xiaomi, true);
});

test('outfits: wear only owned; grant is idempotent', () => {
  const s = fresh();
  assert.throws(() => C.wearOutfit(s, 'picnic_hat'));
  C.grantOutfit(s, 'picnic_hat');
  C.grantOutfit(s, 'picnic_hat');
  C.wearOutfit(s, 'picnic_hat');
  assert.deepEqual([s.collection.outfits.length, s.collection.wornOutfit], [2, 'picnic_hat']);
});

test('photos: first 0→1 build records chapter*6+building; later levels do not; group photo is slot 5', () => {
  const s = fresh();
  s.garden.chapter = 1;
  recordActivity(s, { kind: 'build', chapter: 1, buildingId: 3, level: 1 }, 'd');
  recordActivity(s, { kind: 'build', chapter: 1, buildingId: 3, level: 2 }, 'd');
  C.recordGroupPhoto(s, 1);
  assert.deepEqual(s.collection.photos, [9, 11]);
  assert.deepEqual(s.collection.newPhotos, [9, 11]);
  C.markPhotoSeen(s, 9);
  assert.deepEqual(s.collection.newPhotos, [11]);
  assert.equal(C.bookCount(s, 1), 2);
});

test('album: claim needs 6/6, pays 1 hint + book outfit once', () => {
  const s = fresh();
  for (let b = 0; b < 5; b++) recordActivity(s, { kind: 'build', chapter: 0, buildingId: b, level: 1 }, 'd');
  assert.throws(() => C.claimAlbum(s, cfg, 0));
  C.recordGroupPhoto(s, 0);
  const first = C.claimAlbum(s, cfg, 0);
  C.claimAlbum(s, cfg, 0);
  assert.deepEqual(first, { book: 0, hints: 1, outfit: 'flower_hat' });
  assert.equal(s.wallet.hints, 6);
  assert.equal(C.isAlbumClaimed(s, 0), true);
  assert.ok(s.collection.outfits.includes('flower_hat'));
});

test('config art refs point at imported files', () => {
  const map = json('tools/art-import/asset-map.json');
  const paths = new Set(Object.values(map).map(e => e.path.replace(/\.png$/, '')));
  const refs = [...cfg.companions.flatMap(c => [c.portrait, c.decor]), ...cfg.outfits.flatMap(o => [o.icon, o.preview].filter(Boolean)),
    ...cfg.albums.flatMap(a => a.photos), ...stories.map(s => s.image)];
  for (const r of refs) assert.ok(paths.has(`assets/bundles/${r.bundle}/${r.path}`), r.bundle + '/' + r.path);
});

test('every story and collection text key exists', () => {
  const table = json('assets/bundles/common/i18n/zh-CN.json');
  const keys = [...stories.flatMap(s => [s.titleKey, ...s.steps]), ...cfg.companions.map(c => c.nameKey), ...cfg.outfits.map(o => o.nameKey),
    ...cfg.albums.map(a => a.themeKey), ...cfg.buildingKeys];
  for (const k of keys) assert.ok(k in table, k);
});
