// Spec DSL. Rects are design-canvas coordinates [x, y, w, h], top-left origin (853×1844), like the page configs.
// Every helper returns a plain object; gen.mjs resolves it against the page config and writes prefab + doc.

/** A layer from the spec's page config, by its exact layer `name` (image or text). */
export const layer = (name, opts = {}) => ({ t: 'layer', name, ...opts });

/** Several layers in z order: `names` is an array of layer names or a RegExp over layer names. */
export const layers = (names, opts = {}) => ({ t: 'layers', names, ...opts });

/** Container. rect defaults to the union of its children. */
export const group = (name, children, opts = {}) => ({ t: 'group', name, children, ...opts });

/** Explicit image: `file` is relative to arts/游戏素材 (e.g. 'PNG/补充/R-12_入口_信箱.png'). */
export const sprite = (name, file, rect, opts = {}) => ({ t: 'sprite', name, file, rect, ...opts });

/**
 * Explicit label. `key` is a localization key, or null for a plain number/value label (`text` is its sample).
 * style: { size, color:[r,g,b], bold, align:'left'|'center'|'right', outline:[r,g,b], outlineWidth, lines }
 */
export const label = (name, key, rect, style = {}, opts = {}) => ({ t: 'label', name, key, rect, style, ...opts });
// New keys go to tools/i18n/extra/<module>.json as { "hg.<module>.<name>": "中文" }; params use {name}.

/** Empty node: a mount point for a runtime-instantiated prefab, a pooled container, or a hit area. */
export const slot = (name, rect, opts = {}) => ({ t: 'slot', name, rect, ...opts });

/** Vertical virtual list: ScrollView + Mask + content, with ScrollableItemGrid bound to `cell` (prefab spec name). */
export const list = (name, rect, cell, opts = {}) => ({ t: 'list', name, rect, cell, ...opts });

/**
 * Common node options (any helper):
 *   bind: 'prop'            bind this node's main component (Label/LocalizedLabel/Sprite) or Node for groups/slots
 *   bind: ['prop', 'Node']  bind with an explicit type: Node | Sprite | Label | LocalizedLabel | Button
 *   bindArray: 'prop'       append to an array property (order of appearance)
 *   button: 'onHandler'     add Button; click calls the root view's public method
 *   data: 'x'               Button customEventData
 *   active: false           initially hidden (state node)
 *   align: 'top'|'bottom'   Widget pinned to the top/bottom edge of the parent (pages adapt to screen height)
 *   rect: [x,y,w,h]         override the rect from the page config
 *   as: 'Name'              node name (layer/layers default to the layer name)
 *   key: 'k'                override a text layer's localization key
 *   note: '...'             shown in the structure doc
 *   from: 'T07-01_…'        layer/layers: take the layer from another page config (another state of the same prefab)
 *   fill: true              (image) Sprite.Type.FILLED horizontal; scripts set fillRange 0..1
 *   flipX / flipY: true     mirror the node (negative scale)
 *   script: 'path'          (group/slot) component script on this node; its own bind/button scope
 *   graphics: true          (slot) add a cc.Graphics as the node's main component (drawn once by a script)
 *   props: { k: v }         (scripted group) asset/scalar properties of that component (prefabRef/frameRef/number/string)
 * Spec-level: backdropBlocks: false   popup backdrop without BlockInputEvents (overlays such as guide and toast)
 * Files whose name starts with "_" in specs/ are helper modules, not specs.
 */

/** Prefab reference value for a script property (spec name of another prefab). */
export const prefabRef = name => ({ ref: 'prefab', name });

/** SpriteFrame reference value for a script property (arts relative file). */
export const frameRef = file => ({ ref: 'frame', file });
