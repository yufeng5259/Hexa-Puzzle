import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PROJECT, WORKSPACE } from './io.mjs';

// Reuses the running Creator preview; does not launch an editor or alter assets.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = path.join(WORKSPACE, 'tmp/prototype/ui-integration/native');
const preview = process.env.COCOS_PREVIEW_URL || 'http://127.0.0.1:7456/';
const registry = JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/resources/framework/config/prefab-registry.json'), 'utf8'));
const report = { createdAt: new Date().toISOString(), status: 'RUNNING', preview, errors: [], warnings: [], failedResources: [], screenshots: [], variantScreenshots: [], hintLayering: [], checks: [] };
fs.mkdirSync(output, { recursive: true });
let browser, page;
const progress = phase => { report.phase = phase; fs.writeFileSync(path.join(output, 'progress.json'), JSON.stringify({ phase, at: new Date().toISOString() }, null, 2)); console.log(phase); };
try {
  const refresh = await fetch(new URL('asset-db/refresh', preview));
  report.refresh = { status: refresh.status, response: (await refresh.text()).slice(0, 500) };
  if (!refresh.ok) throw new Error('Existing Creator AssetDB refresh failed');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    window.__storageWrites = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === window.localStorage) window.__storageWrites.push(String(key));
      return original.call(this, key, value);
    };
  });
  const rememberError = value => { report.errorCount = (report.errorCount || 0) + 1; if (report.errors.length < 100 && !report.errors.includes(value)) report.errors.push(value); };
  page.on('pageerror', error => rememberError(String(error.stack || error)));
  page.on('console', message => { if (message.type() === 'error') rememberError(message.text()); else if (message.type() === 'warning' && report.warnings.length < 100) report.warnings.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) report.failedResources.push({ status: response.status(), url: response.url() }); });
  progress('default-startup');
  const response = await page.goto(preview, { waitUntil: 'domcontentloaded', timeout: 60000 });
  report.httpStatus = response.status();
  const menu = page.locator('#view-select');
  if (await menu.count()) {
    await menu.click();
    const fullscreen = page.locator('[data-device="FullScreen"]');
    if (await fullscreen.count()) await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null), fullscreen.click()]);
  }
  const startupDeadline = Date.now() + 60000;
  let started = false;
  while (Date.now() < startupDeadline && !started) {
    try {
      started = await page.evaluate(async () => {
        if (typeof System === 'undefined') return false;
        const cc = await System.import('cc');
        const boot = cc.director.getScene()?.getComponentsInChildren(cc.Component).find(component => cc.js.getClassName(component) === 'FoundationBoot');
        return !!(boot?.ready && boot.currentRoute === 'mainline-map' && !boot.navigating);
      });
    } catch (error) { if (!/context was destroyed|navigation|not find context/i.test(String(error))) throw error; }
    if (!started) await page.waitForTimeout(250);
  }
  if (!started) throw new Error('Default Main Loading → map did not finish within 60 seconds');
  report.startup = await page.evaluate(async () => {
    const cc = await System.import('cc');
    const boot = cc.director.getScene().getComponentsInChildren(cc.Component).find(component => cc.js.getClassName(component) === 'FoundationBoot');
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const frame = () => new Promise(resolve => cc.director.once(cc.Director.EVENT_AFTER_DRAW, resolve));
    const frames = async (count = 3) => { for (let i = 0; i < count; i++) await frame(); };
    const until = async (condition, label) => {
      const deadline = performance.now() + 30000;
      while (!condition()) { if (performance.now() > deadline) throw new Error('Timed out: ' + label); await frame(); }
      await frames();
    };
    const route = id => until(() => boot.currentRoute === id && !boot.navigating, 'route ' + id);
    const activeButtons = root => root.getComponentsInChildren(cc.Button).filter(button => button.node.activeInHierarchy && button.enabledInHierarchy);
    const button = action => {
      const found = activeButtons(boot.currentView.node).find(button => button.clickEvents.some(event => event.customEventData === action));
      check(found, 'Missing active serialized Button action: ' + action + ' on ' + boot.currentRoute); return found;
    };
    const click = target => {
      check(target && target.node.activeInHierarchy && target.enabledInHierarchy && target.interactable, 'Cannot click inactive Button');
      check(target.clickEvents.length > 0, 'Button must use serialized clickEvents');
      target.node.emit(cc.Node.EventType.TOUCH_START, new cc.EventTouch([], true, cc.Node.EventType.TOUCH_START));
      target.node.emit(cc.Node.EventType.TOUCH_END, new cc.EventTouch([], true, cc.Node.EventType.TOUCH_END));
    };
    const action = async (id, destination) => { click(button(id)); if (destination) await route(destination); else await frames(); };
    const activeState = component => component.stateIds?.[component.stateRoots?.findIndex(node => node.active)];
    const core = component => component.node.getComponentsInChildren(cc.Component).filter(c => cc.js.getClassName(c) === 'CorePresentation' && c.node.activeInHierarchy);
    const countItems = component => core(component).reduce((count, c) => count + c.instances.length, 0);
    const point = target => {
      check(target?.node?.activeInHierarchy, 'Pointer target must be active');
      const transform = target.node.getComponent(cc.UITransform);
      const center = transform.convertToWorldSpaceAR(new cc.Vec3((0.5 - transform.anchorX) * transform.width, (0.5 - transform.anchorY) * transform.height));
      const canvas = document.querySelector('canvas'), rect = canvas.getBoundingClientRect();
      const camera = cc.director.getScene().getComponentInChildren(cc.Canvas).cameraComponent;
      const projected = camera.worldToScreen(center);
      return { x: rect.left + projected.x / canvas.width * rect.width, y: rect.bottom - projected.y / canvas.height * rect.height, node: target.node.name };
    };
    const scopes = [boot.catalogScope,boot.currentView.resourceScope];
    const createScope = boot.store.createScope.bind(boot.store);
    boot.store.createScope = () => { const scope = createScope(); scopes.push(scope); return scope; };
    window.__ui = { cc, boot, check, frame, frames, until, route, activeButtons, button, click, action, activeState, core, countItems, point, scopes, pointers: [], retained: {} };
    const startupStorageWrites = window.__storageWrites.splice(0);
    // Creator 3.8.8 cocos/core/platform/sys.ts probes availability with key "storage".
    check(startupStorageWrites.every(key => key === 'storage'), 'Startup wrote player storage: ' + startupStorageWrites.join(','));
    check(countItems(boot.currentView) === 8, 'Map must instantiate exactly eight LevelNode items, got ' + countItems(boot.currentView));
    return { scene: cc.director.getScene().name, sceneUuid: cc.director.getScene().uuid, route: boot.currentRoute, mapItems: countItems(boot.currentView), explicitSceneActivation: false, startupStorageWrites };
  });
  // This verifier locks the original artwork/navigation harness. Real sessions,
  // confirmed restarts and rule outcomes have separate pointer acceptance.
  await page.evaluate(async () => {
    const t = window.__ui;
    await t.boot.preview('mainline-map'); await t.route('mainline-map');
  });
  report.interactionMode = 'artwork-fixture';
  const pointer = async (field, expected) => {
    const point = await page.evaluate(field => {
      const t = window.__ui;
      let target=field === '$badge' ? t.boot.statusLabel.node.getComponent(t.cc.Button) : t.boot.currentView[field];
      if(!target && t.boot.currentRoute==='mainline-map') {
        const action={gardenButton:'nav:garden',settingsButton:'open:settings'}[field];
        const matches=t.activeButtons(t.boot.currentView.node).filter(button=>button.clickEvents.some(event=>event.customEventData===action));
        t.check(matches.length===1,'Expected one map Button for '+action);target=matches[0];
      }
      return t.point(target);
    }, field);
    const viewport = page.viewportSize();
    if (!(point.x >= 0 && point.x <= viewport.width && point.y >= 0 && point.y <= viewport.height)) throw new Error('Pointer target outside viewport: ' + JSON.stringify(point));
    await page.mouse.click(point.x, point.y);
    await page.evaluate(async expected => { const t = window.__ui; await t.route(expected); }, expected);
    report.checks.push({ name: 'screen-pointer', field, expected, point });
  };
  progress('real-button-navigation');
  await pointer('gardenButton', 'garden');
  report.gardenItems = await page.evaluate(() => { const t = window.__ui; const count = t.countItems(t.boot.currentView); t.check(count === 5, 'Garden must instantiate exactly five buildings'); return count; });
  await pointer('backButton', 'mainline-map');
  report.levelButton = await page.evaluate(async () => {
    const t = window.__ui;
    const items = t.boot.currentView.node.getComponentsInChildren(t.cc.Component).filter(component => t.cc.js.getClassName(component) === 'LevelNodeItemView' && component.node.activeInHierarchy);
    t.check(items.length === 8, 'Expected eight actual LevelNodeItemView instances');
    const events = items[0].button.clickEvents.map(event => ({ handler: event.handler, action: event.customEventData }));
    t.check(events.some(event => event.action === 'nav:puzzle-preview'), 'LevelNode Button must serialize nav:puzzle-preview: ' + JSON.stringify(events));
    t.click(items[0].button); await t.route('puzzle-preview');
    return { instances: items.length, events, reached: t.boot.currentRoute };
  });
  await pointer('startButton', 'puzzle');
  progress('overlay-lifetimes');
  report.overlays = await page.evaluate(async () => {
    const t = window.__ui, page = t.boot.currentPage;
    t.click(page.pauseButton); await t.route('pause'); const pause = t.boot.currentView;
    await t.action('open:settings', 'settings'); const settings = t.boot.currentView;
    await t.action('notice:toggle-setting'); t.check(/尚未接入/.test(t.boot.statusLabel.string), 'Setting toggle must explicitly remain preview only');
    await t.action('notice:local-save'); t.check(/尚未接入/.test(t.boot.statusLabel.string), 'Save entry must explicitly remain preview only');
    await t.action('back', 'pause');
    t.check(t.boot.currentView === pause && t.boot.currentPage === page, 'Settings close must restore same pause and puzzle');
    await t.frames(); t.check(!t.cc.isValid(settings, true), 'Closed settings must be destroyed');
    t.click(pause.backButton); await t.route('puzzle');
    t.check(t.boot.currentView === page && t.boot.overlayCount === 0, 'Resume must restore original puzzle');
    return { settingsClosed: true, samePauseInstance: true, samePuzzleInstance: true };
  });
  progress('confirmations-and-help');
  report.confirmations = await page.evaluate(async () => {
    const t = window.__ui, page = t.boot.currentPage;
    t.click(page.pauseButton); await t.route('pause'); const pause = t.boot.currentView;
    await t.action('open:confirmation-restart', 'confirmation');
    t.check(t.activeState(t.boot.currentView) === 'T38-01_重新开始确认', 'Restart must select authored restart variant');
    await t.action('confirm:restart', 'pause'); t.check(t.boot.currentView === pause && t.boot.currentPage === page, 'Restart preview must retain original page');
    await t.action('open:confirmation-exit', 'confirmation');
    t.check(t.activeState(t.boot.currentView) === 'T37-01_退出本局确认', 'Exit must select authored exit variant');
    await t.action('close', 'pause');
    t.click(pause.backButton); await t.route('puzzle');
    t.click(page.helpButton); await t.route('help-detail');
    t.check(t.activeState(t.boot.currentView) === 'T40-02_图示帮助_拖放拼图', 'Puzzle help must open its direct illustration');
    await t.action('back', 'puzzle'); t.check(t.boot.currentView === page, 'Direct help close must retain puzzle');
    t.click(page.pauseButton); await t.route('pause'); const helpPause = t.boot.currentView;
    await t.action('open:settings', 'settings'); const helpSettings = t.boot.currentView;
    await t.action('open:help-index', 'help-index'); const index = t.boot.currentView;
    const states = [];
    for (const [action, state] of [['help:puzzle', 'T40-02_图示帮助_拖放拼图'], ['help:endless', 'T40-03_图示帮助_三轴消除'], ['help:build', 'T40-04_图示帮助_五级建设']]) {
      await t.action(action, 'help-detail'); t.check(t.activeState(t.boot.currentView) === state, 'Wrong help state: ' + action); states.push(state);
      await t.action('back', 'help-index'); t.check(t.boot.currentView === index, 'Help detail close must retain help index');
    }
    await t.action('back', 'settings'); t.check(t.boot.currentView === helpSettings, 'Help index close must retain settings');
    await t.action('back', 'pause'); t.check(t.boot.currentView === helpPause, 'Settings close must retain pause');
    t.click(helpPause.backButton); await t.route('puzzle'); t.check(t.boot.currentView === page, 'Help close must retain puzzle');
    t.click(page.pauseButton); await t.route('pause');
    await t.action('open:confirmation-exit', 'confirmation'); await t.action('confirm:exit', 'mainline-map');
    t.check(!t.cc.isValid(page, true), 'Confirmed exit must destroy the prior puzzle');
    const level = t.boot.currentView.node.getComponentsInChildren(t.cc.Component).find(c => t.cc.js.getClassName(c) === 'LevelNodeItemView' && c.node.activeInHierarchy);
    t.click(level.button); await t.route('puzzle-preview'); t.click(t.boot.currentView.startButton); await t.route('puzzle');
    return { restartRetainsPuzzle: true, confirmedExitDestroysPuzzle: true, exitState: 'T37-01_退出本局确认', helpStates: states };
  });
  progress('debug-result-pointer');
  await pointer('$badge', 'puzzle-result');
  await pointer('gardenButton', 'garden'); await pointer('backButton', 'mainline-map');
  progress('async-failure-and-stale-navigation');
  report.async = await page.evaluate(async () => {
    const t = window.__ui, old = t.boot.currentPage;
    const fail = await t.boot.flow.replacePage('not-a-registered-view');
    t.check(!fail && t.boot.currentPage === old && old.node.activeInHierarchy, 'Unknown view failure must preserve current page');
    const create = t.boot.store.createScope;
    t.boot.store.createScope = () => { const scope = create(); const load = scope.load.bind(scope); scope.load = (id, type) => id === 'prefab:garden' ? Promise.reject(new Error('Injected native acceptance load failure')) : load(id, type); return scope; };
    try { const success = await t.boot.flow.replacePage('garden'); t.check(!success && t.boot.currentPage === old, 'Resource failure must retain old page'); }
    finally { t.boot.store.createScope = create; }
    const first = t.boot.flow.replacePage('garden'); const second = t.boot.flow.replacePage('puzzle');
    await Promise.all([first, second]); await t.route('puzzle');
    t.check(t.boot.host.pageLayer.children.filter(node => node.activeInHierarchy).length === 1, 'Rapid navigation must not retain stale active page');
    await t.boot.flow.replacePage('mainline-map'); await t.route('mainline-map');
    return { unknownRoutePreserved: true, nativeLoadFailurePreserved: true, rapidNavigationNewestWins: true };
  });
  progress('typed-variant-bindings');
  const integrated = ['loading', 'mainline-map', 'garden', 'puzzle-preview', 'puzzle', 'puzzle-result', 'pause', 'settings', 'confirmation', 'help-index', 'help-detail'];
  report.variants = await page.evaluate(async records => {
    const t = window.__ui, rows = [];
    for (const record of records) {
      if (record.stateIds.length <= 1) {
        await t.boot.preview(record.id, record.stateIds[0]); await t.frames();
        const view = t.boot.currentView;
        t.check(!('stateRoots' in view) && !('stateIds' in view), 'Single-layout view retains state arrays: ' + record.id);
        view.validateBindings();
        for (const binding of record.bindings) {
          const component = view[binding.name];
          const type=t.cc[binding.type]||t.cc.js.getClassByName(binding.type);
          t.check(type && component instanceof type, 'Invalid single-layout binding: ' + record.id + '.' + binding.name);
          let owner = component instanceof t.cc.Node ? component : component.node;
          while (owner && owner !== view.node) owner = owner.parent;
          t.check(owner === view.node, 'Single-layout binding points outside root: ' + binding.name);
        }
        const items=t.countItems(view);
        if(record.id==='mainline-map')t.check(items===8,'Manual map must still render eight level items');
        rows.push({ id: record.id, state: record.stateIds[0] || null, fields: record.bindings.length, items });
        continue;
      }
      for (const state of record.stateIds) {
        await t.boot.preview(record.id, state); await t.frames();
        const view = t.boot.currentView, index = view.stateIds.indexOf(state);
        t.check(t.activeState(view) === state, 'Wrong active state for ' + record.id);
        let fields = 0;
        for (const key of Object.keys(view).filter(key => key.endsWith('States'))) {
          const field = key.slice(0, -6); const values = view[key];
          if (!Array.isArray(values)) continue;
          t.check(view[field] === values[index], 'Stale typed variant binding: ' + record.id + '.' + field);
          const node = view[field]?.node || (view[field] instanceof t.cc.Node ? view[field] : null);
          if (node && node !== view.node) {
            let owner = node; while (owner && !view.stateRoots.includes(owner)) owner = owner.parent;
            t.check(owner === view.stateRoots[index], 'Field points outside current state: ' + record.id + '.' + field);
          }
          fields++;
        }
        view.validateBindings();
        rows.push({ id: record.id, state, fields, items: t.countItems(view) });
      }
    }
    return rows;
  }, registry.prefabs.filter(record => integrated.includes(record.id)));
  progress('screenshots');
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    for (const id of ['mainline-map', 'garden', 'puzzle', 'pause', 'settings', 'confirmation', 'puzzle-result']) {
      await page.evaluate(async id => {
        const t = window.__ui;
        if (['pause', 'settings', 'confirmation'].includes(id)) { await t.boot.preview('puzzle'); await t.boot.flow.openOverlay(id); }
        else await t.boot.preview(id);
        await t.frames(5);
      }, id);
      const filename = `${viewport.width}x${viewport.height}-${id}.png`;
      await page.screenshot({ path: path.join(output, filename) });
      report.screenshots.push({ ...viewport, id, file: filename });
    }
    const hintLayering = await page.evaluate(async () => {
      const t = window.__ui;
      await t.boot.preview('puzzle', 'T03-01_拼图提示轮廓'); await t.frames(5);
      const view = t.boot.currentView;
      t.check(t.activeState(view) === 'T03-01_拼图提示轮廓', 'Hint screenshot must use the authored hint variant');
      // Cocos UI renders the active hierarchy in sibling order. Inspect the real
      // Graphics and instantiated Sprite nodes, rather than empty mount roots.
      const ordered = [];
      const visit = node => { if (!node.activeInHierarchy) return; ordered.push(node); node.children.forEach(visit); };
      visit(view.node);
      const geometries = view.node.getComponentsInChildren(t.cc.Component).filter(component => t.cc.js.getClassName(component) === 'SourceGeometry' && component.node.activeInHierarchy);
      const role = geometry => JSON.parse(geometry.spec).spec.role;
      const outline = geometries.find(geometry => role(geometry) === 'outline');
      const selection = geometries.find(geometry => role(geometry) === 'selection');
      t.check(outline && selection, 'Hint state must contain both actual outline and tray-selection geometry');
      t.check(outline.node.parent === view.hintRoot, 'Typed hintRoot must contain the actual gold-outline geometry');
      const checkOverlay = (geometry, underlay, label) => {
        const sprites = underlay.getComponentsInChildren(t.cc.Sprite).filter(sprite => sprite.node.activeInHierarchy && sprite.enabledInHierarchy && sprite.spriteFrame);
        t.check(sprites.length > 0, label + ': no rendered reusable underlay items');
        const lastUnderlay = Math.max(...sprites.map(sprite => ordered.indexOf(sprite.node)));
        const overlayOrder = ordered.indexOf(geometry.node);
        t.check(geometry.graphics?.enabledInHierarchy && geometry.graphics.impl?.pathLength > 0, label + ': Graphics must contain drawn paths');
        t.check(overlayOrder > lastUnderlay, label + ': geometry is occluded by later item renderers');
        return { underlaySprites: sprites.length, lastUnderlayOrder: lastUnderlay, overlayOrder, drawnPaths: geometry.graphics.impl.pathLength };
      };
      return { state: t.activeState(view), boardOutline: checkOverlay(outline, view.boardRoot, 'board outline'), traySelection: checkOverlay(selection, view.trayRoot, 'tray selection') };
    });
    report.hintLayering.push({ ...viewport, ...hintLayering });
    const hintFilename = `${viewport.width}x${viewport.height}-puzzle-hint.png`;
    await page.screenshot({ path: path.join(output, hintFilename) });
    report.variantScreenshots.push({ ...viewport, id: 'puzzle-hint', file: hintFilename });
  }
  progress('scope-release');
  report.resources = await page.evaluate(async () => {
    const t = window.__ui; await t.boot.preview('mainline-map'); await t.frames(8);
    const owned = t.scopes.filter(scope => !scope.isReleased);
    t.check(owned.length === 2 && owned.includes(t.boot.catalogScope) && owned.includes(t.boot.currentView.resourceScope), 'Only map and Boot catalog scopes may remain after navigation: ' + owned.length);
    t.check(t.boot.host.pageLayer.children.length === 1 && t.boot.host.dialogLayer.children.length === 0 && t.boot.host.guideLayer.children.length === 0, 'Closed views must be destroyed from all three layers');
    t.check(window.__storageWrites.length === 0, 'UI navigation wrote localStorage: ' + window.__storageWrites.join(','));
    return { createdScopes: t.scopes.length, releasedScopes: t.scopes.length - owned.length, activeScopes: owned.length, localStorageWrites: window.__storageWrites };
  });
  if (report.errors.length || report.failedResources.length) throw new Error(`Native errors=${report.errors.length}; failed resources=${report.failedResources.length}`);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.failure = String(error.stack || error); console.error(report.failure); process.exitCode = 1;
  if (page) {
    report.failureDetails = await page.evaluate(() => {
      const t = window.__ui; if (!t) return { uiHelpersReady: false };
      return { route: t.boot.currentRoute, status: t.boot.statusLabel.string, storageWrites: window.__storageWrites,
        components: t.boot.currentView.node.getComponentsInChildren(t.cc.Component).map(c => ({ name: t.cc.js.getClassName(c), node: c.node.name, active: c.node.activeInHierarchy, instances: c.instances?.length, layouts: c.layouts?.length })) };
    }).catch(error => ({ diagnosticFailure: String(error) }));
    await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  }
} finally {
  if (browser) await browser.close();
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, phase: report.phase, screenshots: report.screenshots.length, variantScreenshots: report.variantScreenshots.length, errors: report.errors.length, report: path.join(output, 'report.json') }));
}
