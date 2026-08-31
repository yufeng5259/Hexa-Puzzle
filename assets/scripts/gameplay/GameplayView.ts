import { Button, EventTouch, instantiate, Label, Node, Prefab, Sprite, SpriteFrame, tween, Tween, UITransform, UIOpacity, Vec3 } from 'cc';
import type { LevelData } from '../data/LevelTypes';
import { DRAG_SCALE, TILE_HEIGHT, TILE_WIDTH, TRAY_SCALE } from '../data/LevelTypes';
import { gridToPoint2, nearestGrid, type GridCoord } from '../model/HexGrid';
import { isPointInFlatHexagon } from '../model/HexHitTest';
import { PuzzleModel, type PieceDefinition, type PlacementPreview } from '../model/PuzzleModel';

type DragState = 'idle' | 'pending' | 'dragging' | 'settling';

interface PieceView {
  definition: PieceDefinition;
  node: Node;
  home: Vec3;
  preview: PlacementPreview | null;
  dragState: DragState;
  touchId: number | null;
  touchStart: Vec3;
  touchStartUi: Vec3;
  grabOffset: Vec3;
  liftOffset: number;
}

const DRAG_SLOP = 12;
const MIN_LIFT = 90;
const MAX_LIFT = 150;
const PICKUP_TIME = 0.1;
const SNAP_TIME = 0.12;
const RETURN_TIME = 0.2;
const MAX_SNAP_DISTANCE = 36;
const PREVIEW_GRACE_DISTANCE = 16;

export class GameplayView {
  public readonly node = new Node('GameplayView');
  public onWin: (() => void) | null = null;
  public onSolved: (() => void) | null = null;
  public onBack: (() => void) | null = null;
  public onHintRequested: (() => boolean) | null = null;
  private readonly model: PuzzleModel;
  private readonly board = new Node('Board');
  private readonly tray = new Node('Tray');
  private readonly borderBackLayer = new Node('BorderBackLayer');
  private readonly textureLayer = new Node('TextureLayer');
  private readonly previewLayer = new Node('PlacementPreview');
  private readonly borderFrontLayer = new Node('BorderFrontLayer');
  private readonly pieceViews = new Map<string, PieceView>();
  private readonly targetNodes = new Map<string, Node>();
  private readonly boardScale = 0.82;
  private readonly boardOrigin = new Vec3(-328, 447, 0);
  private readonly trayOrigin = new Vec3(0, -230, 0);
  private hintButton: Node | null = null;
  private activeDrag: PieceView | null = null;
  private won = false;
  private visibleHeight = 1280;
  private winLayout: {
    overlay: Node;
    content: Node;
    background: Node | null;
    footer: Node | null;
    backgroundPosition: Vec3 | null;
    backgroundScale: Vec3 | null;
    footerPosition: Vec3 | null;
  } | null = null;

  public constructor(
    private readonly level: LevelData,
    private readonly frames: Map<string, SpriteFrame>,
    title: string,
    private hintCount: number,
    chromePrefab: Prefab,
    toggleSound: () => boolean,
    soundEnabled: boolean,
    private readonly winPrefab: Prefab,
  ) {
    this.model = new PuzzleModel(level);
    this.node.layer = 1 << 25;
    this.node.addComponent(UITransform).setContentSize(720, 1280);
    this.buildChrome(title, chromePrefab, toggleSound, soundEnabled);
    this.buildBoard();
    this.buildPieces();
  }

  private buildChrome(title: string, chromePrefab: Prefab, toggleSound: () => boolean, soundEnabled: boolean): void {
    const chrome = instantiate(chromePrefab);
    chrome.setParent(this.node);
    const heading = findNode(chrome, 'title_txt')?.getComponent(Label);
    const replay = findNode(chrome, 'replay_btn');
    const back = findNode(chrome, 'back_btn');
    const sound = findNode(chrome, 's_btn');
    this.hintButton = findNode(chrome, 'tip_btn');
    if (!heading || !replay || !back || !sound || !this.hintButton) throw new Error('GameplayPage Prefab node contract is incomplete');
    heading.string = title;
    this.bind(replay, () => this.reset());
    this.bind(back, () => this.onBack?.());
    const updateSound = (enabled: boolean): void => {
      const onFrame = findNode(sound, 'i3676');
      const offFrame = findNode(sound, 'i3678');
      if (onFrame) onFrame.active = enabled;
      if (offFrame) offFrame.active = !enabled;
    };
    this.bind(sound, () => updateSound(toggleSound()));
    updateSound(soundEnabled);
    this.bind(this.hintButton, () => this.requestHint());
    this.updateHintButton();
  }

  private bind(node: Node, handler: () => void): void {
    if (!node.getComponent(Button)) node.addComponent(Button);
    node.on(ButtonEvent(), handler);
  }

  private buildBoard(): void {
    this.board.layer = 1 << 25; this.board.setParent(this.node); this.board.setPosition(this.boardOrigin);
    this.board.addComponent(UITransform).setContentSize(560, 430);
    for (const layer of [this.borderBackLayer, this.textureLayer, this.previewLayer, this.borderFrontLayer]) {
      layer.layer = 1 << 25;
      layer.setParent(this.board);
    }
    for (const coord of this.model.targetCells) {
      const key = `${coord.tx},${coord.ty}`;
      const position = this.coordPosition(coord);
      const back = this.createBoardTexture('TargetBorderBack', '18_png');
      back.setParent(this.borderBackLayer); back.setPosition(position);
      const texture = this.createBoardTexture('TargetCell', '2_png');
      texture.setParent(this.textureLayer); texture.setPosition(position);
      const front = this.createBoardTexture('TargetBorderFront', '5_png');
      front.setParent(this.borderFrontLayer); front.setPosition(position);
      this.targetNodes.set(key, texture);
    }
    for (const coord of this.model.obstacleCells) {
      const position = this.coordPosition(coord);
      const back = this.createBoardTexture('ObstacleBorderBack', '18_png');
      back.setParent(this.borderBackLayer); back.setPosition(position);
      const texture = this.createBoardTexture('ObstacleCell', '4_png');
      texture.setParent(this.textureLayer); texture.setPosition(position);
      const front = this.createBoardTexture('ObstacleBorderFront', '5_png');
      front.setParent(this.borderFrontLayer); front.setPosition(position);
    }
  }

  private buildPieces(): void {
    this.tray.layer = 1 << 25; this.tray.setParent(this.node); this.tray.setPosition(this.trayOrigin);
    this.tray.addComponent(UITransform).setContentSize(680, 320);
    const pieces = [...this.model.pieces].sort((a, b) => a.source.x - b.source.x);
    for (const definition of pieces) {
      const node = new Node(definition.id); node.layer = 1 << 25; node.setParent(this.tray);
      node.addComponent(UITransform).setContentSize(0, 0);
      const home = new Vec3(definition.source.x - 360, 870 - definition.source.y, 0);
      node.setPosition(home); node.setScale(TRAY_SCALE, TRAY_SCALE, 1);
      const origin = gridToPoint2({ tx: definition.source.tx, ty: definition.source.ty });
      const cells: Node[] = [];
      for (const cell of definition.targetCells) {
        const point = gridToPoint2(cell);
        const sprite = this.createCell('PieceCell', definition.textureName, 1, 1);
        sprite.setParent(node); sprite.setPosition((point.x2 - origin.x2) / 2, -(point.y2 - origin.y2) / 2);
        cells.push(sprite);
      }
      const view: PieceView = {
        definition, node, home, preview: null, dragState: 'idle', touchId: null,
        touchStart: new Vec3(), touchStartUi: new Vec3(), grabOffset: new Vec3(), liftOffset: MIN_LIFT,
      };
      this.pieceViews.set(definition.id, view);
      this.createPieceHitArea(view, cells);
    }
  }

  private createPieceHitArea(view: PieceView, cells: Node[]): void {
    const minX = Math.min(...cells.map((cell) => cell.position.x - TILE_WIDTH / 2));
    const maxX = Math.max(...cells.map((cell) => cell.position.x + TILE_WIDTH / 2));
    const minY = Math.min(...cells.map((cell) => cell.position.y - TILE_HEIGHT / 2));
    const maxY = Math.max(...cells.map((cell) => cell.position.y + TILE_HEIGHT / 2));
    const hitArea = new Node('PieceHitArea');
    hitArea.layer = 1 << 25;
    hitArea.setParent(view.node);
    hitArea.setPosition((minX + maxX) / 2, (minY + maxY) / 2);
    hitArea.addComponent(UITransform).setContentSize(maxX - minX, maxY - minY);
    hitArea.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
      if (!cells.some((cell) => this.isPieceCellHit(cell, event))) return;
      this.prepareDrag(view, event, maxY - minY);
    });
    hitArea.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
      if (!this.isActiveTouch(view, event)) return;
      if (view.dragState === 'pending' && this.dragDistance(view, event) >= DRAG_SLOP) this.dragStart(view, event);
      if (view.dragState === 'dragging') this.dragMove(view, event);
    });
    const finishDrag = (event: EventTouch): void => {
      if (!this.isActiveTouch(view, event)) return;
      if (view.dragState === 'dragging') {
        this.dragMove(view, event);
        this.dragEnd(view);
      } else {
        this.resetDragState(view);
      }
    };
    hitArea.on(Node.EventType.TOUCH_END, finishDrag);
    hitArea.on(Node.EventType.TOUCH_CANCEL, finishDrag);
  }

  private isPieceCellHit(cell: Node, event: EventTouch): boolean {
    const transform = cell.getComponent(UITransform);
    if (!transform) return false;
    const location = event.getUILocation();
    const local = transform.convertToNodeSpaceAR(new Vec3(location.x, location.y));
    return isPointInFlatHexagon(local.x, local.y, transform.contentSize.width, transform.contentSize.height);
  }

  private createCell(name: string, textureName: string, alpha: number, scale = this.boardScale): Node {
    const node = new Node(name); node.layer = 1 << 25;
    node.addComponent(UITransform).setContentSize(TILE_WIDTH * scale, TILE_HEIGHT * scale);
    const sprite = node.addComponent(Sprite); sprite.spriteFrame = this.frames.get(textureName) ?? null; sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    if (alpha < 1) node.addComponent(UIOpacity).opacity = Math.round(alpha * 255);
    return node;
  }

  private createBoardTexture(name: string, textureName: string): Node {
    const node = new Node(name);
    node.layer = 1 << 25;
    const frame = this.frames.get(textureName) ?? null;
    const size = frame?.originalSize ?? { width: TILE_WIDTH, height: TILE_HEIGHT };
    node.addComponent(UITransform).setContentSize(size.width, size.height);
    const sprite = node.addComponent(Sprite);
    sprite.spriteFrame = frame;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    node.setScale(this.boardScale, this.boardScale, 1);
    return node;
  }

  private coordPosition(coord: GridCoord): Vec3 {
    const point = gridToPoint2(coord);
    return new Vec3(point.x2 / 2 * this.boardScale, -point.y2 / 2 * this.boardScale, 0);
  }

  private eventPosition(event: EventTouch): Vec3 {
    const location = event.getUILocation();
    const rootTransform = this.node.getComponent(UITransform)!;
    return rootTransform.convertToNodeSpaceAR(new Vec3(location.x, location.y));
  }

  private prepareDrag(view: PieceView, event: EventTouch, pieceHeight: number): void {
    if (this.won || view.dragState !== 'idle' || this.activeDrag) return;
    this.activeDrag = view;
    view.dragState = 'pending';
    view.touchId = this.touchId(event);
    view.touchStart.set(this.eventPosition(event));
    const uiLocation = event.getUILocation();
    view.touchStartUi.set(uiLocation.x, uiLocation.y, 0);
    view.liftOffset = Math.max(MIN_LIFT, Math.min(MAX_LIFT, pieceHeight * DRAG_SCALE * 0.55));
  }

  private dragStart(view: PieceView, event: EventTouch): void {
    if (this.won || view.dragState !== 'pending') return;
    this.model.beginMove(view.definition.id);
    Tween.stopAllByTarget(view.node);
    view.node.setParent(this.node, true);
    view.node.setSiblingIndex(this.node.children.length - 1);
    view.grabOffset.set(view.node.position).subtract(view.touchStart);
    view.dragState = 'dragging';
    tween(view.node).to(PICKUP_TIME, { scale: new Vec3(DRAG_SCALE, DRAG_SCALE, 1) }, { easing: 'quadOut' }).start();
    this.clearPreview();
    this.dragMove(view, event);
  }

  private dragMove(view: PieceView, event: EventTouch): void {
    if (this.won) return;
    const position = this.eventPosition(event);
    position.add(view.grabOffset);
    position.y += view.liftOffset;
    view.node.setPosition(position);
    const boardPosition = this.board.position;
    const localX = (position.x - boardPosition.x) / this.boardScale;
    const localY = -(position.y - boardPosition.y) / this.boardScale;
    let bestPreview: PlacementPreview | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < view.definition.localPoints.length; index += 1) {
      const localPoint = view.definition.localPoints[index];
      const anchor = nearestGrid({ x: localX + localPoint.x2 / 2, y: localY + localPoint.y2 / 2 });
      const candidate = this.model.previewPlacement(view.definition.id, anchor, index);
      if (!candidate.valid) continue;
      const dx = candidate.translation.x2 / 2 - localX;
      const dy = candidate.translation.y2 / 2 - localY;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) { bestPreview = candidate; bestDistance = distance; }
    }
    if (bestPreview && bestDistance <= MAX_SNAP_DISTANCE * MAX_SNAP_DISTANCE) {
      view.preview = bestPreview;
    } else if (!view.preview || this.previewDistance(view.preview, localX, localY) > PREVIEW_GRACE_DISTANCE) {
      view.preview = null;
    }
    this.renderPreview(view.preview, view.definition.textureName);
  }

  private dragEnd(view: PieceView): void {
    this.clearPreview();
    if (view.preview && this.model.place(view.definition.id, view.preview)) {
      const target = new Vec3(view.preview.translation.x2 / 2 * this.boardScale, -view.preview.translation.y2 / 2 * this.boardScale);
      view.dragState = 'settling';
      view.node.setParent(this.board, true);
      Tween.stopAllByTarget(view.node);
      tween(view.node)
        .to(SNAP_TIME, { position: target, scale: new Vec3(this.boardScale, this.boardScale, 1) }, { easing: 'quadOut' })
        .call(() => { this.resetDragState(view); if (this.model.isWon) this.showWin(); })
        .start();
    } else {
      this.returnHome(view);
    }
    view.preview = null;
  }

  private returnHome(view: PieceView): void {
    view.dragState = 'settling';
    Tween.stopAllByTarget(view.node);
    view.node.setParent(this.tray, true);
    tween(view.node)
      .to(RETURN_TIME, { position: view.home, scale: new Vec3(TRAY_SCALE, TRAY_SCALE, 1) }, { easing: 'quadOut' })
      .call(() => this.resetDragState(view))
      .start();
  }

  private dragDistance(view: PieceView, event: EventTouch): number {
    const position = event.getUILocation();
    return Math.hypot(position.x - view.touchStartUi.x, position.y - view.touchStartUi.y);
  }

  private touchId(event: EventTouch): number { return event.touch?.getID() ?? 0; }

  private isActiveTouch(view: PieceView, event: EventTouch): boolean {
    return view.dragState !== 'idle' && view.touchId === this.touchId(event);
  }

  private previewDistance(preview: PlacementPreview, localX: number, localY: number): number {
    return Math.hypot(preview.translation.x2 / 2 - localX, preview.translation.y2 / 2 - localY);
  }

  private resetDragState(view: PieceView): void {
    if (this.activeDrag === view) this.activeDrag = null;
    view.dragState = 'idle';
    view.touchId = null;
  }

  private renderPreview(preview: PlacementPreview | null, textureName: string): void {
    this.clearPreview();
    if (!preview) return;
    for (const coord of preview.cells) {
      const cell = this.createCell('PreviewCell', textureName, 0.55);
      cell.setParent(this.previewLayer); cell.setPosition(this.coordPosition(coord));
    }
  }

  private clearPreview(): void { this.previewLayer.removeAllChildren(); }

  private requestHint(): void {
    if (this.hintCount <= 0) return;
    if (this.onHintRequested && !this.onHintRequested()) {
      this.hintCount = 0;
      this.updateHintButton();
      return;
    }
    this.hintCount -= 1;
    this.updateHintButton();
    this.showHint();
  }

  private updateHintButton(): void {
    if (!this.hintButton) return;
    const enabled = this.hintCount > 0;
    const label = findNode(this.hintButton, 'txt')?.getComponent(Label);
    if (label) label.string = String(this.hintCount);
    let opacity = this.hintButton.getComponent(UIOpacity);
    if (!opacity) opacity = this.hintButton.addComponent(UIOpacity);
    opacity.opacity = enabled ? 255 : 90;
  }

  public showHint(): void {
    const hint = this.model.nextHint(); if (!hint) return;
    for (const coord of hint.cells) {
      const node = this.targetNodes.get(`${coord.tx},${coord.ty}`); if (!node) continue;
      const normal = new Vec3(this.boardScale, this.boardScale, 1);
      const raised = new Vec3(this.boardScale * 1.18, this.boardScale * 1.18, 1);
      tween(node).to(0.18, { scale: raised }).to(0.18, { scale: normal }).union().repeat(3).start();
    }
  }

  public reset(): void {
    this.won = false; this.model.reset(); this.clearPreview();
    this.node.getChildByName('WinOverlay')?.destroy();
    this.winLayout = null;
    for (const view of this.pieceViews.values()) { view.preview = null; this.returnHome(view); }
  }

  public layoutResponsive(visibleHeight: number): void {
    this.visibleHeight = Math.max(1280, visibleHeight);
    const extraHeight = this.visibleHeight - 1280;
    this.board.setPosition(this.boardOrigin.x, this.boardOrigin.y - extraHeight / 2, this.boardOrigin.z);
    this.tray.setPosition(this.trayOrigin.x, this.trayOrigin.y - extraHeight / 2, this.trayOrigin.z);
    if (!this.winLayout) return;
    const { overlay, content, background, footer, backgroundPosition, backgroundScale, footerPosition } = this.winLayout;
    overlay.getComponent(UITransform)?.setContentSize(720, this.visibleHeight);
    overlay.setPosition(0, -extraHeight / 2);
    content.setPosition(-360, 640);
    if (background && backgroundPosition && backgroundScale) {
      background.setPosition(backgroundPosition.x, backgroundPosition.y + extraHeight / 2, backgroundPosition.z);
      background.setScale(backgroundScale.x, backgroundScale.y * this.visibleHeight / 1280, backgroundScale.z);
    }
    if (footer && footerPosition) footer.setPosition(footerPosition.x, footerPosition.y - extraHeight / 2, footerPosition.z);
  }

  private showWin(): void {
    if (this.won) return; this.won = true;
    this.onSolved?.();
    const overlay = new Node('WinOverlay');
    overlay.layer = this.node.layer;
    overlay.addComponent(UITransform).setContentSize(720, 1280);
    overlay.setParent(this.node);
    overlay.setPosition(0, 0);
    const content = instantiate(this.winPrefab);
    content.name = 'WinOverlayContent';
    content.setParent(overlay);
    const background = findNode(content, 'bk1');
    const footer = findNode(content, 'bk3');
    this.winLayout = {
      overlay,
      content,
      background,
      footer,
      backgroundPosition: background?.position.clone() ?? null,
      backgroundScale: background?.scale.clone() ?? null,
      footerPosition: footer?.position.clone() ?? null,
    };
    this.layoutResponsive(this.visibleHeight);
    let advancing = false;
    const advance = (): void => {
      if (advancing) return;
      advancing = true;
      this.onWin?.();
    };
    const next = findNode(content, 'next_btn');
    const ok = findNode(content, 'ok_btn');
    if (next) this.bind(next, advance);
    if (ok) this.bind(ok, advance);
  }

  public destroy(): void { this.node.destroy(); }
}

function ButtonEvent(): string { return Node.EventType.TOUCH_END; }

function findNode(root: Node, name: string): Node | null {
  if (root.name === name) return root;
  for (const child of root.children) {
    const found = findNode(child, name);
    if (found) return found;
  }
  return null;
}
