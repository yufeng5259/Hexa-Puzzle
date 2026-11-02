import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PROJECT, WORKSPACE } from './io.mjs';

// Uses the existing single Creator preview. Run only after generation/import has finished.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = path.join(WORKSPACE, 'tmp/prototype/level-prefabs/native');
const preview = process.env.COCOS_PREVIEW_URL || 'http://127.0.0.1:7456/';
const catalog = JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/bundles/puzzle/config/level-catalog.json'), 'utf8'));
const viewportSizes = [{ width: 390, height: 844 }, { width: 375, height: 667 }, { width: 360, height: 640 }, { width: 320, height: 568 }];
const cases = [3, 4, 6, 7].map(count => {
  const level = catalog.levels.find(level => level.pieces.length === count && level.mainlineNumber !== null)
    || catalog.levels.find(level => level.pieces.length === count);
  if (!level) throw new Error(`No source question with ${count} pieces`);
  return { id: level.id, number: level.mainlineNumber, pieces: count };
});
const report = { createdAt: new Date().toISOString(), status: 'RUNNING', preview, checks: [], screenshots: [], mapScreenshots: [], errors: [], warnings: [], failedResources: [] };
fs.mkdirSync(output, { recursive: true });
let browser, page;
const progress = phase => {
  report.phase = phase;
  fs.writeFileSync(path.join(output, 'progress.json'), JSON.stringify({ phase, at: new Date().toISOString() }, null, 2));
  console.log(phase);
};
try {
  const refresh = await fetch(new URL('asset-db/refresh', preview));
  report.refresh = { status: refresh.status, body: (await refresh.text()).slice(0, 500) };
  if (!refresh.ok) throw new Error('Existing Creator AssetDB refresh failed');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: viewportSizes[0], deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    window.__storageWrites = [];
    for (const method of ['setItem', 'removeItem', 'clear']) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (...args) {
        if (this === window.localStorage) window.__storageWrites.push({ method, key: args[0] ?? null,
          ...(args[0] === 'debug' ? { stack: new Error('Creator preview storage call').stack } : {}) });
        return original.apply(this, args);
      };
    }
  });
  const error = message => { if (!report.errors.includes(message)) report.errors.push(message); };
  page.on('pageerror', value => error(String(value.stack || value)));
  page.on('console', value => { if (value.type() === 'error') error(value.text()); else if (value.type() === 'warning' && report.warnings.length < 100) report.warnings.push(value.text()); });
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) report.failedResources.push({ status: response.status(), url: response.url() }); });
  progress('default-map');
  report.httpStatus = (await page.goto(preview, { waitUntil: 'domcontentloaded', timeout: 60000 })).status();
  const menu = page.locator('#view-select');
  if (await menu.count()) {
    await menu.click();
    const fullscreen = page.locator('[data-device="FullScreen"]');
    if (await fullscreen.count()) await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null), fullscreen.click()]);
  }
  await page.waitForFunction(async () => {
    if (typeof System === 'undefined') return false;
    const cc = await System.import('cc');
    const boot = cc.director.getScene()?.getComponentsInChildren(cc.Component).find(component => cc.js.getClassName(component) === 'FoundationBoot');
    return !!(boot?.ready && boot.currentRoute === 'mainline-map' && !boot.navigating);
  }, null, { timeout: 60000 });
  report.startup = await page.evaluate(async levels => {
    const cc = await System.import('cc');
    const boot = cc.director.getScene().getComponentsInChildren(cc.Component).find(component => cc.js.getClassName(component) === 'FoundationBoot');
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const frame = () => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Native render frame timed out')), 10000);
      cc.director.once(cc.Director.EVENT_AFTER_DRAW, () => { clearTimeout(timeout); resolve(); });
    });
    const frames = async (count = 3) => { for (let i = 0; i < count; i++) await frame(); };
    const until = async (condition, label) => {
      const deadline = performance.now() + 30000;
      while (!condition()) { if (performance.now() > deadline) throw new Error('Timed out: ' + label); await frame(); }
      await frames();
    };
    const route = id => until(() => boot.currentRoute === id && !boot.navigating, 'route ' + id);
    const components = (root, name) => root.getComponentsInChildren(cc.Component).filter(component => cc.js.getClassName(component) === name && component.enabledInHierarchy && component.node.activeInHierarchy);
    const map = () => {
      const found = components(boot.currentView.node, 'MainlineMapPresentation');
      check(found.length === 1, 'Expected one active MainlineMapPresentation'); return found[0];
    };
    const board = () => {
      const found = components(boot.currentView.node, 'PuzzleBoardPresentation');
      check(found.length === 1, 'Expected one active PuzzleBoardPresentation'); return found[0];
    };
    const selections = () => components(boot.currentView.node, 'MainlineLevelSelection').sort((a, b) => a.mainlineNumber - b.mainlineNumber);
    const selectionButton = number => {
      const selected = selections().find(item => item.mainlineNumber === number);
      check(selected, 'No typed level item: ' + number);
      return selected.node.getComponent(cc.js.getClassByName('LevelNodeItemView')).button;
    };
    const click = button => {
      check(button?.node.activeInHierarchy && button.enabledInHierarchy && button.interactable, 'Serialized Button must be clickable');
      check(button.clickEvents.length > 0, 'Button must retain serialized events');
      button.node.emit(cc.Node.EventType.TOUCH_START, new cc.EventTouch([], true, cc.Node.EventType.TOUCH_START));
      button.node.emit(cc.Node.EventType.TOUCH_END, new cc.EventTouch([], true, cc.Node.EventType.TOUCH_END));
    };
    const point = node => {
      const ui = node.getComponent(cc.UITransform);
      const center = ui.convertToWorldSpaceAR(new cc.Vec3((0.5 - ui.anchorX) * ui.width, (0.5 - ui.anchorY) * ui.height));
      const canvas = document.querySelector('canvas'), rect = canvas.getBoundingClientRect();
      const projected = cc.director.getScene().getComponentInChildren(cc.Canvas).cameraComponent.worldToScreen(center);
      return { x: rect.left + projected.x / canvas.width * rect.width, y: rect.bottom - projected.y / canvas.height * rect.height };
    };
    const assertMap = page => {
      const presentation = map(), items = selections(), numbers = items.map(item => item.mainlineNumber);
      check(presentation.page === page && boot.mapPage === page, 'Wrong committed map page');
      check(JSON.stringify(numbers) === JSON.stringify(Array.from({ length: 8 }, (_, i) => (page - 1) * 8 + i + 1)), 'Map numbers do not match real page: ' + numbers);
      check(presentation.pageLabel.string === `${page} / 12`, 'Page label is stale');
      check(presentation.previousButton.interactable === (page > 1), 'Wrong previous-page bounds');
      check(presentation.nextButton.interactable === (page < 12), 'Wrong next-page bounds');
      return { page, numbers, label: presentation.pageLabel.string };
    };
    const assertIdentity = number => {
      const level = levels.find(level => level.mainlineNumber === number), projection = board();
      check(level && boot.selectedMainlineNumber === number && boot.selectedLevelId === level.id && projection.levelId === level.id, 'Selected identity changed between map, entry and board');
      const view = boot.currentView;
      const state = view.stateIds?.[view.stateRoots?.findIndex(node => node.active)] ?? null;
      return { number, id: level.id, route: boot.currentRoute, state, pieces: level.pieces.length };
    };
    const scopes = [boot.catalogScope, boot.currentView.resourceScope];
    const createScope = boot.store.createScope.bind(boot.store);
    boot.store.createScope = () => { const scope = createScope(); scopes.push(scope); return scope; };
    const startupWrites = window.__storageWrites.splice(0);
    // Creator's Socket.IO preview client initializes its bundled debug library twice.
    // The captured startup stack proves this exact removeItem('debug') comes from
    // socket.io.js. Keep the exception scoped to startup, method, key AND source.
    const knownStartupWrite = write => (write.key === 'storage' && ['setItem', 'removeItem'].includes(write.method))
      || (write.key === 'debug' && write.method === 'removeItem' && /\/socket\.io\/socket\.io\.js:\d+:\d+/.test(write.stack || ''));
    check(startupWrites.every(knownStartupWrite), 'Startup wrote player save: ' + JSON.stringify(startupWrites));
    window.__levels = { cc, boot, check, frame, frames, until, route, components, map, board, selections, selectionButton, click, point, assertMap, assertIdentity, scopes, levels };
    return { ...assertMap(1), startupWrites, explicitSceneActivation: false };
  }, catalog.levels);
  const pointer = async (target, expected) => {
    const location = await page.evaluate(target => {
      const t = window.__levels;
      const button = target.number ? t.selectionButton(target.number) : target.field === 'nextButton' ? t.map().nextButton : t.boot.currentView[target.field];
      return t.point(button.node);
    }, target);
    const viewport = page.viewportSize();
    if (!(location.x >= 0 && location.x <= viewport.width && location.y >= 0 && location.y <= viewport.height)) throw new Error('Pointer target outside viewport: ' + JSON.stringify({ target, location }));
    await page.mouse.click(location.x, location.y);
    await page.evaluate(async expected => { await window.__levels.route(expected); }, expected);
    report.checks.push({ kind: 'real-pointer', target, expected, location });
  };
  const returnMap = () => page.evaluate(async () => { const t = window.__levels; await t.boot.flow.replacePage('mainline-map'); await t.route('mainline-map'); });
  await page.screenshot({path:path.join(output,'390x844-map-1.png')});
  report.mapScreenshots.push({id:'map-1',width:390,height:844,file:'390x844-map-1.png'});
  for (const number of [6, 12, 96]) {
    progress('typed-level-' + number);
    const pageNumber = Math.ceil(number / 8);
    await page.evaluate(async target => {
      const t = window.__levels;
      while (t.boot.mapPage < target) { const previous = t.boot.currentView; t.click(t.map().nextButton); await t.until(() => t.boot.currentView !== previous && !t.boot.navigating, 'next map page'); }
      t.assertMap(target);
    }, pageNumber);
    await pointer({ number }, 'puzzle-preview');
    report.checks.push(await page.evaluate(number => window.__levels.assertIdentity(number), number));
    await pointer({ field: 'startButton' }, 'puzzle');
    report.checks.push(await page.evaluate(async number => {
      const t = window.__levels, current = t.boot.currentPage;
      const identity = t.assertIdentity(number);
      t.click(current.pauseButton); await t.route('pause');
      t.click(t.boot.currentView.backButton); await t.route('puzzle');
      t.check(t.boot.currentPage === current, 'Pause must retain the same real-question instance');
      t.assertIdentity(number); return { ...identity, pauseRetainedInstance: true };
    }, number));
    await returnMap();
  }
  report.finalPage = await page.evaluate(() => window.__levels.assertMap(12));
  await page.screenshot({path:path.join(output,'390x844-map-12.png')});
  report.mapScreenshots.push({id:'map-12',width:390,height:844,file:'390x844-map-12.png'});
  progress('invalid-and-failed-selection');
  report.failures = await page.evaluate(async () => {
    const t = window.__levels, old = t.boot.currentView, selected = t.boot.selectedLevelId;
    for (const invalid of [0, 97, 'challenge-026']) await t.boot.selectMainline(invalid);
    t.check(t.boot.currentView === old && t.boot.selectedLevelId === selected, 'Invalid or reserve selection changed normal navigation');
    const create = t.boot.store.createScope;
    t.boot.store.createScope = () => {
      const scope = create(), load = scope.load.bind(scope);
      scope.load = (id, type) => id === 'prefab:puzzle-preview' ? Promise.reject(new Error('Injected question-load failure')) : load(id, type);
      return scope;
    };
    try { await t.boot.selectMainline(6); } finally { t.boot.store.createScope = create; }
    t.check(t.boot.currentView === old && t.boot.selectedLevelId === selected, 'Failed preparation committed a question or replaced map');
    let release, delayed = false;
    t.boot.store.createScope = () => {
      const scope = create(), load = scope.load.bind(scope);
      scope.load = (id, type) => {
        const result = load(id, type);
        if (id !== 'prefab:puzzle-preview' || delayed) return result;
        delayed = true;
        return result.then(asset => new Promise(resolve => { release = () => resolve(asset); }));
      };
      return scope;
    };
    try {
      const earlier = t.boot.selectMainline(6);
      await t.until(() => !!release, 'delayed first question');
      await t.boot.selectMainline(12); await t.route('puzzle-preview');
      const latest = t.boot.currentView; t.assertIdentity(12);
      release(); await earlier; await t.frames();
      t.check(t.boot.currentView === latest && t.boot.selectedMainlineNumber === 12, 'Late selection revived the older question');
    } finally { t.boot.store.createScope = create; release?.(); }
    await t.boot.flow.replacePage('mainline-map'); await t.route('mainline-map');
    return { invalidRejected: true, reserveRejected: true, loadFailurePreserved: true, lateResultRejected: true };
  });
  // Negative cases deliberately use the public notice path. Let its existing
  // four-second timer finish before capturing normal UI; do not alter Boot state.
  progress('negative-case-notice-reset');
  await page.waitForTimeout(4300);
  report.noticeIsolation = await page.evaluate(() => {
    const t = window.__levels, message = t.boot.statusLabel.string;
    t.check(message === '玩法验证 · 无存档与奖励', 'Injected failure notice survived its normal reset timer: ' + message);
    return { reason: 'Negative-case notices must not appear in normal-state screenshots', elapsedMilliseconds: 4300,
      usedPublicTimer: true, runtimeStateModified: false, message };
  });
  progress('question-geometry-four-viewports');
  for (const viewport of viewportSizes) {
    await page.setViewportSize(viewport);
    for (const sample of cases) {
      const geometry = await page.evaluate(async sample => {
        const t = window.__levels;
        if (sample.number === null) await t.boot.previewLevel(sample.id);
        else { await t.boot.selectMainline(sample.number); await t.route('puzzle-preview'); t.click(t.boot.currentView.startButton); await t.route('puzzle'); }
        await t.frames(5);
        const projection = t.board(), level = t.levels.find(level => level.id === sample.id);
        t.check(projection.levelId === level.id && t.boot.selectedLevelId === level.id, 'Wrong screenshot source question');
        t.check(sample.number !== null || t.boot.selectedMainlineNumber === null, 'Reserve preview must not claim a mainline number');
        const pieces = t.components(projection.piecesMount, 'PuzzlePiecePresentation');
        t.check(pieces.length === level.pieces.length, 'Pieces must instantiate as whole-piece Prefabs');
        t.check(projection.cells.filter(entry => entry.node.activeInHierarchy).length === level.targetCells.length + level.obstacleCells.length, 'Board cell count differs from source');
        t.check(projection.fixtureNodes.every(node => !node.activeInHierarchy), 'Original sample cells/geometry overlay real question');
        const core = t.components(t.boot.currentView.node, 'CorePresentation');
        t.check(core.every(layout => layout.instances.every(item => !projection.fixtureNodes.includes(item.mount))), 'Core retained fixture item instances');
        const boundsFor = (node, parentUI) => {
          const ui = node.getComponent(t.cc.UITransform);
          return [[0, 0], [ui.width, 0], [ui.width, ui.height], [0, ui.height]].map(([x, y]) => {
            const world = ui.convertToWorldSpaceAR(new t.cc.Vec3(x - ui.anchorX * ui.width, y - ui.anchorY * ui.height));
            return { world, local: parentUI.convertToNodeSpaceAR(world) };
          });
        };
        const trayUI = projection.piecesMount.getComponent(t.cc.UITransform), boardUI = projection.boardMount.getComponent(t.cc.UITransform);
        const canvas = document.querySelector('canvas'), rect = canvas.getBoundingClientRect();
        const camera = t.cc.director.getScene().getComponentInChildren(t.cc.Canvas).cameraComponent;
        const inside = (corner, ui, label) => {
          const p = corner.local, epsilon = 0.1;
          t.check(p.x >= -ui.anchorX * ui.width - epsilon && p.x <= (1 - ui.anchorX) * ui.width + epsilon
            && p.y >= -ui.anchorY * ui.height - epsilon && p.y <= (1 - ui.anchorY) * ui.height + epsilon, label + ' outside its formal mount');
          const screen = camera.worldToScreen(corner.world);
          const x = rect.left + screen.x / canvas.width * rect.width, y = rect.bottom - screen.y / canvas.height * rect.height;
          t.check(x >= -1 && x <= window.innerWidth + 1 && y >= -1 && y <= window.innerHeight + 1, label + ' outside screen');
          return { x, y };
        };
        const bounds = pieces.map(piece => {
          const source = level.pieces.find(record => record.id === piece.pieceId);
          t.check(source && JSON.stringify(piece.cells) === JSON.stringify(source.cells), 'Whole piece geometry differs from source');
          const cells = piece.items.filter(item => item.node.activeInHierarchy);
          t.check(cells.length === source.cells.length, 'Whole piece cell count differs from source');
          const points = cells.flatMap(item => boundsFor(item.node, trayUI).map(corner => inside(corner, trayUI, piece.pieceId)));
          return { pieceId: piece.pieceId, cells: cells.length, left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)), top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
        });
        projection.cells.filter(item => item.node.activeInHierarchy).forEach(item => boundsFor(item.node, boardUI).forEach(corner => inside(corner, boardUI, 'board cell')));
        for (const geometry of [projection.boardFloor, projection.boardRim, projection.boardShadow]) {
          t.check(geometry.node.activeInHierarchy && geometry.graphics?.impl?.pathLength > 0, 'Live board geometry was not rendered');
        }
        const first = pieces[0], before = first.node.position.clone(), intents = [];
        const listener = payload => intents.push(payload);
        first.node.on('puzzle-piece-input', listener);
        first.onTouchStart(); first.onTouchMove(); first.onTouchEnd(); first.onTouchCancel();
        first.node.off('puzzle-piece-input', listener);
        t.check(intents.length === 4 && intents.every(intent => intent.pieceId === first.pieceId), 'Piece input must carry the piece ID');
        t.check(first.node.position.equals(before), 'Input-only display unexpectedly moved a piece');
        return { id: level.id, mainlineNumber: level.mainlineNumber, pieces: pieces.length, targetCells: level.targetCells.length,
          obstacles: level.obstacleCells.length, bounds, fixturesHidden: projection.fixtureNodes.length, inputIntentsOnly: true };
      }, sample);
      const filename = `${viewport.width}x${viewport.height}-${sample.pieces}-pieces-${sample.id}.png`;
      await page.screenshot({ path: path.join(output, filename) });
      report.screenshots.push({ ...viewport, ...geometry, file: filename });
    }
  }
  progress('scope-ownership-and-no-save');
  report.resources = await page.evaluate(async () => {
    const t = window.__levels;
    await t.boot.selectMainline(1); await t.route('puzzle-preview');
    await t.boot.flow.replacePage('mainline-map'); await t.route('mainline-map'); await t.frames(10);
    const owned = [...new Set(t.scopes)].filter(scope => !scope.isReleased);
    t.check(owned.length === 2 && owned.includes(t.boot.catalogScope) && owned.includes(t.boot.currentView.resourceScope), 'Only map and Boot catalog scopes should remain: ' + owned.length);
    t.check(t.boot.host.pageLayer.children.length === 1 && t.boot.host.dialogLayer.children.length === 0 && t.boot.host.guideLayer.children.length === 0, 'Navigation left old view instances alive');
    t.check(window.__storageWrites.length === 0, 'Question display wrote local storage: ' + JSON.stringify(window.__storageWrites));
    return { createdScopes: t.scopes.length, releasedScopes: t.scopes.filter(scope => scope.isReleased).length,
      activeScopes: owned.length, ownership: ['current-map', 'boot-level-catalog'], localStorageWrites: window.__storageWrites, finalMap: t.assertMap(1) };
  });
  if (report.errors.length || report.failedResources.length) throw new Error(`Native errors=${report.errors.length}; failed resources=${report.failedResources.length}`);
  report.status = 'PASS';
} catch (failure) {
  report.status = 'FAIL'; report.failure = String(failure.stack || failure); process.exitCode = 1; console.error(report.failure);
  if (page) {
    report.failureDetails = await page.evaluate(() => {
      const t = window.__levels;
      return t ? { route: t.boot.currentRoute, selectedId: t.boot.selectedLevelId, number: t.boot.selectedMainlineNumber,
        page: t.boot.mapPage, status: t.boot.statusLabel.string, storageWrites: window.__storageWrites } : { helpersReady: false };
    }).catch(error => ({ diagnosticError: String(error) }));
    await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  }
} finally {
  if (browser) await browser.close();
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, phase: report.phase, screenshots: report.screenshots.length, errors: report.errors.length, report: path.join(output, 'report.json') }));
}
