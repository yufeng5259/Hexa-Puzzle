import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(await readFile(path.join(root, 'assets/resources/legacy/flax/flax-prefabs.json'), 'utf8'));
assert.equal(manifest.prefabs.length, 15);
assert.equal(manifest.images.length, 45);
const files = (await readdir(path.join(root, 'assets/prefabs/legacy'))).filter((name) => name.endsWith('.prefab'));
assert.equal(files.length, 15);
for (const file of files) {
  const objects = JSON.parse(await readFile(path.join(root, 'assets/prefabs/legacy', file), 'utf8'));
  assert.equal(objects[0].__type__, 'cc.Prefab');
  assert.equal(objects[1].__type__, 'cc.Node');
  assert.ok(!objects.some((item) => ['more_btn', 'f_btn', 'i_btn'].includes(item._name)), `${file} contains excluded channel UI`);
  assert.ok(objects.some((item) => item.__type__ === 'cc.UITransform'));
  for (const item of objects.filter((entry) => entry.__type__ === 'cc.Sprite')) {
    assert.match(item._spriteFrame.__uuid__, /^[0-9a-f-]{36}@f9941$/);
  }
}
const music = JSON.parse(await readFile(path.join(root, 'assets/prefabs/legacy/music.prefab'), 'utf8'));
assert.equal(music.filter((item) => item.__type__ === 'cc.Sprite').length, 2);
const itemRender2 = JSON.parse(await readFile(path.join(root, 'assets/prefabs/legacy/itemrender2.prefab'), 'utf8'));
assert.equal(itemRender2.filter((item) => item.__type__ === 'cc.Sprite').length, 4);
const homePage = JSON.parse(await readFile(path.join(root, 'assets/resources/prefabs/pages/HomePage.prefab'), 'utf8'));
assert.equal(homePage[1]._name, 'HomePage');
assert.deepEqual(homePage[1]._children.map((ref) => homePage[ref.__id__]._name), ['background', 'index']);
const homeContent = homePage[homePage[1]._children[1].__id__];
assert.equal(homeContent._lpos.x, -359.996878);
assert.equal(homeContent._lpos.y, 638.75);
assert.ok(homePage.some((item) => item._name === 'play_btn'));
assert.ok(homePage.some((item) => item._name === 's_btn'));

for (const pageName of ['LevelPage', 'GameplayPage']) {
  const page = JSON.parse(await readFile(path.join(root, `assets/resources/prefabs/pages/${pageName}.prefab`), 'utf8'));
  assert.equal(page[1]._name, pageName);
}
for (const itemName of ['LevelLocked', 'LevelAvailable', 'LevelCompleted', 'WinOverlay']) {
  const item = JSON.parse(await readFile(path.join(root, `assets/resources/prefabs/items/${itemName}.prefab`), 'utf8'));
  assert.equal(item[1]._name, itemName);
}
console.log(`Validated ${files.length} Prefabs and ${manifest.images.length} image resources.`);
