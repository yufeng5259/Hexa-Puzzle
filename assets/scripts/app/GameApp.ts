import { _decorator, AudioClip, Color, Component, game, Game, instantiate, JsonAsset, Node, Prefab, profiler, ResolutionPolicy, resources, SpriteFrame, tween, UITransform, UIOpacity, Vec3, view } from 'cc';
import { AudioService } from '../audio/AudioService';
import type { RewardedAdService } from '../ads/RewardedAdService';
import { createPlatformServices } from '../platform/PlatformServices';
import { RewardCoordinator, type RewardAttemptResult } from '../ads/RewardCoordinator';
import { GameSettingsService } from '../audio/GameSettingsService';
import type { LevelCatalog, LevelData, LevelMapDefinition } from '../data/LevelTypes';
import { LevelRepository } from '../data/LevelRepository';
import { SaveService, type LegacyLevelMap } from '../data/SaveService';
import type { AttemptSave, SaveData } from '../data/SaveTypes';
import { GameplaySession } from '../gameplay/GameplaySession';
import { GameplayView, type ResultAction } from '../gameplay/GameplayView';
import { I18nService, type I18nKey, type Locale } from '../i18n/I18nService';
import { createLabel, createPanel, findNodeByPath } from '../ui/UiFactory';
import { HomePageView } from '../ui/HomePageView';
import { LevelsPageView } from '../ui/LevelsPageView';
import { LoadingView } from '../ui/LoadingView';
import { PREFAB_CONTRACTS } from '../ui/PrefabContracts';
import { SettingsPanelView } from '../ui/SettingsPanelView';
import { ToastView } from '../ui/ToastView';
import { RewardHintDialogView, type RewardHintDialogState } from '../ui/RewardHintDialogView';
import { ChallengeFailureView } from '../ui/ChallengeFailureView';
import { LegacyRecordsView } from '../ui/LegacyRecordsView';
import { TopBarView } from '../ui/TopBarView';
import { compactNumber } from '../ui/UiNumbers';
import { WorldsPageView } from '../ui/WorldsPageView';
import { nodes as prefabNodes, setText } from '../ui/PrefabUi';
import { nextLevelIndex, PageFlow, type AppRoute } from './PageFlow';
import { resolveHomeCta } from './HomeCta';

const { ccclass } = _decorator;
const UI_LAYER = 1 << 25;
const MIN_LOADING_VISIBLE_MS = 1000;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

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

@ccclass('GameApp')
export class GameApp extends Component {
  private readonly flow = new PageFlow();
  private save!: SaveService;
  private readonly platformServices = createPlatformServices();
  private readonly settings = new GameSettingsService(this.platformServices.storage);
  private readonly i18n = new I18nService(this.settings.snapshot().locale);
  private currentPage: Node | null = null;
  private gameplay: GameplayView | null = null;
  private catalog: LevelCatalog | null = null;
  private frames = new Map<string, SpriteFrame>();
  private readonly repository = new LevelRepository(async (resource) => (await loadResource(resource, JsonAsset)).json);
  private transitioning = false;
  private audio: AudioService | null = null;
  private homePrefab: Prefab | null = null;
  private topBarPrefab: Prefab | null = null;
  private mapPrefab: Prefab | null = null;
  private levelPrefab: Prefab | null = null;
  private gameplayPrefab: Prefab | null = null;
  private cellPrefab: Prefab | null = null;
  private settingsPanelPrefab: Prefab | null = null;
  private winPrefab: Prefab | null = null;
  private toastPrefab: Prefab | null = null;
  private challengeFailurePrefab: Prefab | null = null;
  private legacyRecordsPrefab: Prefab | null = null;
  private failureView: ChallengeFailureView | null = null;
  private failureAttemptId: string | null = null;
  private rewardDialog: { node: Node; view: RewardHintDialogView; requestId: string | null } | null = null;
  private privacyActive = false;
  private rewardHintDialogPrefab: Prefab | null = null;
  private readonly rewardedAds: RewardedAdService = this.platformServices.rewardedAds;
  private rewardCoordinator: RewardCoordinator | null = null;
  private readonly rewardUnsubscribers: (() => void)[] = [];
  private adCovered = false;
  private loading: LoadingView | null = null;
  private gameLayer: Node | null = null;
  private settingLayer: Node | null = null;
  private deferredResources: Promise<void> | null = null;
  private deferredError: unknown = null;
  private booting = false;
  private readonly responsivePages = new WeakMap<Node, ResponsivePageState>();
  private readonly handleCanvasResize = (): void => {
    this.alignPage(this.currentPage);
    for (const overlay of this.settingLayer?.children ?? []) this.sizeOverlayMask(overlay);
  };
  private readonly handleForeground = (): void => { this.recoverRewards('foreground'); this.refreshDaily(); };
  private readonly refreshDaily = (): void => {
    if (this.save) this.currentPage?.getComponent(HomePageView)?.setDailyAvailable(this.save.canClaimDailyHint(this.localDate()));
  };

  protected async start(): Promise<void> {
    trace('start', { node: this.node.name, active: this.node.activeInHierarchy, platform: this.platformServices.platform });
    profiler.hideStats();
    view.setDesignResolutionSize(720, 1280, ResolutionPolicy.FIXED_WIDTH);
    view.on('canvas-resize', this.handleCanvasResize, this);
    game.on(Game.EVENT_SHOW, this.handleForeground, this);
    this.schedule(this.refreshDaily, 60);
    this.node.layer = UI_LAYER;
    this.node.getComponent(UITransform)?.setContentSize(720, 1280);
    this.gameLayer = this.node.getChildByName('GameLayer');
    this.settingLayer = this.node.getChildByName('SettingLayer');
    const loadingRoot = this.node.getChildByName('LoadingRoot');
    if (!this.gameLayer || !this.settingLayer || !loadingRoot) throw new Error('Main scene is missing GameLayer, SettingLayer, or LoadingRoot');
    this.loading = loadingRoot.getComponent(LoadingView) ?? loadingRoot.addComponent(LoadingView);
    this.loading.setup({
      locale: this.i18n.currentLocale,
      startText: this.t('loading.start'),
      retryText: this.t('loading.retry'),
      onRetry: () => { void this.bootstrap(); },
    });
    await this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    if (this.booting) return;
    this.booting = true;
    const loadingStartedAt = Date.now();
    this.loading?.prepareRetry();
    trace('load:begin');
    try {
      this.loading?.setProgress(0.12, this.t('loading.data'));
      const [catalogAsset, legacyMapAsset, homePrefab, topBarPrefab] = await Promise.all([
        loadResource('data/catalog', JsonAsset),
        loadResource('data/legacy-level-map', JsonAsset),
        loadResource('prefabs/pages/HomePage', Prefab),
        loadResource('prefabs/common/TopBar', Prefab),
      ]);
      this.catalog = catalogAsset.json as LevelCatalog;
      this.save = new SaveService(this.platformServices.storage, this.catalog, legacyMapAsset.json as LegacyLevelMap);
      this.configureRewardCoordinator();
      this.homePrefab = homePrefab;
      this.topBarPrefab = topBarPrefab;
      this.loading?.setProgress(0.55, this.t('loading.home'));
      this.deferredResources = this.loadDeferredResources();
      trace('initial-render:begin', this.flow.current);
      await this.render(this.flow.current, false);
      this.loading?.setProgress(1, this.t('loading.ready'));
      trace('initial-render:complete', { page: this.currentPage?.name, childCount: this.gameLayer.children.length });
      await delay(Math.max(0, MIN_LOADING_VISIBLE_MS - (Date.now() - loadingStartedAt)));
      await this.loading?.fadeOut();
    } catch (error) {
      console.error('[GameApp] Failed to load application resources', error);
      console.error('[GameApp][startup:error-stack]', error instanceof Error ? error.stack : error);
      this.loading?.showError(this.t('loading.failed'));
    } finally {
      this.booting = false;
    }
  }

  private async loadDeferredResources(): Promise<void> {
    this.deferredError = null;
    try {
      const [frames, boardFrames, music, win, mapPrefab, levelPrefab, gameplayPrefab, settingsPanelPrefab, winPrefab, toastPrefab, rewardHintDialogPrefab, challengeFailurePrefab, legacyRecordsPrefab, cellPrefab] = await Promise.all([
        Promise.all(Array.from({ length: 18 }, (_, index) => loadResource(`ui/toybox-v4/game/tiles/${index + 1}/spriteFrame`, SpriteFrame))),
        Promise.all([
          loadResource('ui/toybox-v4/game/board-empty/spriteFrame', SpriteFrame),
          loadResource('ui/toybox-v4/game/board-obstacle/spriteFrame', SpriteFrame),
          loadResource('ui/toybox-v4/game/board-preview/spriteFrame', SpriteFrame),
          loadResource('ui/toybox-v4/game/board-fill/spriteFrame', SpriteFrame),
        ]),
        loadResource('audio/music', AudioClip),
        loadResource('audio/win', AudioClip),
        loadResource('prefabs/pages/MapPage', Prefab),
        loadResource('prefabs/pages/LevelPage', Prefab),
        loadResource('prefabs/pages/GameplayPage', Prefab),
        loadResource('prefabs/items/SettingsPanel', Prefab),
        loadResource('prefabs/items/WinOverlay', Prefab),
        loadResource('prefabs/items/Toast', Prefab),
        loadResource('prefabs/items/RewardHintDialog', Prefab),
        loadResource('prefabs/items/ChallengeFailurePanel', Prefab),
        loadResource('prefabs/items/LegacyRecordsPanel', Prefab),
        loadResource('prefabs/items/CellVisual', Prefab),
      ]);
      this.frames = new Map(frames.map((frame, index) => [`${index + 1}_png`, frame]));
      this.frames.set('v3-board-empty', boardFrames[0]);
      this.frames.set('v3-board-obstacle', boardFrames[1]);
      this.frames.set('v3-board-preview', boardFrames[2]);
      this.frames.set('v3-board-boundary', boardFrames[3]);
      this.audio = new AudioService(this.node, music, win, this.settings);
      this.audio.setAdCovered(this.adCovered || this.rewardedAds.presentationActive);
      this.mapPrefab = mapPrefab;
      this.levelPrefab = levelPrefab;
      this.gameplayPrefab = gameplayPrefab;
      this.cellPrefab = cellPrefab;
      this.settingsPanelPrefab = settingsPanelPrefab;
      this.winPrefab = winPrefab;
      this.toastPrefab = toastPrefab;
      this.rewardHintDialogPrefab = rewardHintDialogPrefab;
      this.challengeFailurePrefab = challengeFailurePrefab;
      this.legacyRecordsPrefab = legacyRecordsPrefab;
      trace('load:deferred-complete', {
        catalog: Boolean(this.catalog), tileFrames: this.frames.size, homePrefab: Boolean(this.homePrefab),
        levelPrefab: Boolean(this.levelPrefab), gameplayPrefab: Boolean(this.gameplayPrefab),
        settingsPanelPrefab: Boolean(this.settingsPanelPrefab), winPrefab: Boolean(this.winPrefab),
        prefabContracts: PREFAB_CONTRACTS.length,
      });
    } catch (error) {
      this.deferredError = error;
      console.error('[GameApp] Deferred resources failed', error);
    }
  }

  private async ensureDeferredResources(): Promise<void> {
    if (!this.deferredResources) this.deferredResources = this.loadDeferredResources();
    await this.deferredResources;
    if (this.deferredError) {
      this.deferredResources = null;
      throw this.deferredError;
    }
  }

  protected onDestroy(): void {
    view.off('canvas-resize', this.handleCanvasResize, this);
    game.off(Game.EVENT_SHOW, this.handleForeground, this);
    this.disposeRewardCoordinator();
    this.audio?.destroy();
  }

  private configureRewardCoordinator(): void {
    this.disposeRewardCoordinator();
    this.rewardCoordinator = new RewardCoordinator(this.save, this.rewardedAds, (attempt) => this.validateRewardAttempt(attempt));
    this.rewardUnsubscribers.push(
      this.rewardCoordinator.onChange((save) => this.applyRewardedSave(save)),
      this.rewardCoordinator.onError((errorCode) => this.handleRewardError(errorCode)),
      this.rewardedAds.onPresentation((covered) => this.setAdCovered(covered)),
    );
    this.setAdCovered(this.rewardedAds.presentationActive);
    this.recoverRewards('startup');
  }

  private disposeRewardCoordinator(): void {
    for (const unsubscribe of this.rewardUnsubscribers.splice(0)) unsubscribe();
    this.rewardCoordinator?.dispose();
    this.rewardCoordinator = null;
    this.setAdCovered(false);
  }

  private recoverRewards(reason: 'startup' | 'foreground'): void {
    const coordinator = this.rewardCoordinator;
    if (!coordinator) return;
    void coordinator.recover()
      .then(() => {
        if (!this.node.isValid || coordinator !== this.rewardCoordinator) return;
        this.applyRewardedSave(this.save.snapshot());
      })
      .catch((error) => {
        if (!this.node.isValid || coordinator !== this.rewardCoordinator) return;
        console.error(`[GameApp] Reward recovery failed during ${reason}`, error);
      });
  }

  private setAdCovered(covered: boolean): void {
    this.adCovered = covered;
    const effective = covered || this.privacyActive;
    this.audio?.setAdCovered(effective);
    this.gameplay?.setAdCovered(effective);
    this.failureView?.setCovered(effective);
  }

  private applyRewardedSave(save: SaveData): void {
    this.gameplay?.applySavedAttempt(save.currentAttempt, save.hints);
    for (const bar of this.currentPage?.getComponentsInChildren(TopBarView) ?? []) bar.setHintCount(save.hints);
    if (this.currentPage) setText(this.currentPage, 'hint-inventory', compactNumber(save.hints));
    this.refreshDaily();
    if (this.failureView?.node.isValid && (save.currentAttempt?.attemptId !== this.failureAttemptId || save.currentAttempt.status !== 'failed')) {
      this.failureView.node.destroy();
      this.failureView = null;
      this.failureAttemptId = null;
    }
    const dialog = this.rewardDialog;
    if (dialog?.node.isValid && dialog.node.parent && dialog.requestId) {
      const terminal = save.rewards.terminal[dialog.requestId];
      if (terminal?.state === 'settled') dialog.view.setState('rewarded');
      else if (terminal?.state === 'closed_no_reward') dialog.view.setState('cancelled');
    }
  }

  private handleRewardError(errorCode: string): void {
    console.error('[GameApp] Reward flow error', errorCode);
    try { this.showToast(this.t('reward.error')); } catch { /* Toast assets may not be loaded during startup recovery. */ }
  }

  private async validateRewardAttempt(attempt: AttemptSave): Promise<boolean> {
    let map: LevelMapDefinition;
    try { map = this.map(attempt.mapId); }
    catch { return false; }
    const index = map.levelIds?.indexOf(attempt.levelId) ?? -1;
    if (index < 0) return false;
    const [levels, metadata] = await Promise.all([
      this.mapLevels(attempt.mapId),
      this.repository.getLevelMetadata(attempt.mapId, index),
    ]);
    if (!levels[index] || metadata.levelId !== attempt.levelId || metadata.contentVersion !== attempt.contentVersion) return false;
    try {
      new GameplaySession(levels[index], metadata, attempt);
      return true;
    } catch {
      return false;
    }
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
    return this.repository.getLevels(mapId);
  }

  private async navigate(route: AppRoute, mode: 'push' | 'replace' = 'push'): Promise<void> {
    if (this.transitioning || this.adCovered || this.privacyActive) return;
    this.clearOverlays();
    const previous = this.flow.current;
    if (mode === 'replace') this.flow.replace(route);
    else this.flow.push(route);
    if (!await this.render(this.flow.current)) {
      if (mode === 'replace') this.flow.replace(previous);
      else this.flow.back();
    }
  }

  private async back(): Promise<void> {
    if (this.transitioning || this.adCovered || this.privacyActive) return;
    this.clearOverlays();
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
    if (!this.gameLayer) throw new Error('GameLayer is unavailable');
    page.setParent(this.gameLayer);
    this.currentPage = page;
    page.setPosition(this.pagePosition());
    this.layoutResponsivePage(page);
    const targetPosition = page.position.clone();
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
    const background = findNodeByPath(page, 'background_root') ?? findNode(page, 'background');
    this.responsivePages.set(page, {
      background: background ? stateFor(background, 0.5) : null,
      nodes: registrations.map(({ node, verticalFactor }) => stateFor(node, verticalFactor)),
    });
  }

  private layoutResponsivePage(page: Node): void {
    if (prefabNodes(page).some((node) => node.name.startsWith('view_'))) {
      const size = view.getVisibleSize();
      const cover = Math.max(1, size.width / 720, size.height / 1280);
      page.setPosition(0, 0, 0);
      for (const node of prefabNodes(page)) {
        if (node.name === 'img_background') node.setScale(cover, cover, 1);
      }
      return;
    }
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
    await this.ensureDeferredResources();
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

  private t(key: I18nKey, params: Record<string, string | number> = {}): string {
    return this.i18n.t(key, params);
  }

  private setLocale(locale: Locale): void {
    if (this.transitioning || this.adCovered || this.privacyActive) return;
    if (locale === this.i18n.currentLocale) return;
    this.settings.setLocale(locale);
    this.i18n.setLocale(locale);
    this.loading?.setLocale(locale);
    this.currentPage?.getComponent(HomePageView)?.setLocale(locale);
    this.currentPage?.getComponent(WorldsPageView)?.setLocale(locale);
    this.currentPage?.getComponent(LevelsPageView)?.setLocale(locale);
    this.gameplay?.setLocale(locale);
    this.settingLayer?.getChildByName('SettingsPanel')?.getComponent(SettingsPanelView)?.setLocale(locale);
  }

  private async showSettingsPanel(): Promise<void> {
    if (this.adCovered || this.privacyActive) return;
    try {
      await this.ensureDeferredResources();
    } catch (error) {
      console.error('[GameApp] Settings resources are unavailable', error);
      return;
    }
    if (this.adCovered || this.privacyActive) return;
    if (!this.settingsPanelPrefab || !this.settingLayer) throw new Error('SettingsPanel Prefab or SettingLayer is unavailable');
    this.clearOverlays();
    const overlay = instantiate(this.settingsPanelPrefab);
    overlay.name = 'SettingsPanel';
    overlay.setParent(this.settingLayer);
    overlay.setPosition(0, 0);
    this.sizeOverlayMask(overlay);
    const settingsView = overlay.addComponent(SettingsPanelView);
    await settingsView.setup({
      snapshot: () => this.settings.snapshot(),
      currentLocale: this.i18n.currentLocale,
      t: (key, params) => this.t(key, params),
      onClose: () => { overlay.destroy(); this.gameplay?.resume(); },
      onToggleMusic: () => {
        this.settings.setMusicEnabled(!this.settings.snapshot().musicEnabled);
        this.audio?.applySettings();
      },
      onToggleEffects: () => this.settings.setEffectsEnabled(!this.settings.snapshot().effectsEnabled),
      onToggleVibration: () => this.settings.setVibrationEnabled(!this.settings.snapshot().vibrationEnabled),
      onLocale: (locale) => this.setLocale(locale),
      privacyRequired: false,
      onPrivacy: async () => {
        if (this.privacyActive || this.rewardedAds.presentationActive || this.rewardCoordinator?.busy) return;
        this.privacyActive = true;
        this.setAdCovered(this.rewardedAds.presentationActive);
        try {
          if (!await this.rewardedAds.showPrivacyOptions()) this.showToast(this.t('reward.error'));
        } finally {
          this.privacyActive = false;
          this.setAdCovered(this.rewardedAds.presentationActive);
          if (overlay.isValid && overlay.parent) settingsView.setPrivacyRequired(await this.rewardedAds.getPrivacyOptionsRequired());
        }
      },
    });
    try {
      const required = await this.rewardedAds.getPrivacyOptionsRequired();
      if (overlay.isValid && overlay.parent) settingsView.setPrivacyRequired(required);
    } catch (error) { console.warn('[GameApp] Privacy availability query failed', error); }
  }

  private showToast(message: string): void {
    if (!this.settingLayer || !this.toastPrefab) return;
    this.settingLayer.getChildByName('Toast')?.destroy();
    const toast = instantiate(this.toastPrefab);
    toast.name = 'Toast';
    toast.setParent(this.settingLayer);
    toast.setPosition(0, -420);
    toast.addComponent(ToastView).setup(message, this.i18n.currentLocale);
    tween(toast).delay(1.5).call(() => toast.destroy()).start();
  }

  private clearOverlays(): void {
    this.settingLayer?.destroyAllChildren();
    this.rewardDialog = null;
    this.failureView = null;
    this.failureAttemptId = null;
  }

  private sizeOverlayMask(overlay: Node): void {
    const size = view.getVisibleSize();
    for (const node of prefabNodes(overlay)) {
      if (node.name === 'img_modal-shade' || node.name === 'mask') {
        node.getComponent(UITransform)?.setContentSize(Math.max(720, size.width), Math.max(1280, size.height));
      }
    }
  }

  private localDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${('0' + (now.getMonth() + 1)).slice(-2)}-${('0' + now.getDate()).slice(-2)}`;
  }

  private claimDailyHint(): boolean {
    try {
      const claimed = this.save.claimDailyHint(this.localDate());
      this.applyRewardedSave(this.save.snapshot());
      if (claimed) this.showToast(this.t('daily.received'));
      return claimed;
    } catch (error) {
      console.error('[GameApp] Daily hint was not saved', error);
      this.showToast(this.t('gameplay.saveFailed'));
      return false;
    }
  }

  private showLegacyRecords(): void {
    if (!this.settingLayer || !this.legacyRecordsPrefab || this.adCovered || this.privacyActive) return;
    this.clearOverlays();
    const overlay = instantiate(this.legacyRecordsPrefab);
    overlay.name = 'LegacyRecordsPanel';
    overlay.setParent(this.settingLayer);
    this.sizeOverlayMask(overlay);
    overlay.addComponent(LegacyRecordsView).setup({
      legacy: this.save.snapshot().legacy,
      locale: this.i18n.currentLocale,
      t: (key, params) => this.t(key, params),
      onClose: () => { overlay.destroy(); void this.showSettingsPanel(); },
    });
  }

  private showChallengeFailure(attempt: AttemptSave): void {
    const coordinator = this.rewardCoordinator;
    if (!this.settingLayer || !this.challengeFailurePrefab || !coordinator || this.gameplay?.attemptId !== attempt.attemptId) return;
    if (this.failureView?.node.isValid && this.failureView.node.parent && this.failureAttemptId === attempt.attemptId) return;
    this.clearOverlays();
    const overlay = instantiate(this.challengeFailurePrefab);
    overlay.name = 'ChallengeFailurePanel';
    overlay.setParent(this.settingLayer);
    this.sizeOverlayMask(overlay);
    const failure = overlay.addComponent(ChallengeFailureView);
    this.failureView = failure;
    this.failureAttemptId = attempt.attemptId;
    const alive = (): boolean => overlay.isValid && overlay.parent !== null && this.failureAttemptId === attempt.attemptId;
    failure.setup({
      locale: this.i18n.currentLocale,
      continuesUsed: attempt.continuesUsed,
      t: (key, params) => this.t(key, params),
      onReplay: () => { if (!this.adCovered && !this.privacyActive) this.gameplay?.reset(); },
      onLevels: () => {
        const map = this.map(attempt.mapId);
        const index = map.levelIds!.indexOf(attempt.levelId);
        void this.navigate({ name: 'levels', mapId: map.id, page: Math.floor(index / (map.pageSize ?? 20)) }, 'replace');
      },
      onContinue: () => {
        if (this.privacyActive || coordinator.busy) return;
        failure.setState('showing');
        void coordinator.request('challenge_continue', attempt.attemptId).then((result) => {
          if (!this.node.isValid || coordinator !== this.rewardCoordinator) return;
          this.applyRewardedSave(this.save.snapshot());
          if (alive()) failure.setState(this.rewardDialogStateFor(result), coordinator.availability('challenge_continue', attempt.attemptId).available);
        });
      },
    });
    failure.setCovered(this.adCovered || this.privacyActive);
    const availability = coordinator.availability('challenge_continue', attempt.attemptId);
    if (!availability.available) { failure.setState(availability.reason === 'awaiting_evidence' ? 'pending' : 'unavailable', false); return; }
    failure.setState('loading', true);
    void this.rewardedAds.prepare().then((state) => {
      if (alive()) failure.setState(state === 'ready' ? 'ready' : state === 'error' ? 'error' : 'unavailable', state === 'ready');
    }).catch(() => { if (alive()) failure.setState('error'); });
  }

  private async showRewardHintDialog(): Promise<void> {
    if (this.adCovered || this.privacyActive) return;
    const current = this.save.getCurrentAttempt();
    if (!current || current.status !== 'active' || current.puzzle.won || this.gameplay?.attemptId !== current.attemptId) return;
    if (!this.settingLayer || !this.rewardHintDialogPrefab) throw new Error('RewardHintDialog Prefab or SettingLayer is unavailable');
    this.clearOverlays();
    const dialog = instantiate(this.rewardHintDialogPrefab);
    dialog.name = 'RewardHintDialog';
    dialog.setParent(this.settingLayer);
    dialog.setPosition(0, 0);
    this.sizeOverlayMask(dialog);
    const viewComponent = dialog.addComponent(RewardHintDialogView);
    this.rewardDialog = { node: dialog, view: viewComponent, requestId: null };
    const attempt = this.save.getCurrentAttempt();
    const coordinator = this.rewardCoordinator;
    const alive = (): boolean => dialog.isValid && dialog.parent !== null;
    const applyState = (state: RewardHintDialogState): void => { if (alive()) viewComponent.setState(state); };
    const refreshReadiness = async (): Promise<void> => {
      if (!attempt || !coordinator) { applyState('unavailable'); return; }
      applyState('loading');
      try {
        const availability = coordinator.availability('hint_refill', attempt.attemptId);
        if (!availability.available) { applyState(availability.reason === 'awaiting_evidence' ? 'pending' : 'unavailable'); return; }
        const state = await this.rewardedAds.prepare();
        applyState(state === 'ready' ? 'ready' : state === 'error' ? 'error' : 'unavailable');
      } catch {
        applyState('error');
      }
    };
    viewComponent.setup({
      locale: this.i18n.currentLocale,
      remainingRefills: () => Math.max(0, 2 - (this.save.getCurrentAttempt()?.hintRefills ?? 0)),
      t: (key) => this.t(key),
      onClose: () => { dialog.destroy(); if (this.rewardDialog?.node === dialog) this.rewardDialog = null; },
      onWatch: () => {
        if (!attempt || !coordinator) { applyState('unavailable'); return; }
        if (!this.privacyActive) void this.requestRewardedHint(coordinator, attempt.attemptId, applyState, dialog);
      },
    });
    void refreshReadiness();
  }

  private async requestRewardedHint(coordinator: RewardCoordinator, attemptId: string, applyState: (state: RewardHintDialogState) => void, dialog: Node): Promise<void> {
    applyState('showing');
    const result = await coordinator.request('hint_refill', attemptId);
    if (!this.node.isValid || coordinator !== this.rewardCoordinator) return;
    if (this.rewardDialog?.node === dialog) this.rewardDialog.requestId = result.requestId ?? null;
    this.applyRewardedSave(this.save.snapshot());
    applyState(this.rewardDialogStateFor(result));
  }

  private rewardDialogStateFor(result: RewardAttemptResult): RewardHintDialogState {
    if (result.status === 'rewarded') return 'rewarded';
    if (result.status === 'pending' || result.status === 'busy') return 'pending';
    if (result.status === 'cancelled') return 'cancelled';
    if (result.status === 'unavailable') return 'unavailable';
    return 'error';
  }

  private async createHomePage(): Promise<Node> {
    trace('home:create:begin', { prefabLoaded: Boolean(this.homePrefab) });
    if (!this.homePrefab) throw new Error('HomePage Prefab is not loaded');
    const root = instantiate(this.homePrefab);
    trace('home:instantiated', { name: root.name, active: root.active, children: root.children.map((child) => child.name) });
    const cta = resolveHomeCta(this.save.snapshot(), this.catalog ?? { version: 1, categories: [] });
    await root.addComponent(HomePageView).setup({
      cta,
      hints: this.save.snapshot().hints,
      locale: this.i18n.currentLocale,
      t: (key, params) => this.t(key, params),
      onSettings: () => { void this.showSettingsPanel(); },
      onPlay: (route) => { void this.navigate(route).then(() => this.audio?.startMusic()); },
      onWorlds: () => { void this.navigate({ name: 'maps' }); },
      dailyAvailable: this.save.canClaimDailyHint(this.localDate()),
      onDaily: () => this.claimDailyHint(),
    });
    this.registerResponsivePage(root, []);
    trace('home:create:complete', { root: root.name, descendantsReady: true });
    return root;
  }

  private async createMapPage(): Promise<Node> {
    if (!this.mapPrefab) throw new Error('Map Prefab is not loaded');
    const root = instantiate(this.mapPrefab);
    await root.addComponent(WorldsPageView).setup({
      locale: this.i18n.currentLocale,
      maps: this.maps(),
      hints: this.save.snapshot().hints,
      completedFor: (mapId) => {
        const progress = this.save.snapshot().maps[mapId].levels;
        return Object.keys(progress).filter((id) => progress[id].completed).length;
      },
      t: (key, params) => this.t(key, params),
      onBack: () => { void this.back(); },
      onSettings: () => { void this.showSettingsPanel(); },
      onSelectWorld: (mapId) => { void this.navigate({ name: 'levels', mapId, page: 0 }); },
    });
    this.registerResponsivePage(root, []);
    return root;
  }

  private async createLevelPage(mapId: string, requestedPage: number): Promise<Node> {
    if (!this.levelPrefab) throw new Error('LevelPage Prefab is not loaded');
    const map = this.map(mapId);
    const root = instantiate(this.levelPrefab);
    await root.addComponent(LevelsPageView).setup({
      locale: this.i18n.currentLocale,
      map,
      mapId,
      requestedPage,
      maxCompleted: this.save.getMaxCompleted(mapId),
      save: this.save.snapshot(),
      hints: this.save.snapshot().hints,
      t: (key, params) => this.t(key, params),
      onBack: () => { void this.back(); },
      onSettings: () => { void this.showSettingsPanel(); },
      onPage: (page) => { void this.navigate({ name: 'levels', mapId, page }, 'replace'); },
      onSelectLevel: (levelIndex) => { void this.navigate({ name: 'gameplay', mapId, levelIndex }); },
    });
    this.registerResponsivePage(root, []);
    return root;
  }

  private async createGameplayPage(mapId: string, levelIndex: number): Promise<Node> {
    const map = this.map(mapId);
    const levels = await this.mapLevels(mapId);
    const pageSize = map.pageSize ?? 20;
    if (!this.save.canPlay(mapId, levelIndex) || !levels[levelIndex]) return this.createLevelPage(mapId, Math.floor(levelIndex / pageSize));
    if (!this.gameplayPrefab || !this.winPrefab || !this.topBarPrefab || !this.cellPrefab) throw new Error('Gameplay Prefabs are not loaded');
    const metadata = await this.repository.getLevelMetadata(mapId, levelIndex);
    let attempt = this.save.getCurrentAttempt();
    if (attempt?.mapId === mapId && attempt.levelId === metadata.levelId) {
      try { new GameplaySession(levels[levelIndex], metadata, attempt); }
      catch (error) {
        console.warn('[GameApp] Abandoning incompatible attempt', error);
        attempt = null;
      }
    } else attempt = null;
    if (!attempt) attempt = this.save.startAttempt({
      mapId, levelId: metadata.levelId, contentVersion: metadata.contentVersion,
      puzzle: new GameplaySession(levels[levelIndex], metadata).model.snapshot(),
    });
    this.gameplay = new GameplayView(
      levels[levelIndex],
      this.frames,
      this.t('win.level', { level: levelIndex + 1 }),
      this.save.snapshot().hints,
      this.gameplayPrefab,
      this.topBarPrefab,
      () => { void this.showSettingsPanel(); },
      this.winPrefab,
      (key, params) => this.t(key, params),
      metadata,
      attempt,
      this.i18n.currentLocale,
      this.cellPrefab,
    );
    this.gameplay.getResultProgress = () => ({
      completed: map.levelIds!.filter((id) => this.save.snapshot().maps[mapId].levels[id]?.completed).length,
      total: map.levelCount,
    });
    this.gameplay.onBack = () => { void this.back(); };
    this.gameplay.onSolved = () => this.audio?.playWin();
    this.gameplay.onAttemptChanged = (current) => this.save.saveAttempt(current);
    this.gameplay.onHintRequested = (current) => this.save.consumeHintForAttempt(current);
    this.gameplay.onHintUnavailable = () => { void this.showRewardHintDialog(); };
    this.gameplay.onStorageError = () => this.showToast(this.t('gameplay.saveFailed'));
    this.gameplay.onFailed = (current) => this.showChallengeFailure(current);
    this.gameplay.hasNextLevel = nextLevelIndex(levelIndex, levels.length) !== null;
    this.gameplay.onRestart = () => {
      if (this.transitioning) return;
      this.save.startAttempt({
        mapId, levelId: metadata.levelId, contentVersion: metadata.contentVersion,
        puzzle: new GameplaySession(levels[levelIndex], metadata).model.snapshot(),
      });
      void this.navigate({ name: 'gameplay', mapId, levelIndex }, 'replace');
    };
    let committed = false;
    this.gameplay.onCompleted = (completion) => {
      if (committed) return;
      this.save.completeLevel({
        mapId,
        levelIndex,
        attemptId: attempt!.attemptId,
        stars: completion.score.stars,
        moves: completion.stats.moves,
        errors: completion.stats.errors,
        hintsUsed: completion.stats.hintsUsed,
        continuesUsed: completion.continuesUsed,
      });
      committed = true;
    };
    this.gameplay.onWin = (_completion, action: ResultAction) => {
      const next = nextLevelIndex(levelIndex, levels.length);
      if (action === 'replay') void this.navigate({ name: 'gameplay', mapId, levelIndex }, 'replace');
      else if (action === 'levels' || next === null) void this.navigate({ name: 'levels', mapId, page: Math.floor(levelIndex / pageSize) }, 'replace');
      else void this.navigate({ name: 'gameplay', mapId, levelIndex: next }, 'replace');
    };
    this.gameplay.setAdCovered(this.adCovered || this.rewardedAds.presentationActive);
    this.registerResponsivePage(this.gameplay.node, []);
    this.gameplay.resume();
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
