// Creator 3.8.8 prefab/scene serialization (derived from the earlier prefab-foundation builder).
import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './io.mjs';

export const ref = id => ({ __id__: id });
export const external = (uuid, type) => ({ __uuid__: uuid, __expectedType__: type });
export const color = (rgb = [255, 255, 255], a = 255) => ({ __type__: 'cc.Color', r: rgb[0], g: rgb[1], b: rgb[2], a });
const vec3 = (x = 0, y = 0, z = 0) => ({ __type__: 'cc.Vec3', x, y, z });
const vec2 = (x = 0, y = 0) => ({ __type__: 'cc.Vec2', x, y });

/** Creator's compressed class id for a script uuid (23 chars). */
export function compressUuid(uuid) {
  const hex = uuid.replaceAll('-', '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = hex.slice(0, 5);
  for (let i = 5; i < 32; i += 3) {
    const value = parseInt(hex.slice(i, i + 3), 16);
    result += alphabet[value >> 6] + alphabet[value & 63];
  }
  return result;
}

const UI_LAYER = 33554432;
const BASE = { _name: '', _objFlags: 0, __editorExtras__: {} };

export class Builder {
  /** kind 'prefab' | 'scene' */
  constructor(name, kind = 'prefab') {
    this.name = name;
    this.kind = kind;
    this.objects = kind === 'prefab'
      ? [{ __type__: 'cc.Prefab', ...BASE, _name: name, _native: '', data: ref(1), optimizationPolicy: 0, asyncLoadAssets: false, persistent: false }]
      : [{ __type__: 'cc.SceneAsset', ...BASE, _name: name, _native: '', scene: ref(1) }];
    this.root = null;
  }

  /** box: { x, y, w, h, ax, ay } with x/y the local position of the anchor point. */
  node(name, parent, box = {}, active = true) {
    const id = this.objects.length;
    this.objects.push({ __type__: 'cc.Node', ...BASE, _name: name, _parent: parent === null ? null : ref(parent), _children: [], _active: active,
      _components: [], _prefab: null, _lpos: vec3(box.x ?? 0, box.y ?? 0, box.z ?? 0), _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
      _lscale: vec3(box.sx ?? 1, box.sy ?? 1, 1), _mobility: 0, _layer: UI_LAYER, _euler: vec3(), _id: '' });
    if (parent !== null) this.objects[parent]._children.push(ref(id));
    else this.root = id;
    if (box.w !== undefined) this.component(id, 'cc.UITransform', { _contentSize: { __type__: 'cc.Size', width: box.w, height: box.h }, _anchorPoint: vec2(box.ax ?? 0.5, box.ay ?? 0.5) });
    return id;
  }

  /** Scene root: cc.Scene object at index 1. */
  scene(name) {
    const id = this.objects.length;
    this.objects.push({ __type__: 'cc.Scene', ...BASE, _name: name, _parent: null, _children: [], _active: true, _components: [], _prefab: null,
      _lpos: vec3(), _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 }, _lscale: vec3(1, 1, 1), _mobility: 0, _layer: 1073741824, _euler: vec3(),
      autoReleaseAssets: false, _id: sha256('scene:' + name).slice(0, 8) + '-0000-4000-8000-' + sha256('scene:' + name).slice(8, 20) });
    this.root = id;
    return id;
  }

  component(node, type, fields = {}) {
    const id = this.objects.length;
    this.objects.push({ __type__: type, ...BASE, node: ref(node), _enabled: true, __prefab: null, ...fields });
    this.objects[node]._components.push(ref(id));
    return id;
  }

  sprite(node, frameUuid, sliced = false, opacity = 1) {
    const id = this.component(node, 'cc.Sprite', { _customMaterial: null, _visFlags: 0, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(),
      _spriteFrame: frameUuid ? external(frameUuid, 'cc.SpriteFrame') : null, _type: sliced ? 1 : 0, _fillType: 0, _sizeMode: 0, _fillCenter: vec2(),
      _fillStart: 0, _fillRange: 1, _isTrimmedMode: false, _useGrayscale: false, _atlas: null });
    if (opacity < 1) this.component(node, 'cc.UIOpacity', { _opacity: Math.round(opacity * 255) });
    return id;
  }

  /** style: { text, size, color, bold, align, outline, outlineWidth, lines } */
  label(node, style) {
    const size = style.size ?? 28;
    return this.component(node, 'cc.Label', { _customMaterial: null, _visFlags: 0, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(style.color ?? [74, 49, 25]),
      _string: style.text ?? '', _horizontalAlign: { left: 0, center: 1, right: 2 }[style.align ?? 'center'], _verticalAlign: 1, _actualFontSize: size,
      _fontSize: size, _fontFamily: 'Arial', _lineHeight: Math.round(size * 1.25), _overflow: 2, _enableWrapText: (style.lines ?? 1) > 1, _font: null,
      _isSystemFontUsed: true, _spacingX: 0, _isItalic: false, _isBold: !!style.bold, _isUnderline: false, _underlineHeight: 0, _cacheMode: 0,
      _enableOutline: !!style.outline, _outlineColor: color(style.outline ?? [0, 0, 0]), _outlineWidth: style.outline ? Math.max(1, Math.round(style.outlineWidth ?? 2)) : 0,
      _enableShadow: false, _shadowColor: color([0, 0, 0]), _shadowOffset: vec2(), _shadowBlur: 0 });
  }

  button(node, target, componentName, componentId, handler, data = '') {
    return this.component(node, 'cc.Button', { interactable: true, _transition: 3, _normalColor: color(), _pressedColor: color([211, 211, 211]),
      _hoverColor: color(), _disabledColor: color([124, 124, 124]), _normalSprite: null, _pressedSprite: null, _hoverSprite: null, _disabledSprite: null,
      _duration: 0.1, _zoomScale: 0.95, _target: ref(node),
      clickEvents: [{ __type__: 'cc.ClickEvent', target: ref(target), component: componentName, _componentId: componentId, handler, customEventData: data }] });
  }

  /** flags: TOP 1, MID 2, BOT 4, LEFT 8, CENTER 16, RIGHT 32 */
  widget(node, flags, { top = 0, bottom = 0, left = 0, right = 0 } = {}) {
    return this.component(node, 'cc.Widget', { _alignFlags: flags, _target: null, _left: left, _right: right, _top: top, _bottom: bottom,
      _horizontalCenter: 0, _verticalCenter: 0, _isAbsLeft: true, _isAbsRight: true, _isAbsTop: true, _isAbsBottom: true,
      _isAbsHorizontalCenter: true, _isAbsVerticalCenter: true, _originalWidth: 0, _originalHeight: 0, _alignMode: 1, _lockFlags: 0, _id: '' });
  }

  fullWidget(node) { return this.widget(node, 1 | 4 | 8 | 32); }
  blockInput(node) { return this.component(node, 'cc.BlockInputEvents'); }
  graphics(node) { return this.component(node, 'cc.Graphics'); }
  opacity(node, value = 255) { return this.component(node, 'cc.UIOpacity', { _opacity: value }); }
  mask(node) { return this.component(node, 'cc.Mask', { _type: 0, _inverted: false, _segments: 64, _alphaThreshold: 0.1 }); }

  scrollView(node, content) {
    return this.component(node, 'cc.ScrollView', { _content: ref(content), horizontal: false, vertical: true, inertia: true, brake: 0.5, elastic: true,
      bounceDuration: 0.23, cancelInnerEvents: true, scrollEvents: [], _horizontalScrollBar: null, _verticalScrollBar: null });
  }

  script(node, classId, fields = {}) { return this.component(node, classId, fields); }

  finish() {
    if (this.kind === 'scene') return this.objects;
    const count = this.objects.length;
    for (let i = 1; i < count; i++) {
      const object = this.objects[i], fileId = sha256(this.name + ':' + i).slice(0, 22);
      if (object.__type__ === 'cc.Node') {
        object._prefab = ref(this.objects.length);
        this.objects.push({ __type__: 'cc.PrefabInfo', root: ref(this.root), asset: ref(0), fileId, instance: null, targetOverrides: null, nestedPrefabInstanceRoots: null });
      } else if (object.node) {
        object.__prefab = ref(this.objects.length);
        this.objects.push({ __type__: 'cc.CompPrefabInfo', fileId });
      }
    }
    return this.objects;
  }

  write(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const text = JSON.stringify(this.finish(), null, 2) + '\n';
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text);
  }
}
