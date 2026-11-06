// Prefab generator. Usage:
//   node tools/ui-gen/gen.mjs --doc               write docs/开发方案/Prefab结构.md only
//   node tools/ui-gen/gen.mjs --prefab            write prefabs, missing script skeletons, and the doc
//   node tools/ui-gen/gen.mjs --prefab --only A,B limit prefab writing to some specs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ARTS, PROJECT, directory, prefabMeta, readJson, scriptMeta, setDryRun, writeFile } from './lib/io.mjs';
import { Builder, compressUuid, external } from './lib/serialize.mjs';

const W = 853, H = 1844;
const SPECS = path.join(PROJECT, 'tools/ui-gen/specs');
const DOC = path.join(PROJECT, 'docs/开发方案/Prefab结构.md');
const ASSETS = readJson(path.join(PROJECT, 'tools/art-import/asset-map.json'));
const NINE_SLICE = readJson(path.join(PROJECT, 'tools/art-import/nine-slice.json'));
const args = process.argv.slice(2);
const writePrefabs = args.includes('--prefab');
// --doc still builds every prefab in memory (dry run) so bindings, images and scripts are validated.
setDryRun(!writePrefabs);
const I18N = Object.assign({}, ...['本地化/zh-CN.json', '本地化/缺少/zh-CN.json'].map(f => readJson(path.join(ARTS, f))),
  ...fs.readdirSync(path.join(PROJECT, 'tools/i18n/extra')).filter(f => f.endsWith('.json')).map(f => readJson(path.join(PROJECT, 'tools/i18n/extra', f))));
const paramsOf = key => [...new Set([...(I18N[key] ?? '').matchAll(/{(w+)}/g)].map(m => m[1]))];
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
/** --dir <bundle>: load only specs/<bundle> (parallel authoring); the doc section goes to ../tmp/hexa-dev/doc-<bundle>.md. */
const onlyDir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : null;

// ---------- specs ----------
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
const specs = [];
// Files starting with "_" are shared helpers, not specs.
for (const file of walk(onlyDir ? path.join(SPECS, onlyDir) : SPECS).filter(f => f.endsWith('.mjs') && !path.basename(f).startsWith('_')).sort()) {
  const module = await import(pathToFileURL(file).href);
  for (const spec of [].concat(module.default)) specs.push({ ...spec, specFile: path.relative(PROJECT, file).replaceAll('\\', '/') });
}
const byName = new Map(specs.map(s => [s.name, s]));
if (byName.size !== specs.length) throw new Error('Duplicate spec names');

const folderOf = kind => ({ page: 'pages', popup: 'popups', item: 'items', cell: 'items' })[kind];
const prefabFile = spec => spec.bundle === 'resources'
  ? path.join(PROJECT, 'assets/resources/prefabs', spec.name + '.prefab')
  : path.join(PROJECT, 'assets/bundles', spec.bundle, 'prefabs', folderOf(spec.kind), spec.name + '.prefab');
const prefabPath = spec => spec.bundle === 'resources' ? 'prefabs/' + spec.name : `prefabs/${folderOf(spec.kind)}/${spec.name}`;
const scriptPath = script => path.join(PROJECT, 'assets/scripts', script + '.ts');
const toPosix = p => p.replaceAll('\\', '/');

// ---------- page configs ----------
const pageCache = new Map();
function page(name) {
  if (pageCache.has(name)) return pageCache.get(name);
  const root = path.join(ARTS, '页面配置');
  const file = [path.join(root, name + '.json'), path.join(root, '缺少', name + '.json')].find(f => fs.existsSync(f));
  if (!file) throw new Error('No page config ' + name);
  const config = readJson(file);
  const texts = new Map((config.texts ?? []).map(t => [t.text_id, t]));
  const layers = config.layers.filter(l => l.visible !== false && l.type !== 'procedural').map(l => ({ ...l, text: l.type === 'text' ? texts.get(l.text_id) : null }));
  const result = { name, layers };
  pageCache.set(name, result);
  return result;
}
function findLayer(spec, name, index, from) {
  const source = from ?? spec.source;
  const matches = page(source).layers.filter(l => l.name === name);
  if (!matches.length) throw new Error(`${spec.name}: no layer "${name}" in ${source}`);
  if (matches.length > 1 && index === undefined) throw new Error(`${spec.name}: layer "${name}" is ambiguous in ${source} (${matches.length}); pass index`);
  return matches[index ?? 0];
}

/** Placeholder look for text without a design (listed in 缺少美术设计.md for later art). */
const NO_DESIGN_TEXT = { color: [255, 255, 255], outline: [0, 0, 0], outlineWidth: 2 };

// ---------- resolve spec nodes to rects ----------
function textStyle(t) {
  return { text: t.localization_key ? '' : String(t.text ?? ''), size: t.font_size, color: t.color_rgb, bold: t.weight === 'bold', align: t.align,
    outline: t.stroke_width > 0 ? t.stroke_color : null, outlineWidth: t.stroke_width, lines: t.max_lines ?? 1 };
}
function fromLayer(l, opts) {
  if (l.type === 'text') {
    const t = l.text;
    const [x1, y1, x2, y2] = t.box;
    return { kind: 'text', name: opts.as ?? l.name, rect: opts.rect ?? [x1, y1, x2 - x1, y2 - y1], key: opts.key ?? t.localization_key ?? null,
      style: { ...textStyle(t), ...(opts.style ?? {}) }, sample: t.text, opts };
  }
  return { kind: 'image', name: opts.as ?? l.name, rect: opts.rect ?? [l.position[0], l.position[1], l.size[0], l.size[1]], file: l.file, opacity: l.opacity ?? 1, opts };
}
function union(rects) {
  const x1 = Math.min(...rects.map(r => r[0])), y1 = Math.min(...rects.map(r => r[1]));
  const x2 = Math.max(...rects.map(r => r[0] + r[2])), y2 = Math.max(...rects.map(r => r[1] + r[3]));
  return [x1, y1, x2 - x1, y2 - y1];
}
function resolve(spec, n) {
  switch (n.t) {
    case 'layer': return [fromLayer(findLayer(spec, n.name, n.index, n.from), n)];
    case 'layers': {
      const all = page(n.from ?? spec.source).layers;
      const picked = n.names instanceof RegExp ? all.filter(l => n.names.test(l.name)) : n.names.map(name => findLayer(spec, name, undefined, n.from));
      if (!picked.length) throw new Error(`${spec.name}: layers ${n.names} matched nothing`);
      return picked.sort((a, b) => a.z - b.z).map(l => fromLayer(l, { ...n, as: undefined }));
    }
    case 'group': {
      const children = n.children.flatMap(c => resolve(spec, c));
      if (!n.rect && !children.length) throw new Error(`${spec.name}: empty group ${n.name} needs a rect`);
      return [{ kind: 'group', name: n.name, rect: n.rect ?? union(children.map(c => c.rect)), children, opts: n }];
    }
    case 'sprite': return [{ kind: 'image', name: n.name, rect: n.rect, file: n.file, opacity: n.opacity ?? 1, devPlaced: true, opts: n }];
    // Text the design does not have: one placeholder style (white, black outline); only size/bold/align/lines come from the spec.
    case 'label': return [{ kind: 'text', name: n.name, rect: n.rect, key: n.key, designless: true,
      style: { text: n.key ? '' : (n.text ?? ''), size: n.style.size, bold: n.style.bold, align: n.style.align, lines: n.style.lines, ...NO_DESIGN_TEXT }, sample: n.text, opts: n }];
    case 'slot': return [{ kind: 'slot', name: n.name, rect: n.rect, children: (n.children ?? []).flatMap(c => resolve(spec, c)), opts: n }];
    case 'list': return [{ kind: 'list', name: n.name, rect: n.rect, cell: n.cell, opts: n }];
    default: throw new Error(`${spec.name}: unknown node type ${n.t}`);
  }
}

// ---------- scripts registry ----------
const FRAMEWORK = { LocalizedLabel: 'framework/i18n/LocalizedLabel', ScrollableItemGrid: 'framework/ui/grid/ScrollableItemGrid' };
const CC_TYPES = new Set(['Node', 'Sprite', 'Label', 'Button', 'Graphics']);
/** Implemented by ViewBase (the back button and the back key share it). */
const BASE_HANDLERS = new Set(['onBack']);
/** script path -> { script, kind, cls, binds: Map(prop -> {type, array}), handlers: Set, props, spec } */
const scripts = new Map();
function register(script, kind, spec) {
  const entry = scripts.get(script) ?? { script, kind, cls: path.basename(script), binds: new Map(), handlers: new Set(), props: {}, spec };
  if (entry.kind !== kind) throw new Error(`${script} used as ${entry.kind} and ${kind}`);
  scripts.set(script, entry);
  return entry;
}
const classIdOf = script => compressUuid(scriptMeta(scriptPath(script)));
const frameUuid = file => {
  const entry = ASSETS[file];
  if (!entry) throw new Error('Image not imported: ' + file);
  return entry.uuid + '@f9941';
};

// ---------- build ----------
function build(spec) {
  const b = new Builder(spec.name);
  const rootRect = spec.kind === 'item' || spec.kind === 'cell' ? spec.rect : [0, 0, W, H];
  const local = (rect, parentRect) => ({
    x: rect[0] + rect[2] / 2 - (parentRect[0] + parentRect[2] / 2),
    y: (parentRect[1] + parentRect[3] / 2) - (rect[1] + rect[3] / 2),
    w: rect[2], h: rect[3],
  });
  // A scope is one script component: the view root, or a group with `script` (its own bindings and handlers).
  const newScope = (script, kind, node) => ({ entry: register(script, kind, spec), classId: classIdOf(script), node, values: new Map() });
  const bindTo = (scope, prop, type, id, array) => {
    const known = scope.entry.binds.get(prop);
    if (known && (known.type !== type || known.array !== array)) throw new Error(`${spec.name}: ${scope.entry.cls}.${prop} bound as ${known.type} and ${type}`);
    scope.entry.binds.set(prop, { type, array });
    scope.values.set(prop, [...(scope.values.get(prop) ?? []), id]);
  };
  const fieldsOf = scope => {
    const fields = {};
    for (const [prop, ids] of scope.values) {
      if (scope.entry.binds.get(prop).array) fields[prop] = ids.map(i => ({ __id__: i }));
      else if (ids.length === 1) fields[prop] = { __id__: ids[0] };
      else throw new Error(`${spec.name}: ${scope.entry.cls}.${prop} bound ${ids.length} times`);
    }
    return fields;
  };

  const emit = (n, parent, parentRect, scope) => {
    const o = n.opts ?? {};
    const box = local(n.rect, parentRect);
    if (o.flipX) box.sx = -1;
    if (o.flipY) box.sy = -1;
    const id = b.node(n.name, parent, box, o.active !== false);
    let main = null, mainType = 'Node', inner = scope;
    if (n.kind === 'image') {
      main = b.sprite(id, frameUuid(n.file), NINE_SLICE[n.file] !== undefined, n.opacity, !!o.fill);
      // Full-canvas art (backgrounds) covers screens whose aspect differs from the design.
      if (o.cover !== false && n.rect[0] <= 0 && n.rect[1] <= 0 && n.rect[2] >= W - 1 && n.rect[3] >= H - 1) b.script(id, classIdOf('framework/ui/CoverFit'), {});
      mainType = 'Sprite';
    } else if (n.kind === 'text') {
      main = b.label(id, n.style);
      mainType = 'Label';
      if (n.key) {
        if (I18N[n.key] === undefined) throw new Error(`${spec.name}: missing text key ${n.key} (${n.name})`);
        main = b.script(id, classIdOf(FRAMEWORK.LocalizedLabel), { key: n.key });
        mainType = 'LocalizedLabel';
      }
    } else if (n.kind === 'list') {
      const view = b.node('View', id, { x: 0, y: 0, w: n.rect[2], h: n.rect[3] });
      b.mask(view);
      b.fullWidget(view);
      const content = b.node('Content', view, { x: 0, y: n.rect[3] / 2, w: n.rect[2], h: n.rect[3], ay: 1 });
      const scroll = b.scrollView(id, content);
      const cell = byName.get(n.cell);
      if (!cell) throw new Error(`${spec.name}: unknown cell ${n.cell}`);
      main = b.script(id, classIdOf(FRAMEWORK.ScrollableItemGrid), { scrollView: { __id__: scroll }, content: { __id__: content },
        cellPrefab: external(prefabMeta(prefabFile(cell)), 'cc.Prefab'), columns: o.columns ?? 1, spacingX: o.spacingX ?? 0, spacingY: o.spacingY ?? 12 });
      mainType = 'ScrollableItemGrid';
    } else if (o.graphics) {
      main = b.graphics(id);
      mainType = 'Graphics';
    } else if (o.script) {
      main = b.script(id, classIdOf(o.script), {});
      mainType = path.basename(o.script);
      inner = newScope(o.script, 'component', id);
    }
    if (o.align === 'top') b.widget(id, 1, { top: n.rect[1] - parentRect[1] });
    if (o.align === 'bottom') b.widget(id, 4, { bottom: parentRect[1] + parentRect[3] - (n.rect[1] + n.rect[3]) });
    let button = null;
    if (o.button) {
      if (!BASE_HANDLERS.has(o.button)) inner.entry.handlers.add(o.button);
      button = b.button(id, inner.node, inner.entry.cls, inner.classId, o.button, o.data ?? '');
      b.script(id, classIdOf('framework/audio/ClickSound'), { key: 'click' });
    }
    if (o.bind || o.bindArray) {
      const [prop, type] = Array.isArray(o.bind) ? o.bind : [o.bind ?? o.bindArray, null];
      const want = type ?? mainType;
      const target = want === 'Node' ? id : want === 'Button' ? button : want === mainType ? main
        : want === 'Label' && mainType === 'LocalizedLabel' ? main - 1 : null;
      if (target === null || target === undefined) throw new Error(`${spec.name}: cannot bind ${prop} as ${want} on ${n.name}`);
      bindTo(scope, prop, want, target, !!o.bindArray);
    }
    for (const c of n.children ?? []) emit(c, id, n.rect, inner);
    if (inner !== scope) {
      Object.assign(inner.entry.props, o.props ?? {});
      Object.assign(b.objects[main], fieldsOf(inner), Object.fromEntries(Object.entries(o.props ?? {}).map(([k, v]) => [k, propValue(v)])));
    }
    return id;
  };

  const root = b.node(spec.name, null, { x: 0, y: 0, w: rootRect[2], h: rootRect[3] });
  const scope = newScope(spec.script, spec.kind, root);
  if (spec.kind === 'page' || spec.kind === 'popup') b.fullWidget(root);
  if (spec.kind === 'page') b.opacity(root);
  let parent = root;
  const fixed = {};
  if (spec.kind === 'popup') {
    const backdrop = b.node('Backdrop', root, { x: 0, y: 0, w: W, h: H });
    b.fullWidget(backdrop);
    if (spec.backdropBlocks !== false) b.blockInput(backdrop);
    for (const n of (spec.backdrop ?? []).flatMap(c => resolve(spec, c))) emit(n, backdrop, rootRect, scope);
    const content = b.node('Content', root, { x: 0, y: 0, w: W, h: H });
    fixed.backdrop = { __id__: backdrop };
    fixed.content = { __id__: content };
    parent = content;
  }
  for (const n of (spec.children ?? []).flatMap(c => resolve(spec, c))) emit(n, parent, rootRect, scope);
  Object.assign(scope.entry.props, spec.props ?? {});
  const props = Object.fromEntries(Object.entries(spec.props ?? {}).map(([k, v]) => [k, propValue(v)]));
  b.script(root, scope.classId, { ...fixed, ...fieldsOf(scope), ...props });
  return b;
}

function propValue(value) {
  if (Array.isArray(value)) return value.map(propValue);
  if (value && value.ref === 'prefab') {
    const target = byName.get(value.name);
    if (!target) throw new Error('Unknown prefab ' + value.name);
    return external(prefabMeta(prefabFile(target)), 'cc.Prefab');
  }
  if (value && value.ref === 'frame') return external(frameUuid(value.file), 'cc.SpriteFrame');
  return value;
}

// ---------- view script skeletons / validation ----------
function propType(value) {
  const v = Array.isArray(value) ? value[0] : value;
  const base = v?.ref === 'prefab' ? 'Prefab' : v?.ref === 'frame' ? 'SpriteFrame' : typeof v === 'number' ? 'number' : 'string';
  return { base, array: Array.isArray(value) };
}
function relImport(fromFile, script) {
  const p = toPosix(path.relative(path.dirname(fromFile), path.join(PROJECT, 'assets/scripts', script)));
  return p.startsWith('.') ? p : './' + p;
}
function skeleton(entry) {
  const file = scriptPath(entry.script);
  const cc = new Set(['_decorator']);
  const imports = new Map();
  const importType = type => {
    if (CC_TYPES.has(type)) cc.add(type);
    else if (FRAMEWORK[type]) imports.set(type, relImport(file, FRAMEWORK[type]));
    else {
      const other = [...scripts.values()].find(e => e.cls === type);
      if (!other) throw new Error('Unknown bind type ' + type);
      imports.set(type, relImport(file, other.script));
    }
  };
  const lines = [];
  for (const [prop, { type, array }] of entry.binds) {
    importType(type);
    lines.push(array ? `    @property([${type}]) ${prop}: ${type}[] = [];` : `    @property(${type}) ${prop}: ${type} = null!;`);
  }
  for (const [prop, value] of Object.entries(entry.props)) {
    const { base, array } = propType(value);
    if (base === 'Prefab' || base === 'SpriteFrame') {
      cc.add(base);
      lines.push(array ? `    @property([${base}]) ${prop}: ${base}[] = [];` : `    @property(${base}) ${prop}: ${base} = null!;`);
    } else lines.push(`    @property ${prop} = ${JSON.stringify(value)};`);
  }
  const spec = entry.spec;
  let base, deco = '';
  if (entry.kind === 'page' || entry.kind === 'popup') {
    base = entry.kind === 'popup' ? 'PopupBase' : 'ViewBase';
    imports.set(base, relImport(file, `framework/ui/${base}`));
    imports.set('UILayer, UIQueue', relImport(file, 'framework/ui/UILayer'));
    imports.set('uiView', relImport(file, 'framework/ui/uiView'));
    deco = entry.kind === 'page'
      ? `@uiView({ bundle: '${spec.bundle}', path: '${prefabPath(spec)}', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })\n`
      : `@uiView({ bundle: '${spec.bundle}', path: '${prefabPath(spec)}', layer: UILayer.${spec.layer ?? 'Popup'}, queue: UIQueue.${spec.queue ?? 'Popup'}, transition: '${spec.transition ?? 'scale'}' })\n`;
  } else if (entry.kind === 'cell') {
    base = 'ItemGridCell<unknown>';
    imports.set('ItemGridCell', relImport(file, 'framework/ui/grid/ItemGridCell'));
  } else {
    base = 'Component';
    cc.add('Component');
  }
  const head = [`import { ${[...cc].sort().join(', ')} } from 'cc';`, ...[...imports].map(([n, p]) => `import { ${n} } from '${p}';`)];
  const handlers = [...entry.handlers].map(h => `\n    ${h}(_event: unknown, _data: string): void {\n        throw new Error('${entry.cls}.${h} not implemented');\n    }`);
  const title = entry.kind === 'component' ? `Component on groups of ${spec.name}` : (spec.title ?? spec.name);
  return `${head.join('\n')}\n\nconst { ccclass, property } = _decorator;\n\n/** ${title}. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */\n@ccclass('${entry.cls}')\n${deco}export class ${entry.cls} extends ${base} {\n${lines.join('\n')}\n${handlers.join('\n')}\n}\n`;
}
function validate(entry) {
  const source = fs.readFileSync(scriptPath(entry.script), 'utf8');
  const problems = [];
  if (!source.includes(`@ccclass('${entry.cls}')`)) problems.push(`missing @ccclass('${entry.cls}')`);
  for (const prop of [...entry.binds.keys(), ...Object.keys(entry.props)]) {
    if (!new RegExp(`@property[^\\n]*\\b${prop}\\b`).test(source)) problems.push('missing @property ' + prop);
  }
  for (const h of entry.handlers) if (!new RegExp(`\\b${h}\\s*\\(`).test(source)) problems.push('missing handler ' + h);
  return problems.map(p => `${entry.script}: ${p}`);
}

// ---------- doc ----------
function describe(n, prefix, last, out) {
  const o = n.opts ?? {};
  const short = f => path.basename(f, '.png').replace(/_[0-9a-f]{10}$/, '');
  const what = n.kind === 'image' ? `Sprite(${short(n.file)})`
    : n.kind === 'text' ? (n.key ? `Label「${n.sample ?? I18N[n.key]}」 key=${n.key}${paramsOf(n.key).length ? ` 参数{${paramsOf(n.key).join(',')}}` : ''}` : `Label「${n.style.text}」`)
    : n.kind === 'list' ? `List → ${n.cell}（ScrollableItemGrid，动态）`
    : o.graphics ? 'Graphics' : n.kind === 'slot' ? (o.script ? `Slot [${path.basename(o.script)}]` : 'Slot') : o.script ? `[${path.basename(o.script)}]` : '';
  const tags = [what, o.button && `→ ${o.button}${o.data ? `(${o.data})` : ''}`, (o.bind || o.bindArray) && `@${[].concat(o.bind ?? o.bindArray)[0]}${o.bindArray ? '[]' : ''}`,
    o.active === false && '默认隐藏', o.align && `Widget:${o.align}`, (o.flipX || o.flipY) && '翻转', o.fill && '横向填充',
    o.props && `属性:${Object.keys(o.props).join(',')}`, o.note].filter(Boolean).join('  ');
  out.push(`${prefix}${last ? '└─' : '├─'} ${n.name}  ${tags}`);
  const kids = n.children ?? [];
  // Consecutive scripted siblings with the same structure (rows, cells, level nodes) print once.
  const runs = [];
  for (const c of kids) {
    const prev = runs[runs.length - 1];
    if (prev && c.opts?.script && shape(c) === shape(prev[0])) prev.push(c);
    else runs.push([c]);
  }
  runs.forEach((run, i) => {
    const childPrefix = prefix + (last ? '   ' : '│  ');
    const lastRun = i === runs.length - 1;
    if (run.length === 1) return describe(run[0], childPrefix, lastRun, out);
    describe(run[0], childPrefix, false, out);
    out.push(`${childPrefix}${lastRun ? '└─' : '├─'} ${run[1].name} … ${run[run.length - 1].name}  同 ${run[0].name} 结构（共 ${run.length} 个）`);
  });
}
/** Structure signature ignoring names, rects and sample text. */
function shape(n) {
  const o = n.opts ?? {};
  return JSON.stringify([n.kind, n.file, n.key, o.script, o.button, o.bind, o.bindArray, o.active, (n.children ?? []).map(shape)]);
}
function docFor(spec) {
  const out = [];
  const d = spec.doc ?? {};
  const base = spec.kind === 'popup' ? 'PopupBase' : spec.kind === 'page' ? 'ViewBase' : spec.kind === 'cell' ? 'ItemGridCell' : 'Component';
  out.push(`### ${spec.name}`, '');
  if (spec.title) out.push(`${spec.title}`, '');
  out.push(`- 文件：\`${toPosix(path.relative(PROJECT, prefabFile(spec)))}\``);
  out.push(`- 脚本：\`assets/scripts/${spec.script}.ts\`（${path.basename(spec.script)} extends ${base}）${d.args ? '　参数：' + d.args : ''}`);
  out.push(`- 来源：${[spec.source, ...(d.sources ?? [])].filter(Boolean).join('、') || '—'}${d.features ? '　功能：' + d.features : ''}`);
  if (d.dynamic) out.push(`- 动态内容：${d.dynamic}`);
  if (d.states) out.push(`- 状态节点：${d.states}`);
  if (d.fx) out.push(`- 动效（延后）：${d.fx}`);
  if (spec.props) out.push(`- 资源属性：${Object.entries(spec.props).map(([k, v]) => `${k}=${[].concat(v).map(x => x.ref === 'prefab' ? x.name : x.ref === 'frame' ? path.basename(x.file, '.png') : JSON.stringify(x)).join('/')}`).join('；')}`);
  out.push('', '```');
  const rootRect = spec.kind === 'item' || spec.kind === 'cell' ? spec.rect : [0, 0, W, H];
  out.push(`${spec.name}  [${path.basename(spec.script)}]`);
  const tops = [];
  if (spec.kind === 'popup') {
    tops.push({ name: 'Backdrop', kind: 'group', rect: rootRect, opts: { bind: 'backdrop', note: spec.backdropBlocks === false ? '不拦截输入' : 'BlockInputEvents' }, children: (spec.backdrop ?? []).flatMap(c => resolve(spec, c)) });
    tops.push({ name: 'Content', kind: 'group', rect: rootRect, opts: { bind: 'content' }, children: (spec.children ?? []).flatMap(c => resolve(spec, c)) });
  } else tops.push(...(spec.children ?? []).flatMap(c => resolve(spec, c)));
  tops.forEach((n, i) => describe(n, '', i === tops.length - 1, out));
  out.push('```', '');
  return out.join('\n');
}

// ---------- missing design report ----------
const GAPS_DOC = path.join(PROJECT, 'docs/开发方案/缺少美术设计.md');
function gapsFor(spec) {
  const out = { texts: [], images: [], moved: [] };
  const visit = (n, trail) => {
    const p = trail ? trail + '/' + n.name : n.name;
    const o = n.opts ?? {};
    if (n.designless) out.texts.push(`| ${spec.name} | ${p} | ${n.key ? `${n.key}「${(I18N[n.key] ?? '').replace(/\n/g, ' ')}」` : `数值「${n.style.text}」`} | ${o.note ?? ''} |`);
    if (n.devPlaced) out.images.push({ asset: path.basename(n.file, '.png').replace(/_[0-9a-f]{10}$/, ''), where: `${spec.name} ${p.split('/').slice(-2).join('/')}`, note: o.note ?? '' });
    if (!n.devPlaced && !n.designless && o.rect && (n.kind === 'image' || n.kind === 'text')) out.moved.push(`| ${spec.name} | ${p} | ${o.note ?? ''} |`);
    for (const c of n.children ?? []) visit(c, p);
  };
  for (const n of [...(spec.backdrop ?? []), ...(spec.children ?? [])].flatMap(c => resolve(spec, c))) visit(n, '');
  return out;
}
function imageRows(images) {
  const by = new Map();
  for (const i of images) by.set(i.asset, [...(by.get(i.asset) ?? []), i]);
  return [...by].sort((x, y) => y[1].length - x[1].length).map(([asset, list]) => {
    const where = [...new Set(list.map(i => i.where))];
    const notes = [...new Set(list.map(i => i.note).filter(Boolean))];
    return `| ${asset} | ${list.length} | ${where.slice(0, 4).join('、')}${where.length > 4 ? ' …' : ''} | ${notes.join('；')} |`;
  });
}

function writeGaps() {
  const all = { texts: [], images: [], moved: [] };
  for (const spec of specs) { const g = gapsFor(spec); for (const k of Object.keys(all)) all[k].push(...g[k]); }
  const auto = `<!-- auto:start 以下由 node tools/ui-gen/gen.mjs 生成，不要手改 -->

## A. 设计图没有、开发补的文字（${all.texts.length} 处）

统一用占位样式：白字黑描边，字号按所在位置估计。

| Prefab | 节点 | 文案 | 备注 |
|---|---|---|---|
${all.texts.join('\n')}

## B. 由开发摆放的图片（${imageRows(all.images).length} 种素材，${all.images.length} 处）

设计图里没有这个位置，或同一素材被开发复制到其他状态、格子上。R- 开头是补充美术，位置由开发定。

| 素材 | 次数 | 位置（示例） | 备注 |
|---|---|---|---|
${imageRows(all.images).join('\n')}

## C. 取自设计图、但位置或尺寸由开发改过的节点（${all.moved.length} 处）

| Prefab | 节点 | 备注 |
|---|---|---|
${all.moved.join('\n')}

<!-- auto:end -->`;
  const old = fs.existsSync(GAPS_DOC) ? fs.readFileSync(GAPS_DOC, 'utf8') : '';
  const i = old.indexOf('<!-- auto:start'), j = old.indexOf('<!-- auto:end -->');
  if (i < 0 || j < 0) throw new Error('缺少美术设计.md needs the auto markers');
  writeFile(GAPS_DOC, old.slice(0, i) + auto + old.slice(j + '<!-- auto:end -->'.length));
}

// ---------- run ----------
const problems = [];
const sections = new Map();
for (const spec of specs) {
  const group = spec.group ?? spec.bundle;
  sections.set(group, [...(sections.get(group) ?? []), docFor(spec)]);
  if (only && !only.has(spec.name)) continue;
  if (spec.bundle !== 'resources') directory(path.join(PROJECT, 'assets/bundles', spec.bundle), spec.bundle);
  const builder = build(spec);
  prefabMeta(prefabFile(spec));
  if (writePrefabs) builder.write(prefabFile(spec));
}
for (const entry of scripts.values()) {
  const file = scriptPath(entry.script);
  if (!fs.existsSync(file)) {
    const text = skeleton(entry);
    if (writePrefabs) {
      writeFile(file, text);
      console.log('skeleton', entry.script);
    }
  } else problems.push(...validate(entry));
  scriptMeta(file);
}

const order = ['resources', 'common', 'puzzle', 'garden', 'endless', 'meta', 'gm'];
const groups = [...sections.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));
const header = `# Prefab 结构

由 \`tools/ui-gen\` 根据 \`tools/ui-gen/specs/\` 生成，与 Prefab 同源；**不要手改本文**，改 spec 后运行 \`node tools/ui-gen/gen.mjs --doc\`。

读法：
- 树中每行是一个节点。\`Sprite(…)\` 为图片（arts 文件名）；\`Label「示例」 key=…\` 为本地化文字（运行时按 key 显示，示例仅供对照）；无 key 的 Label 为数值文字。
- \`[Xxx]\` 为挂在该节点上的组件脚本（行、卡片、HUD 等重复单元），其内部的 \`@prop\` 和按钮属于该组件。
- \`→ onX\` 为 Prefab 中绑定的按钮事件；\`@prop\` 为脚本的 \`@property\` 绑定（\`[]\` 为数组）。
- \`Widget:top/bottom\` 为贴边适配；\`默认隐藏\` 为状态节点；\`List → Cell\` 为动态列表（ScrollableItemGrid）。
- 坐标与尺寸取自页面配置（853×1844），文档中不列出。

共 ${specs.length} 个 Prefab。

`;
const toc = groups.map(g => `- [${g}](#${g})：${sections.get(g).length} 个`).join('\n');
if (!onlyDir) writeGaps();
writeFile(onlyDir ? path.join(PROJECT, '../tmp/hexa-dev', `doc-${onlyDir}.md`) : DOC, header + toc + '\n\n' + groups.map(g => `## ${g}\n\n${sections.get(g).join('\n')}`).join('\n'));
console.log(`${specs.length} specs; doc written${writePrefabs ? '; prefabs written' : ''}`);
if (problems.length) {
  console.log('Script mismatches:\n  ' + problems.join('\n  '));
  process.exitCode = 1;
}
