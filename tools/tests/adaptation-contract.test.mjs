import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const gameApp = await readFile(path.join(root, 'assets/scripts/app/GameApp.ts'), 'utf8');
const gameplay = await readFile(path.join(root, 'assets/scripts/gameplay/GameplayView.ts'), 'utf8');
const desktopCss = await readFile(path.join(root, 'build-templates/web-desktop/style.css'), 'utf8');

assert.match(gameApp, /ResolutionPolicy\.FIXED_WIDTH/);
assert.match(gameApp, /\(visibleHeight - 1280\) \/ 2/);
assert.match(gameApp, /visibleHeight \/ 1280/);
assert.match(gameApp, /position\.y - extraHeight \/ 2/);
assert.match(gameApp, /position\.y - extraHeight/);
assert.match(gameApp, /\['s_btn'\]/);
assert.match(gameApp, /\['back_btn', 's_btn'\]/);
assert.match(gameApp, /\['back_btn', 'replay_btn', 's_btn', 'tip_btn'\]/);
assert.match(desktopCss, /width:\s*min\(100vw, calc\(100vh \* 0\.5625\)\)/);

for (const layer of ['BorderBackLayer', 'TextureLayer', 'PlacementPreview', 'BorderFrontLayer']) {
  assert.match(gameplay, new RegExp(layer));
}
for (const texture of ['18_png', '2_png', '5_png']) {
  assert.match(gameplay, new RegExp(`['"]${texture}['"]`));
}
assert.match(gameplay, /frame\?\.originalSize/);
assert.doesNotMatch(gameplay, /TargetBorder[\s\S]{0,200}setParent\(cell\)/);

console.log('Adaptation contract: fixed-width top alignment and Egret hive layer order validated.');
