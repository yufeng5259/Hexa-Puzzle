import { _decorator, Component, Mask, Node, resources, SpriteFrame, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { clampPage, pageCount, pageLevelIndices } from '../app/PageFlow';
import type { LevelMapDefinition } from '../data/LevelTypes';
import type { SaveData } from '../data/SaveService';
import type { I18nKey, Locale } from '../i18n/I18nService';
import { bindAction, findNode, nodes as prefabNodes, selectVariant, setActionEnabled, setImage, setLabelVisible, setText, setVisible } from './PrefabUi';
import { TopBarView } from './TopBarView';
const { ccclass } = _decorator;
function loadFrame(path: string): Promise<SpriteFrame> {
  return new Promise((resolve, reject) => resources.load(`ui/toybox-v4/${path}/spriteFrame`, SpriteFrame,
    (error, frame) => error ? reject(error) : resolve(frame)));
}
interface LevelFrames {
  completed: SpriteFrame; current: SpriteFrame; locked: SpriteFrame; gold: SpriteFrame; empty: SpriteFrame;
  previousEnabled: SpriteFrame; previousDisabled: SpriteFrame; nextEnabled: SpriteFrame; nextDisabled: SpriteFrame;
}
interface PositionLike { x: number; y: number; z: number; }
interface GridNodes { mask: Node; content: Node; slots: Node[]; }
export interface LevelsPageViewModel {
  map: LevelMapDefinition; mapId: string; requestedPage: number; maxCompleted: number; save: SaveData; hints: number; locale: Locale;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
  canChangePage?: () => boolean;
  onBack: () => void; onSettings: () => void; onPage: (page: number) => void; onSelectLevel: (levelIndex: number) => void;
}
@ccclass('LevelsPageView')
export class LevelsPageView extends Component {
  private model: LevelsPageViewModel | null = null;
  private root: Node | null = null;
  private page = 0;
  private challenge = false;
  private animatingPage = false;
  private transitionToken = 0;
  private frames: LevelFrames | null = null;
  private readonly tweenTargets = new Set<object>();
  private readonly authoredPositions = new WeakMap<Node, PositionLike>();
  private readonly grids = new WeakMap<Node, GridNodes>();
  private readonly pendingTweenResolves: Array<() => void> = [];
  public async setup(model: LevelsPageViewModel): Promise<Node[]> {
    this.model = model;
    const challenge = model.map.mode === 'challenge' || model.mapId === 'challenge';
    const pageSize = model.map.pageSize ?? (challenge ? 10 : 20);
    const page = clampPage(model.requestedPage, model.map.levelCount, pageSize);
    this.challenge = challenge;
    this.page = page;
    const root = selectVariant(this.node, challenge ? '04-challenge-levels' : '03-classic-levels', model.locale);
    this.root = root;
    this.prepareGrid(root);
    this.captureAuthoredPositions(root);
    (this.node.getComponent(TopBarView) ?? this.node.addComponent(TopBarView)).setup(model);
    const progress = model.save.maps[model.mapId];
    const levelIds = model.map.levelIds;
    if (!progress || !levelIds || levelIds.length !== model.map.levelCount) throw new Error(`Missing stable level IDs for map: ${model.mapId}`);
    const complete = levelIds.filter((id) => progress.levels[id]?.completed).length;
    setText(root, 'classic-progress', `${complete}/${model.map.levelCount}`);
    setText(root, 'group-progress', `${complete} / ${model.map.levelCount}`);
    this.frames = await this.loadFrames();
    this.renderPage(root, page);
    bindAction(root, 'previous', () => { void this.changePage(this.page - 1); });
    bindAction(root, 'next', () => { void this.changePage(this.page + 1); });
    bindAction(root, 'back', model.onBack);
    return [root];
  }
  public setLocale(locale: Locale): void {
    const model = this.model;
    if (!model) return;
    this.model = { ...model, locale };
    const root = selectVariant(this.node, this.challenge ? '04-challenge-levels' : '03-classic-levels', locale);
    this.root = root;
    this.captureAuthoredPositions(root);
    if (this.animatingPage) {
      this.updateGroupText(root, locale);
      return;
    }
    this.renderPage(root, this.page);
  }
  private async loadFrames(): Promise<LevelFrames> {
    if (this.frames) return this.frames;
    const [completed, current, locked, gold, empty, previousEnabled, previousDisabled, nextEnabled, nextDisabled] = await Promise.all([
      loadFrame('levels/completed'), loadFrame('levels/current'), loadFrame('levels/locked'),
      loadFrame('icons/star-gold'), loadFrame('icons/star-empty'),
      loadFrame('buttons/page-previous-enabled'), loadFrame('buttons/page-previous-disabled'),
      loadFrame('buttons/page-next'), loadFrame('buttons/page-next-disabled'),
    ]);
    this.frames = { completed, current, locked, gold, empty, previousEnabled, previousDisabled, nextEnabled, nextDisabled };
    return this.frames;
  }
  private renderPage(root: Node, page: number): void {
    const model = this.model;
    const frames = this.frames;
    if (!model || !frames) return;
    const challenge = this.challenge;
    const pageSize = model.map.pageSize ?? (challenge ? 10 : 20);
    const progress = model.save.maps[model.mapId];
    const levelIds = model.map.levelIds!;
    const pageLevels = pageLevelIndices(page, model.map.levelCount, pageSize);
    this.updateGroupText(root, model.locale);
    setText(root, 'page-indicator', `${page + 1}/${pageCount(model.map.levelCount, pageSize)}`);
    for (let slot = 0; slot < (challenge ? 10 : 20); slot += 1) {
      const id = `level-${('0' + (slot + 1)).slice(-2)}`;
      const levelIndex = pageLevels[slot];
      const exists = levelIndex !== undefined;
      const result = exists ? progress.levels[levelIds[levelIndex]] : undefined;
      const unlocked = exists && progress.unlockedLevelIds.indexOf(levelIds[levelIndex]) >= 0;
      setVisible(root, `img_${id}`, exists);
      setLabelVisible(root, `${id}-number`, exists, model.locale);
      setVisible(root, `img_${id}-lock`, exists && !unlocked);
      setVisible(root, `img_${id}-check`, exists && Boolean(result?.completed) && !challenge);
      setVisible(root, `hit_${id}`, exists);
      for (let star = 0; star < 3; star += 1) {
        setVisible(root, `img_${id}-star-${star}`, challenge && exists && Boolean(result?.completed));
        setImage(root, `${id}-star-${star}`, star < (result?.bestStars ?? 0) ? frames.gold : frames.empty);
      }
      if (!exists) continue;
      setText(root, `${id}-number`, String(levelIndex + 1));
      setImage(root, id, result?.completed ? frames.completed : unlocked ? frames.current : frames.locked);
      bindAction(root, id, () => { if (!this.animatingPage) model.onSelectLevel(levelIndex); });
      setActionEnabled(root, id, unlocked && !this.animatingPage);
    }
    setImage(root, 'page-previous', page > 0 ? frames.previousEnabled : frames.previousDisabled);
    setImage(root, 'page-next', page + 1 < pageCount(model.map.levelCount, pageSize) ? frames.nextEnabled : frames.nextDisabled);
    this.updatePageActions(root, page);
  }
  private async changePage(requestedPage: number): Promise<void> {
    const model = this.model;
    const root = this.root;
    if (!model || !root || this.animatingPage) return;
    if (model.canChangePage && !model.canChangePage()) return;
    const pageSize = model.map.pageSize ?? (this.challenge ? 10 : 20);
    const page = clampPage(requestedPage, model.map.levelCount, pageSize);
    if (page === this.page) return;
    const direction = page > this.page ? 1 : -1;
    this.animatingPage = true;
    const token = ++this.transitionToken;
    this.updatePageActions(root, this.page);
    await this.animateOut(root, direction);
    if (token !== this.transitionToken || !this.node?.isValid || !root.isValid) return;
    this.page = page;
    this.renderPage(root, page);
    model.onPage(page);
    await this.animateIn(root, direction);
    if (token !== this.transitionToken || !this.node?.isValid || !root.isValid) return;
    this.resetAnimatedNodes(root);
    this.animatingPage = false;
    this.renderPage(root, this.page);
  }
  protected onDestroy(): void {
    this.transitionToken += 1;
    this.animatingPage = false;
    // Creator destroys the view's children before this component. Stop tracked
    // targets directly; traversing their cleared child lists is no longer safe.
    for (const target of this.tweenTargets) Tween.stopAllByTarget(target);
    this.tweenTargets.clear();
    for (const resolve of this.pendingTweenResolves.splice(0)) resolve();
  }
  private updatePageActions(root: Node, page: number): void {
    const model = this.model;
    if (!model) return;
    const pageSize = model.map.pageSize ?? (this.challenge ? 10 : 20);
    const canInteract = !this.animatingPage;
    setActionEnabled(root, 'previous', canInteract && page > 0);
    setActionEnabled(root, 'next', canInteract && page + 1 < pageCount(model.map.levelCount, pageSize));
  }
  private updateGroupText(root: Node, locale: Locale): void {
    setText(root, 'group-title', locale === 'en' ? `Group ${this.page + 1}` : `第${['一', '二', '三'][this.page] ?? this.page + 1}组`);
    setText(root, 'group-rule', locale === 'en' ? `Pieces +${Math.max(1, 3 - this.page)} moves` : `拼块数 +${Math.max(1, 3 - this.page)} 步`);
  }
  private captureAuthoredPositions(root: Node): void {
    for (const node of prefabNodes(root)) if (!this.authoredPositions.has(node)) {
      const position = node.position ?? { x: 0, y: 0, z: 0 };
      this.authoredPositions.set(node, { x: position.x ?? 0, y: position.y ?? 0, z: position.z ?? 0 });
    }
  }
  private prepareGrid(root: Node): void {
    if (this.grids.has(root)) return;
    const slotCount = this.challenge ? 10 : 20;
    const roots = Array.from({ length: slotCount }, (_, slot) => findNode(root, `img_level-${('0' + (slot + 1)).slice(-2)}`))
      .filter((node): node is Node => Boolean(node));
    if (!roots.length) return;
    const bounds = this.gridBounds(roots);
    const mask = new Node('level-grid-mask');
    this.inheritLayer(mask, root);
    mask.setPosition(bounds.centerX, bounds.centerY, 0);
    mask.setParent(root);
    (mask.getComponent(UITransform) ?? mask.addComponent(UITransform)).setContentSize(bounds.width, bounds.height);
    if (Mask && !mask.getComponent(Mask)) mask.addComponent(Mask);
    const content = new Node('level-grid-content');
    this.inheritLayer(content, root);
    content.setPosition(-bounds.centerX, -bounds.centerY, 0);
    content.setParent(mask);
    const slots: Node[] = [];
    for (let slot = 0; slot < slotCount; slot += 1) {
      const group = new Node(`level-grid-slot-${('0' + (slot + 1)).slice(-2)}`);
      this.inheritLayer(group, root);
      group.setParent(content);
      for (const node of this.slotNodes(root, slot)) node.setParent(group);
      slots.push(group);
    }
    this.grids.set(root, { mask, content, slots });
    this.preparePageIndicator(root);
  }
  private preparePageIndicator(root: Node): void {
    if (findNode(root, 'page-indicator-mask')) return;
    const label = findNode(root, 'zh_page-indicator') ?? findNode(root, 'en_page-indicator');
    if (!label) return;
    const position = label.position;
    const size = label.getComponent(UITransform)?.contentSize ?? { width: 137, height: 49 };
    const mask = new Node('page-indicator-mask');
    this.inheritLayer(mask, root);
    mask.setPosition(position.x, position.y, position.z ?? 0);
    mask.setParent(root);
    (mask.getComponent(UITransform) ?? mask.addComponent(UITransform)).setContentSize(size.width, size.height);
    if (Mask && !mask.getComponent(Mask)) mask.addComponent(Mask);
    const content = new Node('page-indicator-content');
    this.inheritLayer(content, root);
    content.setPosition(-position.x, -position.y, -(position.z ?? 0));
    content.setParent(mask);
    for (const name of ['zh_page-indicator', 'en_page-indicator']) findNode(root, name)?.setParent(content);
  }
  private inheritLayer(node: Node, root: Node): void {
    node.layer = root.layer;
  }
  private gridBounds(roots: Node[]): { centerX: number; centerY: number; width: number; height: number } {
    let minX = Number.POSITIVE_INFINITY; let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY; let maxY = Number.NEGATIVE_INFINITY;
    for (const node of roots) {
      const position = node.position;
      const size = node.getComponent(UITransform)?.contentSize ?? { width: 130, height: 130 };
      minX = Math.min(minX, position.x - size.width / 2);
      maxX = Math.max(maxX, position.x + size.width / 2);
      minY = Math.min(minY, position.y - size.height / 2);
      maxY = Math.max(maxY, position.y + size.height / 2);
    }
    const margin = 30;
    return {
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      width: maxX - minX + margin * 2,
      height: maxY - minY + margin * 2,
    };
  }
  private slotNodes(root: Node, slot: number): Node[] {
    const id = `level-${('0' + (slot + 1)).slice(-2)}`;
    const names = [`img_${id}`, `zh_${id}-number`, `en_${id}-number`, `img_${id}-check`, `img_${id}-lock`, `hit_${id}`];
    for (let star = 0; star < 3; star += 1) names.push(`img_${id}-star-${star}`);
    return names.map((name) => findNode(root, name)).filter((node): node is Node => Boolean(node));
  }
  private pageNumberNodes(root: Node): Node[] {
    const content = findNode(root, 'page-indicator-content');
    return content ? [content] : [];
  }
  private columnFor(slot: number): number {
    return this.challenge ? slot % 2 : slot % 5;
  }
  private animatedNodes(root: Node): Node[] {
    const grid = this.grids.get(root);
    return [...(grid?.slots ?? []), ...this.pageNumberNodes(root)];
  }
  private setNodeOffset(node: Node, x: number, y = 0): void {
    const base = this.authoredPositions.get(node);
    if (base) node.setPosition(base.x + x, base.y + y, base.z);
  }
  private animateOut(root: Node, direction: number): Promise<void> {
    const travel = -direction * 140;
    const promises: Promise<void>[] = [];
    const grid = this.grids.get(root);
    for (const [slot, node] of (grid?.slots ?? []).entries()) {
      const delay = this.columnFor(slot) * 0.015;
      Tween.stopAllByTarget(node);
      const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
      Tween.stopAllByTarget(opacity);
      promises.push(this.play(node, tween(node).delay(delay).to(0.06, { position: this.offsetPosition(node, travel) })));
      promises.push(this.play(opacity, tween(opacity).delay(delay).to(0.06, { opacity: 0 })));
    }
    for (const node of this.pageNumberNodes(root)) {
      const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
      Tween.stopAllByTarget(node); Tween.stopAllByTarget(opacity);
      promises.push(this.play(node, tween(node).to(0.08, { position: this.offsetPosition(node, -direction * 24) })));
      promises.push(this.play(opacity, tween(opacity).to(0.08, { opacity: 0 })));
    }
    return Promise.all(promises).then(() => undefined);
  }
  private animateIn(root: Node, direction: number): Promise<void> {
    const travel = direction * 140;
    const promises: Promise<void>[] = [];
    const grid = this.grids.get(root);
    for (const [slot, node] of (grid?.slots ?? []).entries()) {
      const delay = this.columnFor(slot) * 0.015;
      Tween.stopAllByTarget(node);
      const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
      Tween.stopAllByTarget(opacity);
      this.setNodeOffset(node, travel);
      opacity.opacity = 0;
      promises.push(this.play(node, tween(node)
        .delay(delay)
        .to(0.12, { position: this.offsetPosition(node, -direction * 8) })
        .to(0.04, { position: this.basePosition(node) })));
      promises.push(this.play(opacity, tween(opacity).delay(delay).to(0.12, { opacity: 255 })));
    }
    for (const node of this.pageNumberNodes(root)) {
      const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
      Tween.stopAllByTarget(node); Tween.stopAllByTarget(opacity);
      this.setNodeOffset(node, direction * 28);
      opacity.opacity = 0;
      promises.push(this.play(node, tween(node).to(0.14, { position: this.basePosition(node) })));
      promises.push(this.play(opacity, tween(opacity).to(0.14, { opacity: 255 })));
    }
    return Promise.all(promises).then(() => undefined);
  }
  private resetAnimatedNodes(root: Node): void {
    for (const node of this.animatedNodes(root)) {
      if (!node.isValid) continue;
      Tween.stopAllByTarget(node);
      const opacity = node.getComponent(UIOpacity);
      if (opacity) { Tween.stopAllByTarget(opacity); opacity.opacity = 255; }
      const base = this.authoredPositions.get(node);
      if (base) node.setPosition(base.x, base.y, base.z);
    }
  }
  private basePosition(node: Node): Vec3 {
    const base = this.authoredPositions.get(node) ?? node.position;
    return new Vec3(base.x, base.y, base.z);
  }
  private offsetPosition(node: Node, x: number, y = 0): Vec3 {
    const base = this.authoredPositions.get(node) ?? node.position;
    return new Vec3(base.x + x, base.y + y, base.z);
  }
  private play<T extends object>(target: T, chain: ReturnType<typeof tween<T>>): Promise<void> {
    this.tweenTargets.add(target);
    return new Promise((resolve) => {
      const done = (): void => {
        this.tweenTargets.delete(target);
        const index = this.pendingTweenResolves.indexOf(done);
        if (index >= 0) this.pendingTweenResolves.splice(index, 1);
        resolve();
      };
      this.pendingTweenResolves.push(done);
      chain.call(done).start();
    });
  }
}
