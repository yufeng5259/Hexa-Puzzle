import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PROJECT, WORKSPACE } from './io.mjs';

// Real browser pointer verification against the already-running Creator preview.
// Navigation may use the app's public actions; placements must use mouse/touch.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview = process.env.COCOS_PREVIEW_URL || 'http://127.0.0.1:7456/';
const output = path.join(WORKSPACE, 'tmp/prototype/single-level-play/native');
const catalog = JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/bundles/puzzle/config/level-catalog.json'), 'utf8'));
const sizes = [{ width: 390, height: 844 }, { width: 375, height: 667 }, { width: 360, height: 640 }, { width: 320, height: 568 }];
const samples = [3, 4, 6, 7].map(count => catalog.levels.find(level => level.mode === 'classic' && level.pieces.length === count)
  || catalog.levels.find(level => level.pieces.length === count));
if (samples.some(level => !level)) throw new Error('Missing 3/4/6/7-piece source case');
const report = { createdAt: new Date().toISOString(), status: 'RUNNING', preview, checks: [], screenshots: [], errors: [], warnings: [], failedResources: [] };
fs.mkdirSync(output, { recursive: true });
const precedingReport = path.join(output, 'report.json');
if (fs.existsSync(precedingReport)) {
  const earlier = JSON.parse(fs.readFileSync(precedingReport, 'utf8'));
  if (earlier.status === 'FAIL' && earlier.errors?.some(error => error.includes('Ignored attempt to cancel a touchcancel event'))) {
    const retained = path.join(output, 'earlier-noncancelable-touchcancel-failure.json');
    if (!fs.existsSync(retained)) fs.copyFileSync(precedingReport, retained);
  }
}
report.limitations = [{ kind: 'creator-noncancelable-touchcancel',
  detail: 'Chrome CDP touchCancel produces cancelable=false. Creator 3.8.8 pal/input/web/touch-input.js unconditionally calls preventDefault for canvas touch events, producing a browser console error. This verifier keeps all error collection unchanged and applies no engine patch. Native multitouch cancellation is tested via the real pause lifecycle; the separate DOM touchcancel branch is synthetic and explicitly cancelable, not trusted hardware input.',
  previousFailure: 'earlier-noncancelable-touchcancel-failure.json' }];
let browser, page;
function progress(phase) {
  report.phase = phase;
  fs.writeFileSync(path.join(output, 'progress.json'), JSON.stringify({ phase, at: new Date().toISOString() }, null, 2));
  console.log(phase);
}

try {
  // Never launch a second Creator or change the preview port to hide a failure.
  const available = await fetch(preview);
  if (!available.ok) throw new Error(`Existing Creator preview unavailable: ${available.status}`);
  const refresh = await fetch(new URL('asset-db/refresh', preview));
  report.refresh = { status: refresh.status, body: (await refresh.text()).slice(0, 500) };
  if (!refresh.ok) throw new Error('Existing Creator AssetDB refresh failed');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: sizes[0], deviceScaleFactor: 1, hasTouch: true });
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
  const error = value => { if (!report.errors.includes(value)) report.errors.push(value); };
  page.on('pageerror', value => error(String(value.stack || value)));
  page.on('console', value => {
    if (value.type() === 'error') error(value.text());
    else if (value.type() === 'warning' && report.warnings.length < 100) report.warnings.push(value.text());
  });
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) report.failedResources.push({ status: response.status(), url: response.url() });
  });
  progress('boot');
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
  report.startup = await page.evaluate(levels => {
    const install = async () => {
      const cc = await System.import('cc');
      const boot = cc.director.getScene().getComponentsInChildren(cc.Component).find(component => cc.js.getClassName(component) === 'FoundationBoot');
      const check = (condition, label) => { if (!condition) throw new Error(label); };
      const frame = () => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Native render frame timed out')), 10000);
        cc.director.once(cc.Director.EVENT_AFTER_DRAW, () => { clearTimeout(timer); resolve(); });
      });
      const frames = async (count = 3) => { for (let i = 0; i < count; i++) await frame(); };
      const until = async (condition, label) => {
        const deadline = performance.now() + 30000;
        while (!condition()) { if (performance.now() > deadline) throw new Error('Timed out: ' + label); await frame(); }
        await frames();
      };
      const route = id => until(() => boot.currentRoute === id && !boot.navigating, 'route ' + id);
      const components = (root, name) => root.getComponentsInChildren(cc.Component)
        .filter(component => cc.js.getClassName(component) === name && component.enabledInHierarchy && component.node.activeInHierarchy);
      const board = () => {
        const matches = components(boot.currentPage.node, 'PuzzleBoardPresentation');
        check(matches.length === 1, 'One active typed board required'); return matches[0];
      };
      const snapshot = () => {
        const value = boot.activeAttempt;
        check(value && typeof value.attemptId === 'string' && value.placements && Number.isInteger(value.moves), 'Boot.activeAttempt snapshot contract missing');
        return JSON.parse(JSON.stringify(value));
      };
      const point = (node, local = { x: 0, y: 0 }) => {
        const ui = node.getComponent(cc.UITransform);
        check(ui, 'Pointer target requires UITransform');
        const world = ui.convertToWorldSpaceAR(new cc.Vec3(local.x, local.y, 0));
        const screen = cc.director.getScene().getComponentInChildren(cc.Canvas).cameraComponent.worldToScreen(world);
        const canvas = document.querySelector('canvas'), rect = canvas.getBoundingClientRect();
        return { x: rect.left + screen.x / canvas.width * rect.width, y: rect.bottom - screen.y / canvas.height * rect.height };
      };
      const button = ({ field, action }) => {
        if (field) return boot.currentView[field];
        const buttons = boot.currentView.node.getComponentsInChildren(cc.Button).filter(value => value.node.activeInHierarchy && value.enabledInHierarchy && value.interactable
          && value.clickEvents.some(event => event.customEventData === action));
        check(buttons.length === 1, `Expected one serialized button for ${action}, got ${buttons.length}`); return buttons[0];
      };
      const piecePoint = id => {
        const entry = board().pieceEntries().find(entry => entry.item.pieceId === id);
        check(entry, 'Missing whole-piece Prefab ' + id);
        const piece = entry.item, radius = piece.radius;
        const positions = piece.cells.map(cell => ({ x: 1.5 * radius * cell.q, y: Math.sqrt(3) * radius * (cell.r + cell.q / 2) }));
        const cx = (Math.min(...positions.map(p => p.x)) + Math.max(...positions.map(p => p.x))) / 2;
        const cy = (Math.min(...positions.map(p => p.y)) + Math.max(...positions.map(p => p.y))) / 2;
        return point(entry.node, { x: positions[0].x - cx, y: positions[0].y - cy });
      };
      const targetPoint = (id, translation) => {
        const projection = board(), source = projection.level.pieces.find(piece => piece.id === id);
        return point(projection.boardMount, projection.pointOfCell({ q: source.cells[0].q + translation.q, r: source.cells[0].r + translation.r }));
      };
      const unchanged = (before, after, label) => {
        check(before.attemptId === after.attemptId && before.moves === after.moves && before.status === after.status
          && JSON.stringify(before.placements) === JSON.stringify(after.placements), label);
      };
      const scopes = [boot.catalogScope, boot.currentView.resourceScope], create = boot.store.createScope.bind(boot.store);
      boot.store.createScope = () => { const scope = create(); scopes.push(scope); return scope; };
      const startupWrites = window.__storageWrites.splice(0);
      // Creator's Socket.IO preview client initializes its bundled debug library twice.
      // The captured startup stack proves this exact removeItem('debug') comes from
      // socket.io.js. Keep the exception scoped to startup, method, key AND source.
      const knownStartupWrite = write => (write.key === 'storage' && ['setItem', 'removeItem'].includes(write.method))
        || (write.key === 'debug' && write.method === 'removeItem' && /\/socket\.io\/socket\.io\.js:\d+:\d+/.test(write.stack || ''));
      check(startupWrites.every(knownStartupWrite), 'Startup wrote player save: ' + JSON.stringify(startupWrites));
      window.__play = { cc, boot, check, frame, frames, until, route, components, board, snapshot, point, button, piecePoint, targetPoint, unchanged, scopes, levels };
      return { startupWrites };
    };
    return install();
  }, catalog.levels);

  const snapshot = () => page.evaluate(() => window.__play.snapshot());
  const frames = count => page.evaluate(count => window.__play.frames(count), count);
  const assertUnchanged = (before, label) => page.evaluate(({ before, label }) => {
    const t = window.__play; t.unchanged(before, t.snapshot(), label);
  }, { before, label });
  const action = (id, expected) => page.evaluate(async ({ id, expected }) => {
    const t = window.__play; await t.boot.flow.handle(id); if (expected) await t.route(expected); else await t.frames();
  }, { id, expected });
  const inside = location => {
    const viewport = page.viewportSize();
    if (![location.x, location.y].every(Number.isFinite) || location.x < 0 || location.y < 0 || location.x > viewport.width || location.y > viewport.height)
      throw new Error('Real pointer target outside viewport: ' + JSON.stringify({ location, viewport }));
  };
  const click = async (target, expected) => {
    const location = await page.evaluate(target => {
      const t = window.__play, button = t.button(target);
      t.check(button?.interactable && button.node.activeInHierarchy && button.enabledInHierarchy, 'Button is not usable');
      t.check(button.clickEvents.length, 'Button has no serialized event'); return t.point(button.node);
    }, target);
    inside(location); await page.mouse.click(location.x, location.y);
    if (expected) await page.evaluate(expected => window.__play.route(expected), expected); else await frames(4);
    report.checks.push({ kind: 'button-pointer', ...target, location });
  };
  const enter = async (level, fresh = true) => {
    await page.evaluate(async level => {
      const t = window.__play;
      if (level.mainlineNumber === null) await t.boot.previewLevel(level.id);
      else {
        await t.boot.selectMainline(level.mainlineNumber); await t.route('puzzle-preview');
        await t.boot.flow.handle('nav:puzzle');
      }
      await t.until(() => !t.boot.navigating && t.boot.currentRoute !== 'puzzle-preview' && t.boot.activeAttempt?.levelId === level.id, 'selected attempt');
      await t.frames(5);
      t.check(t.snapshot().levelId === level.id, 'Source question does not match active attempt');
    }, level);
    if (fresh && ((await snapshot()).moves || (await snapshot()).status !== 'active')) {
      await action('open:confirmation-restart', 'confirmation');
      await click({ action: 'confirm:restart' }, 'puzzle');
    }
    const value = await snapshot();
    if (fresh && (value.moves !== 0 || Object.keys(value.placements).length || value.status !== 'active')) throw new Error('Fresh attempt was not reset');
    return value;
  };
  const solution = piece => ({ q: piece.targetCells[0].q - piece.cells[0].q, r: piece.targetCells[0].r - piece.cells[0].r });
  const drag = async (piece, translation, { unchanged = false, outside = false } = {}) => {
    const before = await snapshot();
    const locations = await page.evaluate(({ id, translation, outside }) => {
      const t = window.__play;
      return { from: t.piecePoint(id), to: outside ? { x: 10, y: window.innerHeight - 10 } : t.targetPoint(id, translation) };
    }, { id: piece.id, translation, outside });
    inside(locations.from); inside(locations.to);
    await page.mouse.move(locations.from.x, locations.from.y); await page.mouse.down();
    await page.mouse.move(locations.to.x, locations.to.y, { steps: 12 }); await frames(2);
    await page.mouse.up(); await frames(5);
    const after = await snapshot();
    if (unchanged) await assertUnchanged(before, 'No-op/illegal pointer drop changed rules');
    else if (after.attemptId !== before.attemptId || after.moves !== before.moves + 1) throw new Error('Real drag did not commit exactly one move: ' + JSON.stringify({ piece: piece.id, before, after, locations }));
    if (!unchanged && !outside) {
      const placed = after.placements[piece.id];
      if (!placed || placed.q !== translation.q || placed.r !== translation.r) throw new Error('Pointer drop committed a different cell than its visible candidate');
    }
    report.checks.push({ kind: 'real-drag', pieceId: piece.id, translation, outside, unchanged, beforeMoves: before.moves, afterMoves: after.moves, status: after.status, locations });
    return after;
  };

  progress('ordinary-lifecycle-and-pointer-semantics');
  const ordinary = samples[0];
  await enter(ordinary);
  const first = ordinary.pieces[0];
  await drag(first, solution(first));
  await drag(first, solution(first), { unchanged: true });
  const second = ordinary.pieces[1], occupied = first.targetCells[0];
  await drag(second, { q: occupied.q - second.cells[0].q, r: occupied.r - second.cells[0].r }, { unchanged: true });
  if (!ordinary.obstacleCells.length) throw new Error('Ordinary pointer-semantic fixture must contain a real obstacle');
  const obstacle = ordinary.obstacleCells[0];
  await drag(second, { q: obstacle.q - second.cells[0].q, r: obstacle.r - second.cells[0].r }, { unchanged: true });
  const held = await snapshot();
  for (const [open, route] of [['open:pause', 'pause'], ['help:puzzle', 'help-detail'], ['open:settings', 'settings']]) {
    await action(open, route); await action('close', 'puzzle'); await assertUnchanged(held, route + ' lost active attempt');
    report.checks.push({ kind: 'lifecycle-preservation', route, attemptId: held.attemptId, passed: true });
  }
  await action('open:confirmation-restart', 'confirmation'); await action('close', 'puzzle');
  await assertUnchanged(held, 'Cancelled restart changed active attempt');
  report.checks.push({ kind: 'restart-cancel', attemptId: held.attemptId, passed: true });
  await action('nav:mainline-map', 'mainline-map'); await enter(ordinary, false);
  await assertUnchanged(held, 'Map roundtrip lost placement/moves/attemptId');
  report.checks.push({ kind: 'lifecycle-preservation', route: 'mainline-map', attemptId: held.attemptId, passed: true });
  await click({ field: 'returnPieceButton' });
  const returned = await snapshot();
  if (returned.moves !== held.moves + 1 || Object.keys(returned.placements).length) throw new Error('Real return button failed to return selected/latest piece with one move');
  await click({ field: 'returnPieceButton' }); await assertUnchanged(returned, 'Empty return cost a move');
  await drag(first, solution(first)); await drag(first, solution(first), { outside: true });
  if (Object.keys((await snapshot()).placements).length) throw new Error('Outside-board drag failed to return placed piece');

  progress('native-multitouch-lifecycle-cancel');
  const touchBefore = await snapshot();
  const touchLocations = await page.evaluate(ids => { const t = window.__play; return ids.map(id => t.piecePoint(id)); }, ordinary.pieces.slice(0, 2).map(piece => piece.id));
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((point, id) => ({ ...point, id, radiusX: 1, radiusY: 1, force: 1 })) });
  await touch('touchStart', [touchLocations[0]]); await frames(2);
  await touch('touchStart', touchLocations); await frames(2);
  await touch('touchMove', touchLocations.map(point => ({ x: point.x + 12, y: point.y - 12 }))); await frames(2);
  await page.evaluate(id => {
    const t = window.__play;
    t.check(t.boot.currentPuzzleController.draggingPieceId === id, 'Second pointer stole or cancelled the first pointer');
  }, first.id);
  await action('open:pause', 'pause');
  await page.evaluate(() => {
    const t = window.__play;
    t.check(t.boot.currentPuzzleController.draggingPieceId === null, 'Pause did not clear multitouch drag');
  });
  await touch('touchEnd', []); await action('close', 'puzzle');
  await assertUnchanged(touchBefore, 'Multitouch lifecycle cancellation committed or lost a piece');
  report.checks.push({ kind: 'multitouch-lifecycle-cancel', attemptId: touchBefore.attemptId,
    pointerSource: 'chrome-cdp', cancellationSource: 'pause-lifecycle', draggingCleared: true, unchanged: true, passed: true });

  progress('synthetic-dom-touchcancel-engine-branch');
  const domCancelBefore = await snapshot();
  const domPoint = await page.evaluate(id => window.__play.piecePoint(id), first.id);
  await touch('touchStart', [domPoint]); await frames(2);
  const domEvidence = await page.evaluate(({ point, id }) => {
    const t = window.__play, canvas = document.getElementById('GameCanvas');
    t.check(t.boot.currentPuzzleController.draggingPieceId === id, 'DOM cancel branch requires an active real CDP touch');
    const changed = new Touch({ identifier: 0, target: canvas, clientX: point.x, clientY: point.y,
      pageX: point.x, pageY: point.y, screenX: point.x, screenY: point.y, radiusX: 1, radiusY: 1, force: 1 });
    const event = new TouchEvent('touchcancel', { bubbles: true, cancelable: true, changedTouches: [changed], touches: [], targetTouches: [] });
    canvas.dispatchEvent(event);
    t.check(t.boot.currentPuzzleController.draggingPieceId === null, 'Engine DOM cancel input did not clear the active drag');
    t.check(!event.isTrusted && event.cancelable && event.defaultPrevented, 'Synthetic DOM cancellation evidence is inaccurate');
    return { isTrusted: event.isTrusted, cancelable: event.cancelable, defaultPrevented: event.defaultPrevented };
  }, { point: domPoint, id: first.id });
  await touch('touchEnd', []); await frames(4);
  await assertUnchanged(domCancelBefore, 'Synthetic DOM touchcancel branch committed or lost a piece');
  report.checks.push({ kind: 'synthetic-dom-touchcancel', ...domEvidence, pointerSource: 'chrome-cdp',
    cancellationSource: 'synthetic-dom-event-through-creator-input', unchanged: true, passed: true });
  await cdp.detach();
  const afterCancellation = await drag(first, solution(first));
  await click({ field: 'returnPieceButton' });
  const afterCancellationReturn = await snapshot();
  if (afterCancellationReturn.moves !== afterCancellation.moves + 1 || Object.keys(afterCancellationReturn.placements).length)
    throw new Error('Single-pointer input did not recover after both cancellation mechanisms');
  report.checks.push({ kind: 'post-cancel-single-pointer', pointerSource: 'playwright-mouse', passed: true });

  progress('overlay-interrupts-active-drag');
  const modalBefore = await snapshot(), modalPoint = await page.evaluate(id => window.__play.piecePoint(id), first.id);
  await page.mouse.move(modalPoint.x, modalPoint.y); await page.mouse.down();
  await page.mouse.move(modalPoint.x, modalPoint.y - 25, { steps: 3 });
  await action('open:pause', 'pause'); await page.mouse.up(); await action('close', 'puzzle');
  await assertUnchanged(modalBefore, 'Opening an overlay during drag committed/lost a piece');
  report.checks.push({ kind: 'overlay-drag-cancel', attemptId: modalBefore.attemptId, passed: true });

  progress('resize-interrupts-active-drag');
  const resizeBefore = await snapshot(), resizePoint = await page.evaluate(id => window.__play.piecePoint(id), first.id);
  await page.mouse.move(resizePoint.x, resizePoint.y); await page.mouse.down();
  await page.mouse.move(resizePoint.x, resizePoint.y - 25, { steps: 3 });
  await page.setViewportSize(sizes[1]); await frames(5); await page.mouse.up(); await frames(3);
  await assertUnchanged(resizeBefore, 'Resize during drag changed attempt');
  report.checks.push({ kind: 'resize-drag-cancel', attemptId: resizeBefore.attemptId, passed: true });

  progress('four-viewports-real-source-solutions');
  for (const viewport of sizes) {
    await page.setViewportSize(viewport);
    for (const level of samples) {
      await enter(level);
      const start = await snapshot();
      for (const piece of level.pieces.slice(0, -1)) await drag(piece, solution(piece));
      const prefix = `${viewport.width}x${viewport.height}-${level.pieces.length}-pieces-${level.id}`;
      const playingFile = `${prefix}-playing.png`;
      await page.screenshot({ path: path.join(output, playingFile) });
      const playing = await snapshot();
      await drag(level.pieces.at(-1), solution(level.pieces.at(-1)));
      const completed = await snapshot();
      if (completed.status !== 'completed' || Object.keys(completed.placements).length !== level.pieces.length || completed.moves !== level.pieces.length)
        throw new Error('Real source solution did not complete: ' + JSON.stringify(completed));
      await page.evaluate(async () => { const t = window.__play; await t.until(() => !t.boot.navigating && t.boot.currentRoute !== 'puzzle', 'rule-driven success UI'); });
      const file = `${prefix}-completed.png`;
      await page.screenshot({ path: path.join(output, file) });
      report.screenshots.push({ ...viewport, id: level.id, pieceCount: level.pieces.length, file: playingFile, outcomeFile: file,
        stage: 'before-final-placement', outcomeStage: 'completed-result',
        attemptId: start.attemptId, playing, final: completed, pointerCompleted: true });
      const terminal = await snapshot(); await frames(10); await assertUnchanged(terminal, 'Terminal session changed without a new attempt');
      const overlays = await page.evaluate(() => window.__play.boot.overlayCount);
      if (overlays > 1) throw new Error('One completion produced repeated outcome overlays');
      await action('nav:mainline-map', 'mainline-map');
    }
  }

  progress('challenge-last-allowed-move-success');
  const finalMoveLevel = catalog.levels.find(level => level.mode === 'challenge' && level.mainlineNumber !== null && level.moveLimit === level.pieces.length + 2);
  if (!finalMoveLevel) throw new Error('No source challenge with a two-move allowance');
  await enter(finalMoveLevel);
  const challengeFirst = finalMoveLevel.pieces[0];
  await drag(challengeFirst, solution(challengeFirst)); await click({ field: 'returnPieceButton' });
  for (const piece of finalMoveLevel.pieces) await drag(piece, solution(piece));
  report.lastMove = await snapshot();
  if (report.lastMove.status !== 'completed' || report.lastMove.moves !== finalMoveLevel.moveLimit) throw new Error('Last allowed move did not prioritize completion');
  await action('nav:mainline-map', 'mainline-map');

  progress('challenge-exhaustion-and-free-retry');
  const failureLevel = catalog.levels.find(level => level.mode === 'challenge' && level.mainlineNumber !== null && level.moveLimit % 2 === 1);
  await enter(failureLevel);
  const failureFirst = failureLevel.pieces[0];
  while ((await snapshot()).moves < failureLevel.moveLimit) {
    await drag(failureFirst, solution(failureFirst));
    if ((await snapshot()).status === 'active') await click({ field: 'returnPieceButton' });
  }
  report.exhaustion = await snapshot();
  if (report.exhaustion.status !== 'failed' || report.exhaustion.moves !== failureLevel.moveLimit || Object.keys(report.exhaustion.placements).length !== 1) throw new Error('Incomplete challenge did not fail at its actual move limit');
  await page.evaluate(async () => { const t = window.__play; await t.until(() => !t.boot.navigating && t.boot.currentRoute === 'challenge-fail', 'rule-driven challenge failure'); });
  const terminal = await snapshot();
  await drag(failureLevel.pieces[1], solution(failureLevel.pieces[1]), { unchanged: true });
  await frames(10); await assertUnchanged(terminal, 'Failed session changed after terminal notification');
  if (await page.evaluate(() => window.__play.boot.overlayCount) !== 1) throw new Error('Failure must produce exactly one outcome overlay');
  await page.screenshot({ path: path.join(output, 'challenge-exhausted.png') });
  report.screenshots.push({ ...page.viewportSize(), id: failureLevel.id, file: 'challenge-exhausted.png', stage: 'failed-result', final: terminal, pointerCompleted: true });
  await click({ action: 'play:retry' }, 'puzzle');
  report.retry = await snapshot();
  if (report.retry.attemptId === terminal.attemptId || report.retry.moves !== 0 || report.retry.status !== 'active' || Object.keys(report.retry.placements).length) throw new Error('Free retry did not create exactly one clean attempt');

  progress('scope-ownership-and-no-player-save');
  await action('nav:mainline-map', 'mainline-map'); await frames(10);
  report.resources = await page.evaluate(() => {
    const t = window.__play, scopes = [...new Set(t.scopes)], owned = scopes.filter(scope => !scope.isReleased);
    t.check(owned.length === 2 && owned.includes(t.boot.catalogScope) && owned.includes(t.boot.currentView.resourceScope), 'Only map and catalog scopes may remain');
    t.check(t.boot.host.pageLayer.children.length === 1 && t.boot.host.dialogLayer.children.length === 0 && t.boot.host.guideLayer.children.length === 0, 'Old views survived navigation');
    t.check(window.__storageWrites.length === 0, 'Gameplay wrote localStorage: ' + JSON.stringify(window.__storageWrites));
    return { createdScopes: scopes.length, releasedScopes: scopes.filter(scope => scope.isReleased).length, activeScopes: owned.length,
      ownership: ['current-map', 'boot-level-catalog'], localStorageWrites: window.__storageWrites };
  });
  if (report.errors.length || report.failedResources.length) throw new Error(`Native errors=${report.errors.length}; failed resources=${report.failedResources.length}`);
  report.status = 'PASS';
} catch (failure) {
  report.status = 'FAIL'; report.failure = String(failure.stack || failure); process.exitCode = 1; console.error(report.failure);
  if (page) {
    report.failureDetails = await page.evaluate(() => {
      const t = window.__play;
      return t ? { route: t.boot.currentRoute, selectedId: t.boot.selectedLevelId, snapshot: t.boot.activeAttempt, storageWrites: window.__storageWrites }
        : { helpersReady: false };
    }).catch(error => ({ diagnosticError: String(error) }));
    await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  }
} finally {
  if (browser) await browser.close();
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, phase: report.phase, screenshots: report.screenshots.length, errors: report.errors.length, report: path.join(output, 'report.json') }));
}
