import { _decorator, AudioClip, Button, Color, Component, instantiate, JsonAsset, Label, Node, Prefab, ResolutionPolicy, resources, SpriteFrame, tween, UITransform, UIOpacity, Vec3, view } from 'cc';
import { AudioService } from '../audio/AudioService';
import { GameSettingsService } from '../audio/GameSettingsService';
import type { LevelCatalog, LevelData, LevelMapDefinition } from '../data/LevelTypes';
import { SaveService, type StorageLike } from '../data/SaveService';
import { GameplayView } from '../gameplay/GameplayView';
import { createButton, createLabel, createPanel } from '../ui/UiFactory';
import { clampPage, levelButtonState, nextLevelIndex, pageCount, pageLevelIndices, PageFlow, type AppRoute } from './PageFlow';

const { ccclass } = _decorator;
const UI_LAYER = 1 << 25;

interface ResponsiveNodeState {
  node: Node;
  position: Vec3;
  scale: Vec3;
  verticalFactor: number;
}

interface ResponsivePageState {
  background: ResponsiveNodeState | null;
  nodes: ResponsiveNodeState[];
}

interface ResponsiveRegistration {
  node: Node;
  verticalFactor: number;
}

function loadResource<T>(path: string, type: new (...args: never[]) => T): Promise<T> {
  return new Promise((resolve, reject) => resources.load(path, type as never, (error, asset) => {
    if (error) {
      console.error(`[GameApp][resource:error] ${path}`, error);
      reject(error);
      return;
    }
    console.log(`[GameApp][resource:ok] ${path}`);
    resolve(asset as T);
  }));
}

function trace(stage: string, detail?: unknown): void {
  if (detail === undefined) console.log(`[GameApp][${stage}]`);
  else console.log(`[GameApp][${stage}]`, detail);
}

function browserStorage(): StorageLike {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

@ccclass('GameApp')
export class GameApp extends Component {
  private readonly flow = new PageFlow();
  private readonly save = new SaveService(browserStorage());
  private readonly settings = new GameSettingsService(browserStorage());
  private currentPage: Node | null = null;
  private gameplay: GameplayView | null = null;
  private catalog: LevelCatalog | null = null;
  private frames = new Map<string, SpriteFrame>();
  private readonly levels = new Map<string, LevelData[]>();
  private transitioning = false;
  private audio: AudioService | null = null;
  private homePrefab: Prefab | null = null;
  private levelPrefab: Prefab | null = null;
  private gameplayPrefab: Prefab | null = null;
  private readonly levelItemPrefabs = new Map<'locked' | 'available' | 'completed', Prefab>();
  private winPrefab: Prefab | null = null;
  private readonly responsivePages = new WeakMap<Node, ResponsivePageState>();
  private readonly handleCanvasResize = (): void => { this.alignPage(this.currentPage); };

  protected async start(): Promise<void> {
    trace('start', { node: this.node.name, active: this.node.activeInHierarchy });
    view.setDesignResolutionSize(720, 1280, ResolutionPolicy.FIXED_WIDTH);
    view.on('canvas-resize', this.handleCanvasResize, this);
    this.node.layer = UI_LAYER;
    this.node.getComponent(UITransform)?.setContentSize(720, 1280);
    trace('load:begin');
    try {
      const [catalogAsset, frames, music, win, homePrefab, levelPrefab, gameplayPrefab, lockedPrefab, availablePrefab, completedPrefab, winPrefab] = await Promise.all([
        loadResource('data/catalog', JsonAsset),
        Promise.all(Array.from({ length: 18 }, (_, index) => loadResource(`gameplay/tiles/${index + 1}/spriteFrame`, SpriteFrame))),
        loadResource('audio/music', AudioClip),
        loadResource('audio/win', AudioClip),
        loadResource('prefabs/pages/HomePage', Prefab),
        loadResource('prefabs/pages/LevelPage', Prefab),
        loadResource('prefabs/pages/GameplayPage', Prefab),
        loadResource('prefabs/items/LevelLocked', Prefab),
        loadResource('prefabs/items/LevelAvailable', Prefab),
        loadResource('prefabs/items/LevelCompleted', Prefab),
        loadResource('prefabs/items/WinOverlay', Prefab),
      ]);
      this.catalog = catalogAsset.json as LevelCatalog;
      this.frames = new Map(frames.map((frame, index) => [`${index + 1}_png`, frame]));
      this.audio = new AudioService(this.node, music, win, this.settings);
      this.homePrefab = homePrefab;
      this.levelPrefab = levelPrefab;
      this.gameplayPrefab = gameplayPrefab;
      this.levelItemPrefabs.set('locked', lockedPrefab);
      this.levelItemPrefabs.set('available', availablePrefab);
      this.levelItemPrefabs.set('completed', completedPrefab);
      this.winPrefab = winPrefab;
      trace('load:complete', {
        catalog: Boolean(this.catalog), tileFrames: this.frames.size, homePrefab: Boolean(this.homePrefab),
        levelPrefab: Boolean(this.levelPrefab), gameplayPrefab: Boolean(this.gameplayPrefab),
        levelItemPrefabs: this.levelItemPrefabs.size, winPrefab: Boolean(this.winPrefab),
      });
      trace('initial-render:begin', this.flow.current);
      await this.render(this.flow.current, false);
      trace('initial-render:complete', { page: this.currentPage?.name, childCount: this.node.children.length });
    } catch (error) {
      console.error('[GameApp] Failed to load application resources', error);
      console.error('[GameApp][startup:error-stack]', error instanceof Error ? error.stack : error);
      this.showFatalError();
    }
  }

  protected onDestroy(): void {
    view.off('canvas-resize', this.handleCanvasResize, this);
    this.audio?.destroy();
  }

  private maps(): LevelMapDefinition[] {
    const maps: LevelMapDefinition[] = [];
    for (const category of this.catalog?.categories ?? []) maps.push(...category.maps);
    return maps;
  }

  private map(mapId: string): LevelMapDefinition {
    const definition = this.maps().find((candidate) => candidate.id === mapId);
    if (!definition) throw new Error(`Unknown map: ${mapId}`);
    return definition;
  }

  private async mapLevels(mapId: string): Promise<LevelData[]> {
    const cached = this.levels.get(mapId);
    if (cached) return cached;
    const asset = await loadResource(this.map(mapId).resource, JsonAsset);
    const levels = asset.json as LevelData[];
    this.levels.set(mapId, levels);
    return levels;
  }

  private async navigate(route: AppRoute, mode: 'push' | 'replace' = 'push'): Promise<void> {
    if (this.transitioning) return;
    const previous = this.flow.current;
    if (mode === 'replace') this.flow.replace(route);
    else this.flow.push(route);
    if (!await this.render(this.flow.current)) {
      if (mode === 'replace') this.flow.replace(previous);
      else this.flow.back();
    }
  }

  private async back(): Promise<void> {
    if (this.transitioning) return;
    const previous = this.flow.current;
    if (!await this.render(this.flow.back())) this.flow.push(previous);
  }

  private async render(route: AppRoute, animate = true): Promise<boolean> {
    trace('render:begin', { route, animate, previousPage: this.currentPage?.name ?? null });
    this.transitioning = true;
    const previousPage = this.currentPage;
    const previousGameplay = this.gameplay;
    let page: Node;
    try {
      page = await this.createPage(route);
    } catch (error) {
      console.error('[GameApp] Failed to create page', error);
      console.error('[GameApp][render:error-stack]', error instanceof Error ? error.stack : error);
      this.transitioning = false;
      return false;
    }
    const nextGameplay = this.gameplay !== previousGameplay ? this.gameplay : null;
    if (previousGameplay) previousGameplay.destroy();
    else previousPage?.destroy();
    this.gameplay = nextGameplay;
    page.setParent(this.node);
    this.currentPage = page;
    const targetPosition = this.pagePosition();
    page.setPosition(targetPosition);
    this.layoutResponsivePage(page);
    trace('render:mounted', { page: page.name, parent: page.parent?.name, active: page.activeInHierarchy, childCount: page.children.length });
    if (animate) {
      const opacity = page.addComponent(UIOpacity);
      opacity.opacity = 0;
      page.setPosition(targetPosition.x + 24, targetPosition.y, targetPosition.z);
      tween(opacity).to(0.16, { opacity: 255 }).start();
      tween(page).to(0.16, { position: targetPosition }).call(() => { this.transitioning = false; }).start();
    } else {
      this.transitioning = false;
    }
    return true;
  }

  private pagePosition(): Vec3 {
    const visibleHeight = view.getVisibleSize().height;
    return new Vec3(0, Math.max(0, (visibleHeight - 1280) / 2), 0);
  }

  private alignPage(page: Node | null): void {
    if (!page) return;
    page.setPosition(this.pagePosition());
    this.layoutResponsivePage(page);
  }

  private registerResponsivePage(page: Node, registrations: ResponsiveRegistration[]): void {
    const stateFor = (node: Node, verticalFactor: number): ResponsiveNodeState => ({
      node,
      position: node.position.clone(),
      scale: node.scale.clone(),
      verticalFactor,
    });
    const background = findNode(page, 'background');
    this.responsivePages.set(page, {
      background: background ? stateFor(background, 0.5) : null,
      nodes: registrations.map(({ node, verticalFactor }) => stateFor(node, verticalFactor)),
    });
  }

  private layoutResponsivePage(page: Node): void {
    const state = this.responsivePages.get(page);
    if (!state) return;
    const visibleHeight = Math.max(1280, view.getVisibleSize().height);
    const extraHeight = visibleHeight - 1280;
    if (state.background) {
      const coverScale = Math.max(1, visibleHeight / 1280);
      const { node, position, scale } = state.background;
      node.setPosition(position.x, position.y - extraHeight / 2, position.z);
      node.setScale(scale.x * coverScale, scale.y * coverScale, scale.z);
    }
    for (const { node, position, scale, verticalFactor } of state.nodes) {
      node.setPosition(position.x, position.y - extraHeight * verticalFactor, position.z);
      node.setScale(scale);
    }
    if (this.gameplay?.node === page) this.gameplay.layoutResponsive(visibleHeight);
  }

  private async createPage(route: AppRoute): Promise<Node> {
    if (route.name === 'home') return this.createHomePage();
    if (route.name === 'maps') return this.createMapPage();
    if (route.name === 'levels') return this.createLevelPage(route.mapId, route.page);
    return this.createGameplayPage(route.mapId, route.levelIndex);
  }

  private pageRoot(name: string, title: string): Node {
    const root = createPanel(name, 720, 1280, new Color(13, 22, 29, 255));
    const heading = createLabel(`${name}Title`, title, 46, new Color(180, 237, 255, 255));
    heading.setParent(root);
    heading.setPosition(0, 535);
    return root;
  }

  private bind(node: Node, handler: () => void): void {
    if (!node.getComponent(Button)) node.addComponent(Button);
    node.on(Node.EventType.TOUCH_END, handler, this);
  }

  private configureSoundButton(sound: Node): void {
    const update = (): void => {
      const enabled = this.settings.snapshot().musicEnabled;
      const onFrame = findNode(sound, 'i3676');
      const offFrame = findNode(sound, 'i3678');
      if (onFrame) onFrame.active = enabled;
      if (offFrame) offFrame.active = !enabled;
    };
    this.bind(sound, () => {
      this.settings.setSoundEnabled(!this.settings.snapshot().musicEnabled);
      this.audio?.applySettings();
      update();
    });
    update();
  }

  private createHomePage(): Node {
    trace('home:create:begin', { prefabLoaded: Boolean(this.homePrefab) });
    if (!this.homePrefab) throw new Error('HomePage Prefab is not loaded');
    const root = instantiate(this.homePrefab);
    trace('home:instantiated', { name: root.name, active: root.active, children: root.children.map((child) => child.name) });
    const play = findNode(root, 'play_btn');
    const sound = findNode(root, 's_btn');
    const block = findNode(root, 'block_mc');
    trace('home:contract', { play: Boolean(play), sound: Boolean(sound), block: Boolean(block) });
    if (!play || !sound || !block) throw new Error('HomePage Prefab node contract is incomplete');
    this.bind(play, () => { this.audio?.startMusic(); void this.navigate({ name: 'levels', mapId: 'novice', page: 0 }); });
    this.configureSoundButton(sound);
    block.children.forEach((child, index) => {
      const start = child.position.clone();
      const raised = new Vec3(start.x, start.y + 10 + index * 2, start.z);
      tween(child).to(0.9 + index * 0.05, { position: raised }).to(0.9 + index * 0.05, { position: start }).union().repeatForever().start();
    });
    this.registerResponsivePage(root, [
      { node: block, verticalFactor: 0.5 },
      { node: play, verticalFactor: 0.5 },
      { node: sound, verticalFactor: 1 },
    ]);
    trace('home:create:complete', { root: root.name, descendantsReady: true });
    return root;
  }

  private createMapPage(): Node {
    const root = this.pageRoot('MapPage', 'CHOOSE A MAP');
    const contentNodes: Node[] = [];
    this.maps().forEach((map, index) => {
      const completed = this.save.getMaxCompleted(map.id);
      const button = createButton(`Map-${map.id}`, `${map.name}\n${completed} / ${map.levelCount}`, 470, 150);
      const label = button.getChildByName(`Map-${map.id}-label`)?.getComponent(Label);
      if (label) label.lineHeight = 34;
      button.setParent(root); button.setPosition(0, 230 - index * 210);
      contentNodes.push(button);
      this.bind(button, () => { void this.navigate({ name: 'levels', mapId: map.id, page: 0 }); });
      const detail = createLabel(`${map.id}-description`, map.description, 20, new Color(173, 185, 193, 255));
      detail.setParent(root); detail.setPosition(0, 115 - index * 210);
      contentNodes.push(detail);
    });
    const back = createButton('MapBackButton', 'BACK', 180, 62); back.setParent(root); back.setPosition(0, -500);
    this.bind(back, () => { void this.back(); });
    this.registerResponsivePage(root, [
      ...contentNodes.map((node) => ({ node, verticalFactor: 0.5 })),
      { node: back, verticalFactor: 1 },
    ]);
    return root;
  }

  private createLevelPage(mapId: string, requestedPage: number): Node {
    if (!this.levelPrefab) throw new Error('LevelPage Prefab is not loaded');
    const map = this.map(mapId);
    const page = clampPage(requestedPage, map.levelCount);
    const root = instantiate(this.levelPrefab);
    const title = findNode(root, 'title_txt')?.getComponent(Label);
    const score = findNode(root, 'txt')?.getComponent(Label);
    const back = findNode(root, 'back_btn');
    const sound = findNode(root, 's_btn');
    const previous = findNode(root, 'l_btn');
    const next = findNode(root, 'r_btn');
    if (!title || !score || !back || !sound || !previous || !next) throw new Error('LevelPage Prefab node contract is incomplete');
    title.string = map.name;
    const moneyIcon = findNode(root, 'moneyIcon');
    if (moneyIcon) moneyIcon.setPosition(moneyIcon.position.x - 100, moneyIcon.position.y);
    const maxCompleted = this.save.getMaxCompleted(mapId);
    score.string = String(maxCompleted);
    const columns = [-234, -81, 72, 227];
    const rows = [290, 141, -8, -158, -308];
    const levelButtons: Node[] = [];
    for (const [slot, levelIndex] of pageLevelIndices(page, map.levelCount).entries()) {
      const column = slot % 4;
      const row = Math.floor(slot / 4);
      const state = levelButtonState(levelIndex, maxCompleted);
      const prefab = this.levelItemPrefabs.get(state);
      if (!prefab) throw new Error(`Level item Prefab is not loaded: ${state}`);
      const button = instantiate(prefab);
      button.name = `Level-${levelIndex + 1}`;
      button.setParent(root);
      button.setPosition(columns[column], rows[row]);
      levelButtons.push(button);
      const label = findNode(button, 'txt')?.getComponent(Label);
      if (label) label.string = String(levelIndex + 1);
      if (state === 'locked') {
        const labelNode = findNode(button, 'txt');
        if (labelNode) labelNode.active = false;
      }
      if (state !== 'locked') this.bind(button, () => { void this.navigate({ name: 'gameplay', mapId, levelIndex }); });
    }
    previous.active = page > 0;
    if (page > 0) this.bind(previous, () => { void this.navigate({ name: 'levels', mapId, page: page - 1 }, 'replace'); });
    next.active = page + 1 < pageCount(map.levelCount);
    if (page + 1 < pageCount(map.levelCount)) this.bind(next, () => { void this.navigate({ name: 'levels', mapId, page: page + 1 }, 'replace'); });
    this.bind(back, () => { void this.back(); });
    this.configureSoundButton(sound);
    this.registerResponsivePage(root, [
      ...levelButtons.map((node) => ({ node, verticalFactor: 0.5 })),
      { node: previous, verticalFactor: 0.5 },
      { node: next, verticalFactor: 0.5 },
      { node: back, verticalFactor: 1 },
      { node: sound, verticalFactor: 1 },
    ]);
    return root;
  }

  private async createGameplayPage(mapId: string, levelIndex: number): Promise<Node> {
    const map = this.map(mapId);
    const levels = await this.mapLevels(mapId);
    if (!this.save.canPlay(mapId, levelIndex) || !levels[levelIndex]) return this.createLevelPage(mapId, Math.floor(levelIndex / 20));
    if (!this.gameplayPrefab || !this.winPrefab) throw new Error('Gameplay Prefabs are not loaded');
    this.gameplay = new GameplayView(levels[levelIndex], this.frames, `Level - ${levelIndex + 1}`, this.save.snapshot().hints, this.gameplayPrefab, () => {
      const enabled = !this.settings.snapshot().musicEnabled;
      this.settings.setSoundEnabled(enabled);
      this.audio?.applySettings();
      return enabled;
    }, this.settings.snapshot().musicEnabled, this.winPrefab);
    this.gameplay.onBack = () => { void this.back(); };
    this.gameplay.onSolved = () => this.audio?.playWin();
    this.gameplay.onHintRequested = () => this.save.consumeHint();
    this.gameplay.onWin = () => {
      this.save.completeLevel(mapId, levelIndex);
      const next = nextLevelIndex(levelIndex, levels.length);
      if (next === null) void this.navigate({ name: 'levels', mapId, page: Math.floor(levelIndex / 20) }, 'replace');
      else void this.navigate({ name: 'gameplay', mapId, levelIndex: next }, 'replace');
    };
    const gameplayNodes = [
      { node: findNode(this.gameplay.node, 'trayBackground'), verticalFactor: 0.5 },
      { node: findNode(this.gameplay.node, 'back_btn'), verticalFactor: 1 },
      { node: findNode(this.gameplay.node, 'replay_btn'), verticalFactor: 1 },
      { node: findNode(this.gameplay.node, 's_btn'), verticalFactor: 1 },
      { node: findNode(this.gameplay.node, 'tip_btn'), verticalFactor: 1 },
    ].filter((item): item is ResponsiveRegistration => Boolean(item.node));
    this.registerResponsivePage(this.gameplay.node, gameplayNodes);
    return this.gameplay.node;
  }

  private showFatalError(): void {
    trace('fatal-page:show');
    this.currentPage?.destroy();
    const root = this.pageRoot('FatalErrorPage', 'LOAD FAILED');
    const message = createLabel('FatalErrorMessage', 'Game resources could not be loaded.', 24, new Color(255, 150, 150, 255));
    message.setParent(root); message.setPosition(0, 0);
    this.registerResponsivePage(root, [{ node: message, verticalFactor: 0.5 }]);
    root.setParent(this.node);
    this.currentPage = root;
  }
}

function findNode(root: Node, name: string): Node | null {
  if (root.name === name) return root;
  for (const child of root.children) {
    const found = findNode(child, name);
    if (found) return found;
  }
  return null;
}
