import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const normalizedPath = path.join(projectRoot, 'assets/resources/legacy/flax/normalized-game.json');
const manifestPath = path.join(projectRoot, 'assets/resources/legacy/flax/atlas-manifest.json');
const prefabDir = path.join(projectRoot, 'assets/prefabs/legacy');
const pagePrefabDir = path.join(projectRoot, 'assets/resources/prefabs/pages');
const itemPrefabDir = path.join(projectRoot, 'assets/resources/prefabs/items');
const excludedChannelNodes = new Set(['more_btn', 'f_btn', 'i_btn']);
const externalDir = path.join(projectRoot, 'assets/resources/legacy/external');
const reportDir = path.join(projectRoot, 'docs/generated');
const sourceRoot = process.argv[2];

if (!sourceRoot) {
  throw new Error('Usage: node generate.mjs <egret-project-root>');
}

const normalized = JSON.parse(await readFile(normalizedPath, 'utf8'));
const atlasManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const displays = new Map(normalized.displays.map((item) => [item.id, item]));
const movieClips = new Map(normalized.movieClips.map((item) => [item.id, item]));
const atlasFrames = new Map(atlasManifest.frames.map((item) => [item.id, item]));

function uuidFor(key) {
  const hex = createHash('sha256').update(`hexa-puzzle:${key}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

function fileIdFor(key) {
  return createHash('sha256').update(`hexa-file:${key}`).digest('base64').replace(/=+$/, '').slice(0, 22);
}

function color(value = '#FFFFFF') {
  const hex = value.replace('#', '').padEnd(6, 'F');
  return {
    __type__: 'cc.Color',
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: 255,
  };
}

function pngSize(buffer) {
  if (buffer.toString('ascii', 1, 4) !== 'PNG') throw new Error('Only PNG assets are supported here');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpegSize(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error('Invalid JPEG image');
}

function imageSize(buffer, extension) {
  return extension === '.png' ? pngSize(buffer) : jpegSize(buffer);
}

function imageMeta(uuid, name, width, height, extension = '.png', hasAlpha = true) {
  const textureUuid = `${uuid}@6c48a`;
  const spriteUuid = `${uuid}@f9941`;
  return {
    ver: '1.0.27', importer: 'image', imported: true, uuid, files: ['.json', extension],
    subMetas: {
      '6c48a': {
        importer: 'texture', uuid: textureUuid, displayName: name, id: '6c48a', name: 'texture',
        userData: { minfilter: 'linear', magfilter: 'linear', wrapModeT: 'clamp-to-edge', wrapModeS: 'clamp-to-edge', mipfilter: 'none', imageUuidOrDatabaseUri: uuid, isUuid: true, visible: false, anisotropy: 0 },
        ver: '1.0.22', imported: true, files: ['.json'], subMetas: {},
      },
      f9941: {
        importer: 'sprite-frame', uuid: spriteUuid, displayName: name, id: 'f9941', name: 'spriteFrame',
        userData: {
          importer: 'sprite-frame', trimType: 'none', trimThreshold: 1, rotated: false,
          offsetX: 0, offsetY: 0, trimX: 0, trimY: 0, width, height, rawWidth: width, rawHeight: height,
          borderTop: 0, borderBottom: 0, borderLeft: 0, borderRight: 0,
          imageUuidOrDatabaseUri: textureUuid, packable: true, pixelsToUnit: 100, pivotX: 0.5, pivotY: 0.5,
          meshType: 0,
          vertices: {
            rawPosition: [-width / 2, -height / 2, 0, width / 2, -height / 2, 0, -width / 2, height / 2, 0, width / 2, height / 2, 0],
            indexes: [0, 1, 2, 2, 1, 3], uv: [0, height, width, height, 0, 0, width, 0], nuv: [0, 0, 1, 0, 0, 1, 1, 1],
            minPos: [-width / 2, -height / 2, 0], maxPos: [width / 2, height / 2, 0],
          },
          isUuid: true, atlasUuid: '',
        },
        ver: '1.0.12', imported: true, files: ['.json'], subMetas: {},
      },
    },
    userData: { type: 'sprite-frame', fixAlphaTransparencyArtifacts: false, redirect: textureUuid, hasAlpha },
  };
}

const imageAssets = new Map();
for (const frame of atlasManifest.frames) {
  const file = path.join(projectRoot, 'assets/resources/legacy/flax/frames', `${frame.id}.png`);
  const size = pngSize(await readFile(file));
  const uuid = uuidFor(`image:flax/${frame.id}`);
  imageAssets.set(frame.id, { uuid, spriteUuid: `${uuid}@f9941`, ...size, file: `legacy/flax/frames/${frame.id}.png` });
  await writeFile(`${file}.meta`, `${JSON.stringify(imageMeta(uuid, frame.id, size.width, size.height, '.png'), null, 2)}\n`);
}

await mkdir(externalDir, { recursive: true });
for (const display of normalized.displays.filter((item) => item.url)) {
  const source = path.join(sourceRoot, 'resource', 'swfs', display.url.replaceAll('/', path.sep));
  const extension = path.extname(display.url).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(extension)) throw new Error(`Unsupported external image ${display.id}: ${extension}`);
  const target = path.join(externalDir, `${display.id}${extension}`);
  await copyFile(source, target);
  const size = imageSize(await readFile(target), extension);
  const uuid = uuidFor(`image:external/${display.id}`);
  imageAssets.set(display.id, { uuid, spriteUuid: `${uuid}@f9941`, ...size, file: `legacy/external/${display.id}${extension}` });
  await writeFile(`${target}.meta`, `${JSON.stringify(imageMeta(uuid, display.id, size.width, size.height, extension, extension === '.png'), null, 2)}\n`);
}

function resolveDisplayImage(displayId) {
  const display = displays.get(displayId);
  if (!display) return null;
  if (display.kind === 'atlas') return imageAssets.get(display.frameIds[0]);
  if (display.url) return imageAssets.get(display.id);
  return null;
}

class PrefabBuilder {
  constructor(movieClip) {
    this.movieClip = movieClip;
    this.objects = [];
    this.assetIndex = this.push({ __type__: 'cc.Prefab', _name: movieClip.id, _objFlags: 0, __editorExtras__: {}, _native: '', data: null, optimizationPolicy: 0, asyncLoadAssets: false, persistent: false });
  }

  push(value) { this.objects.push(value); return this.objects.length - 1; }
  ref(index) { return { __id__: index }; }

  component(nodeIndex, nodeKey, type, data) {
    const component = this.push({ __type__: type, _name: '', _objFlags: 0, __editorExtras__: {}, node: this.ref(nodeIndex), _enabled: true, __prefab: null, ...data });
    const info = this.push({ __type__: 'cc.CompPrefabInfo', fileId: fileIdFor(`${nodeKey}:${type}`) });
    this.objects[component].__prefab = this.ref(info);
    return component;
  }

  addNode({ name, parentIndex = null, position = { x: 0, y: 0 }, scale = { x: 1, y: 1 }, rotation = 0, active = true, size, anchor, opacity = 255, sprite, label, key }) {
    const nodeIndex = this.push({
      __type__: 'cc.Node', _name: name, _objFlags: 0, __editorExtras__: {}, _parent: parentIndex === null ? null : this.ref(parentIndex),
      _children: [], _active: active, _components: [], _prefab: null,
      _lpos: { __type__: 'cc.Vec3', x: position.x, y: position.y, z: 0 },
      _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: Math.sin(rotation * Math.PI / 360), w: Math.cos(rotation * Math.PI / 360) },
      _lscale: { __type__: 'cc.Vec3', x: scale.x, y: scale.y, z: 1 }, _mobility: 0, _layer: 33554432,
      _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: rotation }, _id: '',
    });
    if (parentIndex !== null) this.objects[parentIndex]._children.push(this.ref(nodeIndex));
    if (sprite) {
      this.objects[nodeIndex]._components.push(this.ref(this.component(nodeIndex, key, 'cc.Sprite', {
        _customMaterial: null, _visFlags: 0, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(),
        _spriteFrame: { __uuid__: sprite.spriteUuid, __expectedType__: 'cc.SpriteFrame' }, _type: 0, _fillType: 0, _sizeMode: 0,
        _fillCenter: { __type__: 'cc.Vec2', x: 0, y: 0 }, _fillStart: 0, _fillRange: 0, _isTrimmedMode: true, _useGrayscale: false, _atlas: null,
      })));
    }
    if (label) {
      this.objects[nodeIndex]._components.push(this.ref(this.component(nodeIndex, key, 'cc.Label', {
        _customMaterial: null, _visFlags: 0, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(label.color), _string: label.text,
        _horizontalAlign: { left: 0, center: 1, right: 2 }[label.align] ?? 0, _verticalAlign: 0, _actualFontSize: label.fontSize,
        _fontSize: label.fontSize, _fontFamily: label.fontFamily || 'Arial', _lineHeight: label.fontSize, _overflow: 1, _enableWrapText: false,
        _font: null, _isSystemFontUsed: true, _spacingX: 0, _isItalic: false, _isBold: /bold/i.test(label.fontFamily || ''),
        _isUnderline: false, _underlineHeight: 0, _cacheMode: 0, _enableOutline: false,
        _outlineColor: color('#000000'), _outlineWidth: 2, _enableShadow: false, _shadowColor: color('#000000'),
        _shadowOffset: { __type__: 'cc.Vec2', x: 2, y: 2 }, _shadowBlur: 2,
      })));
    }
    if (opacity !== 255) this.objects[nodeIndex]._components.push(this.ref(this.component(nodeIndex, key, 'cc.UIOpacity', { _opacity: opacity })));
    this.objects[nodeIndex]._components.push(this.ref(this.component(nodeIndex, key, 'cc.UITransform', {
      _priority: 0, _contentSize: { __type__: 'cc.Size', width: size.width, height: size.height },
      _anchorPoint: { __type__: 'cc.Vec2', x: anchor.x, y: anchor.y },
    })));
    const prefabInfo = this.push({ __type__: 'cc.PrefabInfo', root: null, asset: this.ref(this.assetIndex), fileId: fileIdFor(`${key}:node`), instance: null, targetOverrides: null, nestedPrefabInstanceRoots: null });
    this.objects[nodeIndex]._prefab = this.ref(prefabInfo);
    return nodeIndex;
  }

  addMovieClip(movieClip, parentIndex, transform, key, stack = [], frameIndex = 0) {
    if (stack.includes(movieClip.id)) throw new Error(`Recursive MovieClip: ${[...stack, movieClip.id].join(' -> ')}`);
    const root = this.addNode({ name: transform?.name ?? movieClip.id, parentIndex, position: transform?.position, scale: transform?.scale, rotation: transform?.rotation ?? 0, active: transform?.active ?? true, size: { width: movieClip.bounds.width, height: movieClip.bounds.height }, anchor: movieClip.anchor, opacity: transform?.opacity ?? 255, key });
    const nextStack = [...stack, movieClip.id];
    const ordered = [...movieClip.children].sort((a, b) => (a.states[frameIndex]?.zIndex ?? a.defaultZIndex) - (b.states[frameIndex]?.zIndex ?? b.defaultZIndex) || a.instanceName.localeCompare(b.instanceName));
    for (const child of ordered) {
      if (excludedChannelNodes.has(child.instanceName)) continue;
      const initialState = child.states[frameIndex];
      const state = initialState ?? child.states.find(Boolean);
      const childKey = `${key}/${child.instanceName}`;
      if (!state) {
        const placeholderSize = { width: 0, height: 0 };
        this.addNode({ name: child.instanceName, parentIndex: root, position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0, active: false, size: placeholderSize, anchor: { x: 0.5, y: 0.5 }, key: childKey });
        continue;
      }
      const position = { x: state.position.x - movieClip.bounds.width * movieClip.anchor.x, y: state.position.y - movieClip.bounds.height * movieClip.anchor.y - (child.kind === 'text' ? 3 : 0) };
      const transform = { name: child.instanceName, position, scale: state.scale, rotation: -state.rotation, opacity: Math.round(state.alpha * 255), active: Boolean(initialState) };
      if (child.kind === 'text') {
        this.addNode({ ...transform, parentIndex: root, size: state.size, anchor: { x: 0, y: 1 }, label: { text: child.defaultText ?? '', ...state }, key: childKey });
      } else if (movieClips.has(child.displayId)) {
        this.addMovieClip(movieClips.get(child.displayId), root, transform, childKey, nextStack, 0);
      } else {
        const image = resolveDisplayImage(child.displayId);
        if (!image) throw new Error(`Display ${child.displayId} used by ${movieClip.id}/${child.instanceName} has no image`);
        const display = displays.get(child.displayId);
        this.addNode({ ...transform, parentIndex: root, size: { width: image.width, height: image.height }, anchor: display.anchor, sprite: image, key: childKey });
      }
    }
    return root;
  }

  build(frameIndex = 0) {
    const rootIndex = this.addMovieClip(this.movieClip, null, { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0, opacity: 255, active: true }, this.movieClip.id, [], frameIndex);
    return this.finish(rootIndex);
  }

  buildPage(contentId, backgroundId, stageOffset = { x: 0, y: 0 }, extraDisplays = []) {
    const rootIndex = this.addNode({
      name: this.movieClip.id,
      size: { width: 720, height: 1280 },
      anchor: { x: 0.5, y: 0.5 },
      key: this.movieClip.id,
    });
    const background = imageAssets.get(backgroundId);
    if (!background) throw new Error(`Page ${this.movieClip.id} is missing background ${backgroundId}`);
    this.addNode({
      name: 'background', parentIndex: rootIndex, position: { x: 0, y: 0 },
      size: { width: 720, height: 1280 }, anchor: { x: 0.5, y: 0.5 }, sprite: background,
      key: `${this.movieClip.id}/background`,
    });
    for (const extra of extraDisplays) {
      const image = resolveDisplayImage(extra.id);
      if (!image) throw new Error(`Page ${this.movieClip.id} is missing display ${extra.id}`);
      this.addNode({
        name: extra.name ?? extra.id, parentIndex: rootIndex, position: extra.position,
        size: { width: image.width, height: image.height }, anchor: extra.anchor ?? { x: 0.5, y: 0.5 }, sprite: image,
        key: `${this.movieClip.id}/${extra.name ?? extra.id}`,
      });
    }
    const content = movieClips.get(contentId);
    if (!content) throw new Error(`Page ${this.movieClip.id} is missing MovieClip ${contentId}`);
    this.addMovieClip(content, rootIndex, {
      name: contentId,
      position: {
        x: content.bounds.width * content.anchor.x - 360 + stageOffset.x,
        y: content.bounds.height * content.anchor.y - 640 - stageOffset.y,
      },
      scale: { x: 1, y: 1 }, rotation: 0, opacity: 255, active: true,
    }, `${this.movieClip.id}/${contentId}`);
    return this.finish(rootIndex);
  }

  finish(rootIndex) {
    this.objects[this.assetIndex].data = this.ref(rootIndex);
    for (const object of this.objects) if (object.__type__ === 'cc.PrefabInfo') object.root = this.ref(rootIndex);
    return this.objects;
  }
}

await mkdir(prefabDir, { recursive: true });
await mkdir(pagePrefabDir, { recursive: true });
await mkdir(itemPrefabDir, { recursive: true });
await mkdir(reportDir, { recursive: true });
const prefabManifest = { version: 1, generatedBy: 'tools/flax-prefab-generator/generate.mjs', prefabs: [], images: [...imageAssets.entries()].map(([id, image]) => ({ id, ...image })) };
for (const movieClip of normalized.movieClips) {
  const objects = new PrefabBuilder(movieClip).build();
  const prefabPath = path.join(prefabDir, `${movieClip.id}.prefab`);
  const prefabUuid = uuidFor(`prefab:${movieClip.id}`);
  await writeFile(prefabPath, `${JSON.stringify(objects, null, 2)}\n`);
  await writeFile(`${prefabPath}.meta`, `${JSON.stringify({ ver: '1.1.50', importer: 'prefab', imported: true, uuid: prefabUuid, files: ['.json'], subMetas: {}, userData: { syncNodeName: movieClip.id } }, null, 2)}\n`);
  prefabManifest.prefabs.push({ id: movieClip.id, uuid: prefabUuid, file: `prefabs/legacy/${movieClip.id}.prefab`, objectCount: objects.length, rootChildren: movieClip.children.length, totalFrames: movieClip.totalFrames });
}

const pageDefinitions = [
  { id: 'HomePage', content: 'index', background: 'a2', stageOffset: { x: -112, y: 71 } },
  { id: 'LevelPage', content: 'scene2', background: 'a2', stageOffset: { x: 0, y: -44 } },
  { id: 'GameplayPage', content: 'scene3', background: 'a2', stageOffset: { x: 0, y: -44 }, extraDisplays: [{ id: 'a19', name: 'trayBackground', position: { x: 0, y: -235 } }] },
];
for (const page of pageDefinitions) {
  const pageModel = { id: page.id, bounds: { x: 0, y: 0, width: 720, height: 1280 }, anchor: { x: 0.5, y: 0.5 }, children: [], totalFrames: 1 };
  const objects = new PrefabBuilder(pageModel).buildPage(page.content, page.background, page.stageOffset, page.extraDisplays);
  const prefabPath = path.join(pagePrefabDir, `${page.id}.prefab`);
  const prefabUuid = uuidFor(`prefab:page/${page.id}`);
  await writeFile(prefabPath, `${JSON.stringify(objects, null, 2)}\n`);
  await writeFile(`${prefabPath}.meta`, `${JSON.stringify({ ver: '1.1.50', importer: 'prefab', imported: true, uuid: prefabUuid, files: ['.json'], subMetas: {}, userData: { syncNodeName: page.id } }, null, 2)}\n`);
}

const itemDefinitions = [
  { id: 'LevelLocked', source: 'itemrender2', frame: 0 },
  { id: 'LevelCompleted', source: 'itemrender2', frame: 1 },
  { id: 'LevelAvailable', source: 'itemrender2', frame: 2 },
  { id: 'WinOverlay', source: 'winpl', frame: 0 },
];
for (const item of itemDefinitions) {
  const source = movieClips.get(item.source);
  const objects = new PrefabBuilder({ ...source, id: item.id }).build(item.frame);
  const prefabPath = path.join(itemPrefabDir, `${item.id}.prefab`);
  const prefabUuid = uuidFor(`prefab:item/${item.id}`);
  await writeFile(prefabPath, `${JSON.stringify(objects, null, 2)}\n`);
  await writeFile(`${prefabPath}.meta`, `${JSON.stringify({ ver: '1.1.50', importer: 'prefab', imported: true, uuid: prefabUuid, files: ['.json'], subMetas: {}, userData: { syncNodeName: item.id } }, null, 2)}\n`);
}

await writeFile(path.join(projectRoot, 'assets/resources/legacy/flax/flax-prefabs.json'), `${JSON.stringify(prefabManifest, null, 2)}\n`);
await writeFile(path.join(reportDir, 'flax-prefab-generation.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), ...prefabManifest }, null, 2)}\n`);
const inventory = ['# Flax UI盘点', '', `- MovieClip / Prefab：${prefabManifest.prefabs.length}`, `- 图集切片：${atlasManifest.frames.length}`, `- 外部图片：${normalized.displays.filter((item) => item.url).length}`, '', '| Prefab | 直接子项 | 帧数 | 序列化对象数 |', '| --- | ---: | ---: | ---: |', ...prefabManifest.prefabs.map((item) => `| ${item.id} | ${item.rootChildren} | ${item.totalFrames} | ${item.objectCount} |`), ''];
await writeFile(path.join(reportDir, 'flax-ui-inventory.md'), inventory.join('\n'));
console.log(JSON.stringify({ prefabs: prefabManifest.prefabs.length, images: imageAssets.size, output: prefabDir }, null, 2));
