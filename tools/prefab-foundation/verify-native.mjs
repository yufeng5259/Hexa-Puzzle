import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { PROJECT, SCRATCH } from './io.mjs';

// Use the existing single Creator preview. This verifier never starts another editor,
// changes a scene/asset, clears caches, or substitutes mocked engine modules.
const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_PATH
  || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const { chromium } = require(playwrightPath);
const output = path.join(SCRATCH, 'native');
const preview = process.env.COCOS_PREVIEW_URL || 'http://127.0.0.1:7456/';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const registryFile = path.join(PROJECT, 'assets/resources/framework/config/prefab-registry.json');
const artFile = path.join(PROJECT, 'assets/resources/framework/config/source-art-manifest.json');
fs.mkdirSync(output, { recursive: true });
const report = {
  createdAt: new Date().toISOString(), status: 'RUNNING', preview,
  scope: 'Real Creator 3.8.8 preview: all registered Prefabs loaded/instantiated/activated; bindings, native virtual list, lifecycle, and two viewport screenshots. Business logic remains outside this foundation acceptance.',
  errors: [], warnings: [], failedResources: [], screenshots: [],
};
let browser;
try {
  if (!fs.existsSync(registryFile)) throw new Error('Prefab registry is not generated yet. Generate the authorized foundation first.');
  const registry = read(registryFile), art = read(artFile);
  const mainSceneUuid = read(path.join(PROJECT, 'assets/scenes/Main.scene.meta')).uuid;
  if (!Array.isArray(registry.prefabs) || registry.prefabs.length !== 82) throw new Error('Expected exactly 80 production and 2 developer Prefabs.');
  const refresh = await fetch(new URL('asset-db/refresh', preview));
  report.refresh = { status: refresh.status, response: (await refresh.text()).slice(0, 1000) };
  if (!refresh.ok) throw new Error('The existing Creator AssetDB refresh failed.');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await page.exposeFunction('__foundationProgress', progress => {
    report.progress = progress;
    fs.writeFileSync(path.join(output, 'progress.json'), JSON.stringify(progress, null, 2) + '\n');
    if (progress.phase !== 'load-prefab' || progress.index % 10 === 0) console.log(JSON.stringify(progress));
  });
  const rememberError = message => { report.errorCount = (report.errorCount || 0) + 1; if (!report.errors.includes(message)) report.errors.push(message); };
  page.on('pageerror', error => rememberError(String(error.stack || error)));
  page.on('console', message => {
    if (message.type() === 'error') rememberError(message.text());
    else if (message.type() === 'warning') report.warnings.push(message.text());
  });
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) report.failedResources.push({ status: response.status(), url: response.url() });
  });
  const response = await page.goto(preview, { waitUntil: 'domcontentloaded', timeout: 60000 });
  report.httpStatus = response?.status();
  await page.waitForFunction(() => typeof System !== 'undefined', null, { timeout: 60000 });
  await page.waitForFunction(async () => {
    const cc = await System.import('cc');
    return !!cc.director.root && !!cc.director.getScene();
  }, null, { timeout: 60000 });
  // Native preview device menu is the supported route to the responsive full-window frame.
  const deviceMenu = page.locator('#view-select');
  if (await deviceMenu.count()) {
    await deviceMenu.click();
    const fullScreen = page.locator('[data-device="FullScreen"]');
    if (await fullScreen.count()) await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null),
      fullScreen.click(),
    ]);
  }
  // The open editor may still preview its archived scene. Load the generated Main
  // explicitly, retaining startup evidence separately instead of masking it.
  report.initialPreview = { errors: report.errors.splice(0), errorCount: report.errorCount || 0, failedResources: report.failedResources.splice(0) };
  report.errorCount = 0;
  report.mainScene = await page.evaluate(async ({ uuid }) => {
    const cc = await System.import('cc');
    const previous = cc.director.getScene()?.name;
    const defaultBoot = cc.director.getScene()?.getComponentsInChildren(cc.Component).find(component => cc.js.getClassName(component) === 'FoundationBoot');
    const asset = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Main.scene load timed out')), 30000);
      cc.assetManager.loadAny(uuid, { preset: 'scene', reloadAsset: true }, (error, value) => { clearTimeout(timer); error ? reject(error) : resolve(value); });
    });
    if (!(asset instanceof cc.SceneAsset)) throw new Error('Main.scene UUID did not load a SceneAsset');
    if (cc.director.getScene() === asset.scene) throw new Error('Scene reload returned the currently active scene instance');
    cc.director.runSceneImmediate(asset.scene);
    const sceneNodes = [], collect = node => { sceneNodes.push(node); node.children.forEach(collect); };
    collect(cc.director.getScene());
    if (new Set(sceneNodes.map(node => node.uuid)).size !== sceneNodes.length) throw new Error('Main hierarchy contains duplicate node UUIDs after native scene activation');
    if (cc.director.getScene().uuid !== asset._uuid) throw new Error('Main Scene does not own its asset UUID');
    return { previous, loadedUuid: asset._uuid, name: cc.director.getScene().name, explicitSceneActivation: true, defaultFoundationBoot: !!defaultBoot, uniqueHierarchyIds: sceneNodes.length };
  }, { uuid: mainSceneUuid });
  report.defaultStartup = {
    status: report.mainScene.defaultFoundationBoot && !report.initialPreview.errorCount && !report.initialPreview.failedResources.length ? 'PASS_DEFAULT_MAIN' : 'EDITOR_PREVIEW_REQUIRED_EXPLICIT_MAIN',
    note: 'Fresh browser navigation to the existing 7457 preview before any explicit scene activation; editor memory is never altered by this verifier.',
  };
  await page.waitForFunction(async () => {
    if (typeof System === 'undefined') return false;
    const cc = await System.import('cc');
    return !!cc.director.getScene()?.getComponentsInChildren(cc.Component).find(component => (cc.js.getClassName(component) === 'FoundationBoot' || component.constructor.name === 'FoundationBoot') && component.ready && !component.disposed && component.store && component.registry);
  }, null, { timeout: 60000 });
  report.sceneRestarts = await page.evaluate(async ({ uuid }) => {
    const cc = await System.import('cc');
    const rows = [];
    const frame = () => new Promise(resolve => cc.director.once(cc.Director.EVENT_AFTER_DRAW, resolve));
    const boot = () => cc.director.getScene().getComponentsInChildren(cc.Component).find(component => cc.js.getClassName(component) === 'FoundationBoot');
    for (let iteration = 0; iteration < 2; iteration++) {
      const previousBoot = boot(), previousHost = previousBoot.host;
      const asset = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Main restart load timed out')), 30000);
        cc.assetManager.loadAny(uuid, { preset: 'scene', reloadAsset: true }, (error, value) => { clearTimeout(timer); error ? reject(error) : resolve(value); });
      });
      if (asset.scene === cc.director.getScene()) throw new Error('Main restart returned the active scene');
      cc.director.runSceneImmediate(asset.scene);
      const deadline = performance.now() + 30000;
      while (!(boot()?.ready && boot()?.currentView && !boot()?.disposed)) {
        if (performance.now() > deadline) throw new Error('FoundationBoot did not restart');
        await frame();
      }
      await frame(); await frame();
      if (cc.isValid(previousBoot, true) || cc.isValid(previousHost, true)) throw new Error('Old Main components survived scene replacement');
      // Public closure stays idempotent even after native component destructors ran.
      previousHost.closeAll();
      rows.push({ iteration: iteration + 1, sceneUuid: asset._uuid, previousBootDestroyed: true, previousHostDestroyed: true, ready: boot().ready });
    }
    return rows;
  }, { uuid: mainSceneUuid });
  report.native = await page.evaluate(async ({ registry, art, resourceLoaderUri }) => {
    const cc = await System.import('cc');
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const bounded = (promise, label, milliseconds = 30000) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Native operation timed out: ' + label)), milliseconds);
      promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
    });
    const frames = async (count = 2) => {
      for (let i = 0; i < count; i++) await bounded(new Promise(resolve => cc.director.once(cc.Director.EVENT_AFTER_DRAW, resolve)), 'render frame', 10000);
    };
    const scene = cc.director.getScene();
    const canvas = scene.getComponentInChildren(cc.Canvas)?.node;
    check(canvas, 'Main.scene must contain a real Canvas');
    const loadBundle = name => bounded(name === 'resources' ? Promise.resolve(cc.resources)
      : Promise.resolve(cc.assetManager.getBundle(name)).then(existing => existing || new Promise((resolve, reject) => cc.assetManager.loadBundle(name, (error, bundle) => error ? reject(error) : resolve(bundle)))), 'bundle ' + name);
    const load = (bundle, resource, type) => bounded(new Promise((resolve, reject) => bundle.load(resource, type, (error, asset) => error ? reject(error) : resolve(asset))), bundle.name + ':' + resource);
    const locate = record => {
      const assetPath = record.assetPath || record.path || '';
      if (assetPath.startsWith('assets/resources/')) return { bundle: 'resources', path: assetPath.slice('assets/resources/'.length).replace(/\.(prefab|png|json)$/, '') + (assetPath.endsWith('.png') ? '/spriteFrame' : '') };
      if (record.bundle === 'boot') return { bundle: 'resources', path: 'boot/' + record.resourcePath };
      return { bundle: record.bundle, path: record.resourcePath };
    };
    const flatten = root => [root, ...root.children.flatMap(flatten)];
    const componentName = component => cc.js.getClassName(component) || component.constructor.name;
    const clickButton = button => {
      button.node.emit(cc.Node.EventType.TOUCH_START, new cc.EventTouch([], true, cc.Node.EventType.TOUCH_START));
      button.node.emit(cc.Node.EventType.TOUCH_END, new cc.EventTouch([], true, cc.Node.EventType.TOUCH_END));
    };
    const verifyTree = root => {
      const nodes = flatten(root), validated = []; let buttons = 0, buttonHandlers = 0;
      for (const node of nodes) {
        check(!/^(VisualRoot|DynamicRoot)$/.test(node.name), `Redundant generated wrapper: ${node.name}`);
        for (const component of node.getComponents(cc.Component)) {
          check(component && !/MissingScript/.test(componentName(component)), `MissingScript on ${node.name}`);
          check(componentName(component) !== 'SourceLayout', `Runtime source layout remains on ${node.name}`);
          if (typeof component.validateBindings === 'function') { component.validateBindings(); validated.push(componentName(component)); }
        }
        const scroll = node.getComponent(cc.ScrollView);
        if (scroll) {
          check(scroll.content && scroll.content.parent, `ScrollView has no content/viewport: ${node.name}`);
          check(scroll.content.parent.getComponent(cc.Mask), `ScrollView viewport lacks Mask: ${node.name}`);
        }
        const button = node.getComponent(cc.Button);
        if (button) {
          buttons++;
          check(button.clickEvents.length > 0, `Button has no serialized click event: ${node.name}`);
          for (const handler of button.clickEvents) {
            check(handler.target && cc.isValid(handler.target, true), `Button handler target is missing: ${node.name}`);
            const type = handler.component ? cc.js.getClassByName(handler.component) : cc.js.getClassById(handler._componentId);
            check(type, `Button handler component is not registered: ${node.name}`);
            const component = handler.target.getComponent(type);
            check(component && typeof component[handler.handler] === 'function', `Button handler method is missing: ${node.name}.${handler.handler}`);
            buttonHandlers++;
          }
        }
      }
      return { nodeCount: nodes.length, validated, buttons, buttonHandlers };
    };
    const results = { engineVersion: cc.VERSION, prefabCount: 0, prefabs: [], bundles: [], artSamples: [], resourceScopes: null, virtualList: null };
    const bundles = new Map();
    // Shared dependencies must be available before feature bundles.
    for (const name of ['resources', 'common']) {
      if (name === 'common' && !registry.prefabs.some(item => locate(item).bundle === name) && !art.records.some(item => locate(item).bundle === name)) continue;
      bundles.set(name, await loadBundle(name)); results.bundles.push(name);
    }
    const getBundle = async name => {
      if (!bundles.has(name)) { bundles.set(name, await loadBundle(name)); results.bundles.push(name); }
      return bundles.get(name);
    };
    for (const item of registry.prefabs) {
      await globalThis.__foundationProgress({ phase: 'load-prefab', index: results.prefabs.length, id: item.id });
      const location = locate(item), bundle = await getBundle(location.bundle);
      const asset = await load(bundle, location.path, cc.Prefab);
      check(asset._uuid === item.uuid, `Prefab UUID differs: ${item.id}`);
      asset.addRef();
      let root;
      try {
        root = cc.instantiate(asset); root.active = false;
        const summary = verifyTree(root);
        if (item.stateIds.length <= 1) {
          const view = root.getComponents(cc.Component).find(component => typeof component.validateBindings === 'function' && typeof component.show === 'function');
          if (view) check(!('stateRoots' in view) && !('stateIds' in view), `Single-layout view retains state arrays: ${item.id}`);
        }
        // Every Prefab enters the real Canvas hierarchy, exercising onLoad/onEnable.
        root.parent = canvas; root.active = true; await frames();
        const activated = verifyTree(root);
        if (item.id === 'loading') {
          const loading = root.getComponents(cc.Component).find(component => componentName(component) === 'LoadingPageView');
          check(loading && typeof loading.setProgress === 'function', 'Loading progress entry is missing');
          check(loading.progressBar instanceof cc.ProgressBar && loading.progressLabel instanceof cc.Label, 'Loading has invalid typed progress bindings');
          for (const value of [0, .5, 1]) {
            loading.setProgress(value); await frames(1);
            check(loading.progressBar.progress === value && loading.progressLabel.string === Math.round(value * 100) + '%', 'Loading progress bar and percentage disagree');
          }
          const bar = loading.progressBar;
          loading.progressBar = null;
          let rejectedMissingBar = false;
          try { loading.validateBindings(); } catch { rejectedMissingBar = true; }
          finally { loading.progressBar = bar; }
          check(rejectedMissingBar, 'Loading must reject a missing progress bar binding');
          loading.setProgress(0);
          activated.loadingProgress = { values: [0, .5, 1], missingBindingRejected: true };
        }
        if (item.id === 'mainline-map') {
          const map = root.getComponents(cc.Component).find(component => componentName(component) === 'MainlineMapPageView');
          check(map && typeof map.render === 'function', 'Map render entry is missing');
          check(componentName(map.presentation) === 'MainlineMapPresentation' && map.presentation.node === root, 'Map presentation must be explicitly bound on the page root');
          const layout = map.presentation.layout;
          check(componentName(layout) === 'CorePresentation' && layout.node === root && layout.itemMounts.length === 8, 'Map must keep eight real level mounts on its root presentation');
          for (const node of flatten(root)) {
            check(!/^(VisualRoot|DynamicRoot)$/.test(node.name), 'Map retains a generated wrapper');
            check(!/^关卡\d+(底板|星\d|号码)$/.test(node.name), 'Map retains a redundant source level node');
            check(node.getComponents(cc.Component).every(component => !['SourceLayout', 'PresentationGroup'].includes(componentName(component))), 'Map retains generated layout dispatch');
          }
          activated.mapStructure = { levelMounts: 8, explicitPresentation: true, generatedWrappers: 0 };
        }
        const actionButton = root.getComponentsInChildren(cc.Button).find(button => button.enabledInHierarchy && button.node.activeInHierarchy && button.clickEvents.some(handler => handler.handler === 'onAction'));
        let actionEvent = null;
        if (actionButton) {
          const handler = actionButton.clickEvents.find(event => event.handler === 'onAction');
          handler.target.once('view-action', payload => { actionEvent = { actionId: payload.actionId, owner: componentName(payload.view) }; });
          clickButton(actionButton);
          check(actionEvent && actionEvent.actionId === handler.customEventData, `Serialized onAction did not emit view-action: ${item.id}`);
        }
        root.active = false; await frames(1); root.active = true; await frames(1);
        results.prefabs.push({ id: item.id, category: item.category, uuid: asset._uuid, ...summary, activatedBindings: activated.validated, ...(activated.loadingProgress ? { loadingProgress: activated.loadingProgress } : {}), ...(activated.mapStructure ? { mapStructure: activated.mapStructure } : {}), actionEvent });
      } finally {
        if (root) root.destroy(); await frames(); asset.decRef();
      }
    }
    results.prefabCount = results.prefabs.length;
    await globalThis.__foundationProgress({ phase: 'all-prefabs-activated', count: results.prefabCount });
    check(results.prefabCount === 82, 'Not every registered Prefab was instantiated');
    await globalThis.__foundationProgress({ phase: 'native-resource-ownership' });
    const { ResourceLoader } = await System.import(resourceLoaderUri);
    const ownershipRecord = registry.prefabs.find(item => item.id === 'loading');
    const ownershipLocation = locate(ownershipRecord);
    const ownershipAsset = await load(await getBundle(ownershipLocation.bundle), ownershipLocation.path, cc.Prefab);
    const baseline = ownershipAsset.refCount;
    const ownershipLoader = new ResourceLoader([{ id: 'native-scope-check', bundle: ownershipLocation.bundle, path: ownershipLocation.path, type: cc.Prefab, uuid: ownershipRecord.uuid }]);
    const firstScope = ownershipLoader.createScope(), secondScope = ownershipLoader.createScope();
    const firstPromise = firstScope.load('native-scope-check', cc.Prefab);
    check(firstPromise === firstScope.load('native-scope-check', cc.Prefab), 'Same native scope duplicated its request');
    const [firstOwned, secondOwned] = await Promise.all([firstPromise, secondScope.load('native-scope-check', cc.Prefab)]);
    check(firstOwned === secondOwned && firstOwned.refCount === baseline + 2, 'Native scopes do not hold one ref each');
    const ownedRoot = cc.instantiate(firstOwned); ownedRoot.active = false;
    const ownedView = ownedRoot.getComponents(cc.Component).find(component => typeof component.attachResourceScope === 'function');
    check(ownedView, 'Loading Prefab has no BaseView resource owner');
    ownedView.attachResourceScope(firstScope); ownedRoot.parent = canvas; ownedRoot.active = true; await frames();
    ownedView.hide(); ownedView.show(); ownedRoot.destroy(); await frames(3);
    check(firstScope.isReleased && firstOwned.refCount === baseline + 1, 'Destroying a view did not release exactly its resource scope');
    secondScope.release(); secondScope.release();
    check(firstOwned.refCount === baseline, 'Resource scope release is not balanced/idempotent');
    results.resourceScopes = { status: 'PASS_NATIVE_RESOURCE_OWNERSHIP', baseline, sharedRefs: baseline + 2, afterDestroy: baseline + 1, afterRelease: firstOwned.refCount };
    const sampledBundles = new Set();
    for (const record of art.records) {
      const location = locate(record);
      if (sampledBundles.has(location.bundle)) continue;
      sampledBundles.add(location.bundle);
      const frame = await load(await getBundle(location.bundle), location.path, cc.SpriteFrame);
      check(frame._uuid === record.spriteFrameUuid, `SpriteFrame UUID differs: ${record.id}`);
      check(frame.originalSize.width === record.size[0] && frame.originalSize.height === record.size[1], `SpriteFrame size differs: ${record.id}`);
      results.artSamples.push({ id: record.id, uuid: frame._uuid, bundle: location.bundle, width: frame.originalSize.width, height: frame.originalSize.height });
    }
    const listRecord = registry.prefabs.find(item => item.id === 'virtual-list');
    await globalThis.__foundationProgress({ phase: 'native-virtual-list' });
    check(listRecord, 'VirtualList Prefab is absent from registry');
    const listLocation = locate(listRecord);
    const listAsset = await load(await getBundle(listLocation.bundle), listLocation.path, cc.Prefab);
    listAsset.addRef();
    const listRoot = cc.instantiate(listAsset); listRoot.active = false;
    let list;
    try {
      list = listRoot.getComponentsInChildren(cc.Component).find(component => componentName(component) === 'VirtualList' && typeof component.setData === 'function');
      check(list, 'VirtualList root has no real VirtualList component');
      for (const widget of listRoot.getComponentsInChildren(cc.Widget)) widget.enabled = false;
      listRoot.getComponent(cc.UITransform)?.setContentSize(300, 450);
      list.viewport.getComponent(cc.UITransform).setContentSize(300, 450);
      list.viewport.setPosition(-150, 225, 0);
      listRoot.parent = canvas; listRoot.active = true; await frames();
      const snapshots = [];
      const items = () => list.content.children.filter(node => node.active).map(node => node.getComponents(cc.Component).find(component => typeof component.onItemClicked === 'function' && typeof component.bind === 'function')).filter(Boolean);
      const clickBoundItem = item => {
        const button = item.node.getComponentsInChildren(cc.Button).find(candidate => candidate.clickEvents.some(handler => handler.handler === 'onItemClicked'));
        check(button, 'Item Button.clickEvents does not serialize onItemClicked');
        // Exercise the real Button touch listeners and serialized EventHandlers.
        // Calling VirtualListItem.onItemClicked directly would miss broken binding.
        clickButton(button);
      };
      const capture = label => { const active = items(); const snapshot = { label, active: list.activeItemCount, retained: list.retainedItemCount, indexes: active.map(item => item.index).sort((a, b) => a - b) }; snapshots.push(snapshot); return snapshot; };
      list.setData([]); await frames(); check(capture('empty').active === 0, 'Empty list retained visible items');
      list.setData([{ title: 'single', selected: true }]); await frames();
      check(capture('single').active === 1, 'Single item list did not render one item');
      const values = Array.from({ length: 1000 }, (_, index) => ({ title: 'Row ' + index, selected: index === 0 }));
      let selected = null;
      list.setData(values, (index, value) => { selected = { index, title: value.title }; }); await frames();
      const large = capture('1000'); check(large.active > 0 && large.retained < 30, 'Virtual list instantiated too many nodes');
      for (const index of [999, 1, 550, 3, 998]) { list.jumpTo(index); await frames(1); }
      const jumped = capture('rapid-jumps'); check(jumped.indexes.some(index => index >= 990), 'Jump near end showed the wrong items');
      clickBoundItem(items()[0]); check(selected && selected.index >= 990, 'Serialized Button event did not use the current bound data');
      list.setData([{ title: 'replacement' }]); await frames();
      const replacement = items()[0]; clickBoundItem(replacement);
      check(selected.index >= 990, 'Item retained a previous callback after rebinding');
      if (replacement.selectedMarker) check(!replacement.selectedMarker.active, 'Item retained the previous selection state');
      capture('rebound-single');
      listRoot.active = false; await frames(1); listRoot.active = true; await frames(1);
      list.horizontal = true; list.validateBindings();
      list.viewport.getComponent(cc.UITransform).setContentSize(360, 260);
      list.setData(values); list.jumpTo(500); await frames();
      check(capture('horizontal').indexes.includes(500), 'Horizontal list did not reach the target');
      const beforeResize = list.activeItemCount;
      list.viewport.getComponent(cc.UITransform).setContentSize(900, 260); await frames();
      const resized = capture('resized'); check(resized.active > beforeResize, 'Viewport resize did not expand the visible range');
      list.setData([]); await frames(); check(capture('cleared').active === 0 && list.retainedItemCount <= 1, 'Clear did not recycle excess items');
      const prefab = list.itemPrefab; list.itemPrefab = null;
      let missingBinding = '';
      try { list.validateBindings(); } catch (error) { missingBinding = error.message; }
      finally { list.itemPrefab = prefab; }
      check(/itemPrefab/.test(missingBinding), 'Missing itemPrefab did not fail with an explicit binding error');
      list.setData(values); await frames(); capture('before-parent-destroy');
      results.virtualList = { status: 'PASS_NATIVE_LIST', missingBinding, snapshots, selected };
    } finally { listRoot.destroy(); await frames(); listAsset.decRef(); }
    return results;
  }, { registry, art, resourceLoaderUri: pathToFileURL(path.join(PROJECT, 'assets/scripts/framework/resources/ResourceLoader.ts')).href });

  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    for (const id of ['loading', 'mainline-map', 'garden', 'puzzle', 'settings', 'mail-detail', 'virtual-list']) {
      if (!registry.prefabs.some(item => item.id === id)) throw new Error('Screenshot Prefab is absent: ' + id);
      const presentation = await page.evaluate(async ({ id }) => {
        const cc = await System.import('cc');
        const boot = cc.director.getScene().getComponentsInChildren(cc.Component).find(component => cc.js.getClassName(component) === 'FoundationBoot' || component.constructor.name === 'FoundationBoot');
        if (!boot || typeof boot.preview !== 'function') throw new Error('FoundationBoot.preview is unavailable');
        await Promise.race([boot.preview(id), new Promise((_resolve, reject) => setTimeout(() => reject(new Error('Preview timed out: ' + id)), 30000))]);
        for (let i = 0; i < 3; i++) await new Promise(resolve => cc.director.once(cc.Director.EVENT_AFTER_DRAW, resolve));
        const view = id === 'virtual-list' ? boot.sampleNode : boot.currentView;
        if (!view) throw new Error('FoundationBoot.preview did not mount ' + id);
        let listViewport = null;
        if (id === 'virtual-list') {
          const root = view.node || view;
          const list = root.getComponentsInChildren(cc.Component).find(component => cc.js.getClassName(component) === 'VirtualList' && typeof component.setData === 'function');
          if (list) {
            list.setData(Array.from({ length: 1000 }, (_, index) => ({ title: '展示项 ' + (index + 1) })));
            await new Promise(resolve => cc.director.once(cc.Director.EVENT_AFTER_DRAW, resolve));
            const ownBounds = transform => {
              // getBoundingBoxToWorld includes active children, including scroll
              // content beyond the Mask. Compute the actual Mask's four corners.
              const left = -transform.anchorX * transform.width, bottom = -transform.anchorY * transform.height;
              const corners = [[left, bottom], [left + transform.width, bottom], [left, bottom + transform.height], [left + transform.width, bottom + transform.height]]
                .map(([x, y]) => transform.convertToWorldSpaceAR(new cc.Vec3(x, y, 0)));
              const minX = Math.min(...corners.map(point => point.x)), minY = Math.min(...corners.map(point => point.y));
              return { x: minX, y: minY, width: Math.max(...corners.map(point => point.x)) - minX, height: Math.max(...corners.map(point => point.y)) - minY };
            };
            const bounds = ownBounds(list.viewport.getComponent(cc.UITransform));
            const canvasBounds = ownBounds(cc.director.getScene().getComponentInChildren(cc.Canvas).getComponent(cc.UITransform));
            if (bounds.x < canvasBounds.x - 1 || bounds.y < canvasBounds.y - 1 || bounds.x + bounds.width > canvasBounds.x + canvasBounds.width + 1 || bounds.y + bounds.height > canvasBounds.y + canvasBounds.height + 1) {
              throw new Error('VirtualList preview viewport is clipped outside the Canvas: ' + JSON.stringify({ viewport: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, canvas: { x: canvasBounds.x, y: canvasBounds.y, width: canvasBounds.width, height: canvasBounds.height } }));
            }
            listViewport = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
          }
        }
        return { nodeName: view.node?.name || view.name, listViewport, visibleSize: { width: cc.view.getVisibleSize().width, height: cc.view.getVisibleSize().height }, canvas: { width: cc.game.canvas.getBoundingClientRect().width, height: cc.game.canvas.getBoundingClientRect().height } };
      }, { id });
      const filename = `${id}-${viewport.width}.png`;
      const canvas = page.locator('#GameCanvas');
      if (await canvas.count()) await canvas.screenshot({ path: path.join(output, filename) });
      else await page.locator('canvas').first().screenshot({ path: path.join(output, filename) });
      report.screenshots.push({ id, viewport, file: filename, ...presentation });
    }
  }
  if (report.errors.length || report.failedResources.length) throw new Error('Native preview reported script/resource errors. Inspect report.json.');
  report.status = 'PASS_NATIVE_PREFAB_FOUNDATION';
} catch (error) {
  report.status = 'FAIL_NATIVE_PREFAB_FOUNDATION'; report.failure = String(error.stack || error); process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, prefabs: report.native?.prefabCount, screenshots: report.screenshots.length, errorCount: report.errorCount || 0, errors: report.errors.slice(0, 8), failedResources: report.failedResources, failure: report.failure }, null, 2));
}
