// Writes assets/scenes/Boot.scene: Canvas + Camera + UI layer roots + input block + loading indicator + audio source.
// Usage: node tools/ui-gen/scene.mjs
import path from 'node:path';
import { PROJECT, readJson, sceneMeta, scriptMeta } from './lib/io.mjs';
import { Builder, color, compressUuid, external } from './lib/serialize.mjs';

const W = 853, H = 1844;
const ASSETS = readJson(path.join(PROJECT, 'tools/art-import/asset-map.json'));
const classId = script => compressUuid(scriptMeta(path.join(PROJECT, 'assets/scripts', script + '.ts')));
const full = { x: 0, y: 0, w: W, h: H };

const b = new Builder('Boot', 'scene');
const scene = b.scene('Boot');
const canvas = b.node('Canvas', scene, full);
const camera = b.node('Camera', canvas, { ...full, z: 1000 });
const cam = b.component(camera, 'cc.Camera', { _projection: 0, _priority: 0, _fov: 45, _fovAxis: 0, _orthoHeight: H / 2, _near: 0, _far: 2000,
  _color: color([30, 51, 34]), _depth: 1, _stencil: 0, _clearFlags: 7, _rect: { __type__: 'cc.Rect', x: 0, y: 0, width: 1, height: 1 },
  _aperture: 19, _shutter: 7, _iso: 0, _screenScale: 1, _visibility: 1108344832, _targetTexture: null, _postProcess: null, _usePostProcess: false,
  _cameraType: -1, _trackingType: 0 });
b.component(canvas, 'cc.Canvas', { _cameraComponent: { __id__: cam }, _alignCanvasWithScreen: true });
b.fullWidget(canvas);
const layers = ['Layer_Page', 'Layer_Popup', 'Layer_Guide', 'Layer_Toast'].map(name => {
  const id = b.node(name, canvas, full);
  b.fullWidget(id);
  return id;
});
const block = b.node('Block', canvas, full, false);
b.fullWidget(block);
b.blockInput(block);
const loading = b.node('Loading', canvas, full, false);
b.fullWidget(loading);
b.blockInput(loading);
const spinner = b.node('Spinner', loading, { x: 0, y: 0, w: 160, h: 160 });
b.sprite(spinner, ASSETS['PNG/补充/R-07_加载转圈.png'].uuid + '@f9941');
const root = b.script(canvas, classId('framework/ui/UIRoot'), { layers: layers.map(id => ({ __id__: id })), block: { __id__: block }, loading: { __id__: loading } });
const audio = b.component(canvas, 'cc.AudioSource', { _clip: null, _loop: true, _playOnAwake: false, _volume: 1 });
b.script(canvas, classId('game/App'), { uiRoot: { __id__: root }, audioSource: { __id__: audio } });

const file = path.join(PROJECT, 'assets/scenes/Boot.scene');
sceneMeta(file);
b.write(file);
console.log('Boot.scene written');
