import { Button, Color, EventTouch, input, Input, instantiate, Node, Prefab, Sprite, SpriteFrame, tween, Tween, UITransform, UIOpacity, Vec3, view } from 'cc';
import type { LevelData, LevelMetadata } from '../data/LevelTypes';
import type { AttemptSave } from '../data/SaveTypes';
import { DRAG_SCALE, TILE_HEIGHT, TILE_WIDTH, TRAY_SCALE } from '../data/LevelTypes';
import { coordKey, gridToPoint2, nearestGrid, type GridCoord } from '../model/HexGrid';
import { isPointInFlatHexagon } from '../model/HexHitTest';
import type { PieceDefinition, PlacementPreview } from '../model/PuzzleModel';
import type { I18nKey, I18nParams, Locale } from '../i18n/I18nService';
import { FeedbackPresenter } from './FeedbackPresenter';
import { GameplaySession, type CompletionSnapshot } from './GameplaySession';
import { layoutTray } from './TrayLayout';
import { compactNumber } from '../ui/UiNumbers';
import { exposedBoardEdges } from './BoardBoundary';
import { bindAction, findNode, selectVariant, setText } from '../ui/PrefabUi';

type DragState = 'idle' | 'pending' | 'dragging' | 'settling';
export type ResultAction = 'next' | 'replay' | 'levels';
type Translate = (key: I18nKey, params?: I18nParams) => string;

interface PieceView {
  definition: PieceDefinition;
  node: Node;
  cells: Node[];
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
const MAX_SNAP_DISTANCE = 36;
const PREVIEW_GRACE_DISTANCE = 16;

export class GameplayView {
  public readonly node = new Node('GameplayView');
  public onCompleted: ((completion: CompletionSnapshot) => void) | null = null;
  public onWin: ((completion: CompletionSnapshot, action: ResultAction) => void) | null = null;
  public onSolved: (() => void) | null = null;
  public onBack: (() => void) | null = null;
  public onHintRequested: ((attempt: AttemptSave) => boolean) | null = null;
  public onHintUnavailable: (() => void) | null = null;
  public onAttemptChanged: ((attempt: AttemptSave) => void) | null = null;
  public onStorageError: (() => void) | null = null;
  public onRestart: (() => void) | null = null;
  public onFailed: ((attempt: AttemptSave) => void) | null = null;
  public hasNextLevel = true;
  public getResultProgress: (() => { completed: number; total: number }) | null = null;
  private adCovered = false;
  private readonly board = new Node('Board');
  private readonly tray = new Node('Tray');
  private readonly borderBackLayer = new Node('BorderBackLayer');
  private readonly textureLayer = new Node('TextureLayer');
  private readonly previewLayer = new Node('PlacementPreview');
  private readonly borderFrontLayer = new Node('BorderFrontLayer');
  private readonly hintLayer = new Node('PersistentHint');
  private readonly pieceViews = new Map<string, PieceView>();
  private readonly session: GameplaySession;
  private readonly feedback = new FeedbackPresenter();
  private boardScale = 1;
  private trayScale = TRAY_SCALE;
  private readonly boardCenter: { x: number; y: number };
  private readonly boardOrigin = new Vec3(0, 0, 0);
  private readonly trayOrigin = new Vec3(0, 0, 0);
  private boardMount: Node = this.node;
  private trayMount: Node = this.node;
  private hintButtons: Button[] = [];
  private chromeContent: Node | null = null;
  private renderedPreviewKey = '';
  private activeDrag: PieceView | null = null;
  private won = false;
  private resultActionCommitted = false;
  private visibleHeight = 1280;
  private winLayout: {
    overlay: Node;
    background: Node | null;
    backgroundPosition: Vec3 | null;
    backgroundScale: Vec3 | null;
  } | null = null;

  public constructor(
    level: LevelData,
    private readonly frames: Map<string, SpriteFrame>,
    private readonly title: string,
    private hintCount: number,
    chromePrefab: Prefab,
    _topBarPrefab: Prefab,
    private readonly onSettings: () => void,
    private readonly winPrefab: Prefab,
    private readonly translate: Translate,
    private readonly metadata: LevelMetadata,
    private attempt: AttemptSave,
    private readonly locale: Locale,
    private readonly cellPrefab: Prefab,
  ) {
    this.session = new GameplaySession(level, metadata, attempt);
    this.boardCenter = this.computeBoardCenter();
    this.node.layer = 1 << 25;
    this.node.addComponent(UITransform).setContentSize(720, 1280);
    this.buildChrome(chromePrefab, onSettings);
    const boardSize = this.boardMount.getComponent(UITransform)!.contentSize;
    const boardPoints = this.session.model.targetCells.concat(this.session.model.obstacleCells).map(gridToPoint2);
    this.boardScale = Math.min(this.boardScale,
      (boardSize.width - 24) / ((Math.max(...boardPoints.map((point) => point.x2)) - Math.min(...boardPoints.map((point) => point.x2))) / 2 + TILE_WIDTH),
      (boardSize.height - 24) / ((Math.max(...boardPoints.map((point) => point.y2)) - Math.min(...boardPoints.map((point) => point.y2))) / 2 + TILE_HEIGHT));
    this.buildBoard();
    this.buildPieces();
    this.syncPieces();
    this.showHint();
    this.updateStats();
    input.on(Input.EventType.TOUCH_END, this.finishGlobalTouch, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.cancelGlobalTouch, this);
  }

  public resume(): void {
    if (this.session.snapshot().won) this.finishWinSequence();
    else this.notifyFailure();
  }

  public setHintCount(hints: number): void {
    this.hintCount = Math.max(0, Math.trunc(hints));
    this.updateHintButton();
    if (this.winLayout) setText(this.winLayout.overlay, 'hint-count', compactNumber(this.hintCount));
  }

  public get attemptId(): string { return this.attempt.attemptId; }

  public setAdCovered(covered: boolean): void {
    if (this.adCovered === covered) return;
    this.adCovered = covered;
    if (covered) this.cancelDragForAdCoverage();
    this.updateHintButton();
  }

  public applySavedAttempt(attempt: AttemptSave | null, hintCount = this.hintCount): boolean {
    this.setHintCount(hintCount);
    if (!attempt || attempt.attemptId !== this.attempt.attemptId || attempt.mapId !== this.attempt.mapId
      || attempt.levelId !== this.attempt.levelId || attempt.mode !== this.attempt.mode
      || attempt.contentVersion !== this.attempt.contentVersion) return false;
    const current = this.session.snapshot();
    if (attempt.moves < current.stats.moves || attempt.errors < current.stats.errors
      || attempt.hintsUsed < current.stats.hintsUsed || attempt.continuesUsed < current.continuesUsed
      || attempt.bonusMoves < current.bonusMoves || attempt.hintRefills < current.hintRefills) return false;
    try {
      this.cancelDragForAdCoverage();
      this.session.restoreAttempt(attempt);
      this.attempt = attempt;
      this.syncPieces();
      this.showHint();
      this.updateStats();
      return true;
    } catch (error) {
      console.warn('[GameplayView] Ignoring incompatible saved attempt', error);
      return false;
    }
  }

  private buildChrome(chromePrefab: Prefab, onSettings: () => void): void {
    const chrome = instantiate(chromePrefab);
    chrome.setParent(this.node);
    const content = selectVariant(chrome, this.metadata.mode === 'challenge' ? '06-challenge-gameplay' : '05-classic-gameplay', this.locale);
    this.chromeContent = content;
    const boardMount = findNode(content, 'board_mount');
    const trayMount = findNode(content, 'tray_mount');
    if (!boardMount?.getComponent(UITransform) || !trayMount?.getComponent(UITransform)) {
      throw new Error('GameplayPage Prefab node contract is incomplete');
    }
    this.boardMount = boardMount;
    this.trayMount = trayMount;
    for (const name of ['editor_board_preview', 'editor_tray_preview']) {
      const preview = findNode(content, name);
      if (preview) preview.active = false;
    }
    this.bind(content, 'restart', () => this.requestReplay());
    this.bind(content, 'back', () => this.onBack?.());
    this.bind(content, 'settings', onSettings);
    this.hintButtons = this.bind(content, 'hint', () => this.requestHint());
    this.hintButtons.push(...this.bind(content, 'hint-inventory', () => this.requestHint()));
    const levelNumber = this.title.match(/\d+/)?.[0] ?? this.metadata.levelId;
    setText(content, 'level-number', levelNumber);
    if (this.metadata.mode === 'challenge') {
      const group = Math.floor((Number(levelNumber) - 1) / 10) + 1;
      setText(content, 'mode-label', this.locale === 'en' ? `CHALLENGE \u00b7 GROUP ${group}` : `\u9650\u6b65\u6311\u6218 \u00b7 \u7b2c${group}\u7ec4`);
      setText(content, 'budget-count', String(this.metadata.moveLimit));
    }
    this.updateHintButton();
  }

  private bind(root: Node, action: string, handler: () => void): Button[] {
    return bindAction(root, action, () => { if (!this.adCovered) handler(); });
  }

  private buildBoard(): void {
    this.board.layer = 1 << 25; this.board.setParent(this.boardMount); this.board.setPosition(this.boardOrigin);
    this.board.addComponent(UITransform).setContentSize(560, 430);
    for (const layer of [this.borderBackLayer, this.textureLayer, this.previewLayer, this.borderFrontLayer, this.hintLayer]) {
      layer.layer = 1 << 25;
      layer.setParent(this.board);
    }
    const occupied = new Set(this.session.model.targetCells.concat(this.session.model.obstacleCells).map(coordKey));
    for (const coord of this.session.model.targetCells) {
      const position = this.coordPosition(coord);
      const texture = this.createBoardTexture('TargetCell', 'v3-board-boundary');
      texture.setParent(this.textureLayer); texture.setPosition(position);
      this.showBoardBoundary(texture, coord, occupied);
    }
    for (const coord of this.session.model.obstacleCells) {
      const position = this.coordPosition(coord);
      const texture = this.createBoardTexture('ObstacleCell', 'v3-board-obstacle');
      texture.setParent(this.textureLayer); texture.setPosition(position);
      this.showBoardBoundary(texture, coord, occupied);
    }
  }

  private buildPieces(): void {
    this.tray.layer = 1 << 25; this.tray.setParent(this.trayMount); this.tray.setPosition(this.trayOrigin);
    const size = this.trayMount.getComponent(UITransform)!.contentSize;
    this.tray.addComponent(UITransform).setContentSize(size);
    const pieces = [...this.session.model.pieces].sort((a, b) => a.source.x - b.source.x);
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
        definition, node, cells, home, preview: null, dragState: 'idle', touchId: null,
        touchStart: new Vec3(), touchStartUi: new Vec3(), grabOffset: new Vec3(), liftOffset: MIN_LIFT,
      };
      this.pieceViews.set(definition.id, view);
      this.createPieceHitArea(view, cells);
    }
    const bounds = Array.from(this.pieceViews.values()).map((piece) => ({
      id: piece.definition.id,
      minX: Math.min(...piece.cells.map((cell) => cell.position.x)) - TILE_WIDTH / 2,
      maxX: Math.max(...piece.cells.map((cell) => cell.position.x)) + TILE_WIDTH / 2,
      minY: Math.min(...piece.cells.map((cell) => cell.position.y)) - TILE_HEIGHT / 2,
      maxY: Math.max(...piece.cells.map((cell) => cell.position.y)) + TILE_HEIGHT / 2,
    }));
    const layout = layoutTray(bounds, size.width - 24, size.height - 24, 0.5);
    this.trayScale = layout.scale;
    for (const item of layout.items) this.pieceViews.get(item.id)!.home.set(item.x, item.y, 0);
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
    // Creator can change an outside release to node TOUCH_CANCEL and swallow the
    // simulated mouse touch before global input sees it. Resolve the preserved
    // original input code here; the global callbacks also cover unclaimed touches.
    const finishNodeTouch = (event: EventTouch): void => {
      if (!this.isActiveTouch(view, event)) return;
      const originalType = event.getEventCode();
      if (originalType === Input.EventType.TOUCH_CANCEL) this.cancelGlobalTouch(event);
      else if (originalType === Input.EventType.TOUCH_END) this.finishGlobalTouch(event);
    };
    hitArea.on(Node.EventType.TOUCH_END, finishNodeTouch);
    hitArea.on(Node.EventType.TOUCH_CANCEL, finishNodeTouch);
  }

  private finishGlobalTouch(event: EventTouch): void {
    const piece = this.activeDrag;
    if (!piece || !this.isActiveTouch(piece, event)) return;
    if (piece.dragState !== 'pending' && piece.dragState !== 'dragging') return;
    if (this.adCovered) { this.cancelDragForAdCoverage(); return; }
    if (piece.dragState === 'dragging') {
      this.dragMove(piece, event);
      this.dragEnd(piece, event);
    } else {
      this.resetDragState(piece);
    }
  }

  private cancelGlobalTouch(event: EventTouch): void {
    const piece = this.activeDrag;
    if (!piece || !this.isActiveTouch(piece, event)) return;
    if (piece.dragState !== 'pending' && piece.dragState !== 'dragging') return;
    this.session.cancelMove();
    this.clearPreview();
    this.syncPieces();
    this.showHint();
    this.updateStats();
  }

  private isPieceCellHit(cell: Node, event: EventTouch): boolean {
    const transform = cell.getComponent(UITransform);
    if (!transform) return false;
    const location = event.getUILocation();
    const local = transform.convertToNodeSpaceAR(new Vec3(location.x, location.y));
    return isPointInFlatHexagon(local.x, local.y, transform.contentSize.width, transform.contentSize.height);
  }

  private createCell(name: string, textureName: string, alpha: number, scale = this.boardScale): Node {
    const node = instantiate(this.cellPrefab);
    node.name = name;
    const sprite = node.getComponent(Sprite);
    if (!sprite) throw new Error('CellVisual Prefab must have a root Sprite');
    const frame = this.frames.get(textureName);
    if (!frame) throw new Error(`Missing gameplay SpriteFrame: ${textureName}`);
    sprite.spriteFrame = frame;
    const edges = findNode(node, 'border_edges');
    if (edges) edges.active = false;
    node.setScale(scale, scale, 1);
    const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    opacity.opacity = Math.round(alpha * 255);
    return node;
  }

  private createBoardTexture(name: string, textureName: string): Node {
    return this.createCell(name, textureName, 1);
  }

  private showBoardBoundary(cell: Node, coord: GridCoord, occupied: ReadonlySet<string>): void {
    const edges = findNode(cell, 'border_edges');
    if (!edges) throw new Error('CellVisual Prefab must contain border_edges');
    edges.active = true;
    exposedBoardEdges(coord, occupied).forEach((exposed, index) => {
      const edge = edges.getChildByName(`edge_${index}`);
      if (!edge) throw new Error(`CellVisual Prefab is missing edge_${index}`);
      edge.active = exposed;
    });
  }

  private coordPosition(coord: GridCoord): Vec3 {
    const point = gridToPoint2(coord);
    return new Vec3((point.x2 / 2 - this.boardCenter.x) * this.boardScale, -(point.y2 / 2 - this.boardCenter.y) * this.boardScale, 0);
  }

  private computeBoardCenter(): { x: number; y: number } {
    const points = [...this.session.model.targetCells, ...this.session.model.obstacleCells].map((coord) => gridToPoint2(coord));
    const xs = points.map((point) => point.x2 / 2);
    const ys = points.map((point) => point.y2 / 2);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  }

  private eventPosition(event: EventTouch): Vec3 {
    const location = event.getUILocation();
    const rootTransform = this.node.getComponent(UITransform)!;
    return rootTransform.convertToNodeSpaceAR(new Vec3(location.x, location.y));
  }

  private prepareDrag(view: PieceView, event: EventTouch, pieceHeight: number): void {
    if (this.adCovered) return;
    if (this.session.snapshot().status !== 'active' || view.dragState !== 'idle' || this.activeDrag) return;
    this.activeDrag = view;
    view.dragState = 'pending';
    view.touchId = this.touchId(event);
    view.touchStart.set(this.eventPosition(event));
    const uiLocation = event.getUILocation();
    view.touchStartUi.set(uiLocation.x, uiLocation.y, 0);
    view.liftOffset = Math.max(MIN_LIFT, Math.min(MAX_LIFT, pieceHeight * DRAG_SCALE * 0.55));
    this.feedback.pulse(view.node, 'pickup');
    this.setPieceVisualState(view, 'pickup');
  }

  private dragStart(view: PieceView, event: EventTouch): void {
    if (this.adCovered) { this.cancelDragForAdCoverage(); return; }
    if (this.won || view.dragState !== 'pending') return;
    if (!this.session.beginMove(view.definition.id)) return;
    this.feedback.stopNode(view.node);
    view.node.setParent(this.node, true);
    view.node.setSiblingIndex(this.node.children.length - 1);
    view.grabOffset.set(view.node.position).subtract(view.touchStart);
    view.dragState = 'dragging';
    tween(view.node).to(PICKUP_TIME, { scale: new Vec3(DRAG_SCALE, DRAG_SCALE, 1) }, { easing: 'quadOut' }).start();
    this.clearPreview();
    this.setPieceVisualState(view, 'dragging');
    this.dragMove(view, event);
  }

  private dragMove(view: PieceView, event: EventTouch): void {
    if (this.adCovered) { this.cancelDragForAdCoverage(); return; }
    if (this.won) return;
    const position = this.eventPosition(event);
    position.add(view.grabOffset);
    position.y += view.liftOffset;
    view.node.setPosition(position);
    const boardPosition = positionInAncestor(this.board, this.node);
    const localX = (position.x - boardPosition.x) / this.boardScale + this.boardCenter.x;
    const localY = -(position.y - boardPosition.y) / this.boardScale + this.boardCenter.y;
    let bestPreview: PlacementPreview | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < view.definition.localPoints.length; index += 1) {
      const localPoint = view.definition.localPoints[index];
      const anchor = nearestGrid({ x: localX + localPoint.x2 / 2, y: localY + localPoint.y2 / 2 });
      const candidate = this.session.findPlacement(view.definition.id, anchor, index);
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
    this.renderPreview(view.preview);
    this.setPieceVisualState(view, view.preview ? 'valid-preview' : 'dragging');
  }

  private dragEnd(view: PieceView, event: EventTouch): void {
    if (this.adCovered) { this.cancelDragForAdCoverage(); return; }
    this.clearPreview();
    if (view.preview && this.session.previewPlacement(view.definition.id, view.preview)) {
      this.session.recordDrop('correct');
      if (!this.persistAttempt()) return;
      this.updateStats();
      this.setPieceVisualState(view, 'correct');
      const target = new Vec3(
        (view.preview.translation.x2 / 2 - this.boardCenter.x) * this.boardScale,
        -(view.preview.translation.y2 / 2 - this.boardCenter.y) * this.boardScale,
      );
      view.dragState = 'settling';
      view.node.setParent(this.board, true);
      Tween.stopAllByTarget(view.node);
      tween(view.node)
        .to(SNAP_TIME, { position: target, scale: new Vec3(this.boardScale, this.boardScale, 1) }, { easing: 'quadOut' })
        .call(() => {
          this.feedback.pulse(view.node, 'correct-drop');
          this.resetDragState(view);
          this.showHint();
          if (this.session.snapshot().won) this.finishWinSequence();
        })
        .start();
    } else {
      const location = event.getUILocation();
      const trayBounds = this.tray.getComponent(UITransform)!.getBoundingBoxToWorld();
      if (trayBounds.contains(location)) this.session.returnToTray(view.definition.id);
      else this.session.recordDrop('invalid-return');
      if (!this.persistAttempt()) return;
      this.updateStats();
      this.syncPieces();
      this.showHint();
    }
    view.preview = null;
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
    view.preview = null;
  }

  private cancelDragForAdCoverage(): void {
    if (!this.activeDrag) return;
    this.session.cancelMove();
    this.clearPreview();
    this.syncPieces();
    this.showHint();
    this.updateStats();
  }

  private syncPieces(): void {
    const snapshot = this.session.model.snapshot();
    for (const state of snapshot.pieces) {
      const view = this.pieceViews.get(state.id)!;
      this.feedback.stopNode(view.node);
      Tween.stopAllByTarget(view.node);
      if (state.placed) {
        const first = gridToPoint2(state.cells[0]);
        const local = view.definition.localPoints[0];
        view.node.setParent(this.board);
        view.node.setPosition(
          ((first.x2 - local.x2) / 2 - this.boardCenter.x) * this.boardScale,
          -((first.y2 - local.y2) / 2 - this.boardCenter.y) * this.boardScale,
        );
        view.node.setScale(this.boardScale, this.boardScale, 1);
      } else {
        view.node.setParent(this.tray);
        view.node.setPosition(view.home);
        view.node.setScale(this.trayScale, this.trayScale, 1);
      }
      this.setPieceVisualState(view, 'idle');
      this.resetDragState(view);
    }
  }

  private persistAttempt(): boolean {
    try {
      const next = this.session.toAttemptSave(this.attempt);
      if (!this.onAttemptChanged) throw new Error('Attempt persistence is unavailable');
      this.onAttemptChanged(next);
      this.attempt = next;
      return true;
    } catch (error) {
      console.error('[GameplayView] Attempt was not saved', error);
      this.session.restoreAttempt(this.attempt);
      this.syncPieces();
      this.showHint();
      this.updateStats();
      this.onStorageError?.();
      return false;
    }
  }

  private setPieceVisualState(view: PieceView, state: 'idle' | 'pickup' | 'dragging' | 'valid-preview' | 'wrong-valid' | 'invalid-return' | 'correct'): void {
    const colors: Record<typeof state, Color> = {
      idle: Color.WHITE,
      pickup: new Color(220, 245, 255, 255),
      dragging: Color.WHITE,
      'valid-preview': new Color(180, 255, 205, 255),
      'wrong-valid': new Color(255, 218, 128, 255),
      'invalid-return': new Color(255, 145, 145, 255),
      correct: Color.WHITE,
    };
    for (const cell of view.cells) {
      const sprite = cell.getComponent(Sprite);
      if (sprite) sprite.color = colors[state];
    }
  }

  private renderPreview(preview: PlacementPreview | null): void {
    const previewKey = preview ? preview.cells.map((coord) => `${coord.tx},${coord.ty}`).sort().join('|') : '';
    if (previewKey === this.renderedPreviewKey) return;
    this.clearPreview();
    if (!preview) return;
    this.renderedPreviewKey = previewKey;
    for (const coord of preview.cells) {
      const cell = this.createCell('PreviewCell', 'v3-board-preview', 0.82);
      cell.setParent(this.previewLayer); cell.setPosition(this.coordPosition(coord));
    }
  }

  private clearPreview(): void {
    this.renderedPreviewKey = '';
    for (const child of [...this.previewLayer.children]) {
      child.active = false;
      child.destroy();
    }
  }

  private requestHint(): void {
    if (this.adCovered) return;
    if (this.activeDrag || this.session.snapshot().status !== 'active') return;
    if (!this.session.getHintCandidate()) return;
    if (this.session.snapshot().activeHint) { this.showHint(); return; }
    if (this.hintCount <= 0) { this.onHintUnavailable?.(); return; }
    this.session.activateHint();
    try {
      const next = this.session.toAttemptSave(this.attempt);
      if (!this.onHintRequested?.(next)) {
        this.session.restoreAttempt(this.attempt);
        return;
      }
      this.attempt = next;
      this.hintCount -= 1;
    } catch (error) {
      console.error('[GameplayView] Hint was not saved', error);
      this.session.restoreAttempt(this.attempt);
      this.onStorageError?.();
    }
    this.updateHintButton();
    this.updateStats();
    this.showHint();
  }

  private updateHintButton(): void {
    const enabled = !this.adCovered && this.session.snapshot().status === 'active' && Boolean(this.session.getHintCandidate());
    for (const button of this.hintButtons) button.interactable = enabled;
    if (this.chromeContent) setText(this.chromeContent, 'hint-count', compactNumber(this.hintCount));
  }

  public showHint(): void {
    for (const child of [...this.hintLayer.children]) { child.active = false; child.destroy(); }
    for (const view of this.pieceViews.values()) if (view.dragState === 'idle') this.setPieceVisualState(view, 'idle');
    const hint = this.session.snapshot().activeHint;
    if (!hint) return;
    this.hintLayer.setSiblingIndex(this.board.children.length - 1);
    for (const coord of hint.cells) {
      const outline = this.createCell('HintOutline', 'v3-board-preview', 0.65);
      outline.setParent(this.hintLayer);
      outline.setPosition(this.coordPosition(coord));
      outline.getComponent(Sprite)!.color = new Color(75, 224, 216, 255);
    }
    const selected = this.pieceViews.get(hint.pieceId);
    if (selected && selected.dragState === 'idle') this.setPieceVisualState(selected, 'valid-preview');
    for (const id of hint.conflictingPieceIds) {
      const conflict = this.pieceViews.get(id);
      if (conflict && conflict.dragState === 'idle') this.setPieceVisualState(conflict, 'invalid-return');
    }
  }

  public reset(): void {
    this.requestReplay();
  }

  private requestReplay(): void {
    if (this.adCovered) return;
    if (this.won) this.commitResultAction('replay');
    else if (this.session.snapshot().won) this.finishWinSequence();
    else {
      try { this.onRestart?.(); }
      catch (error) {
        console.error('[GameplayView] Restart was not saved', error);
        this.onStorageError?.();
      }
    }
  }

  private commitResultAction(action: ResultAction): void {
    if (this.resultActionCommitted) return;
    this.resultActionCommitted = true;
    this.onWin?.(this.session.complete(), action);
  }

  public layoutResponsive(visibleHeight: number): void {
    this.visibleHeight = Math.max(1280, visibleHeight);
    const pageBackground = this.chromeContent ? findNode(this.chromeContent, 'img_background') : null;
    pageBackground?.setScale(this.visibleHeight / 1280, this.visibleHeight / 1280, 1);
    pageBackground?.setPosition(0, 0);
    this.board.setPosition(this.boardOrigin);
    this.tray.setPosition(this.trayOrigin);
    if (!this.winLayout) return;
    const { overlay, background, backgroundPosition, backgroundScale } = this.winLayout;
    overlay.getComponent(UITransform)?.setContentSize(720, this.visibleHeight);
    overlay.setPosition(0, 0);
    if (background && backgroundPosition && backgroundScale) {
      background.setPosition(backgroundPosition.x, backgroundPosition.y, backgroundPosition.z);
      background.setScale(backgroundScale.x * this.visibleHeight / 1280, backgroundScale.y * this.visibleHeight / 1280, backgroundScale.z);
    }
  }

  private finishWinSequence(): void {
    if (this.won) return;
    const completion = this.session.complete();
    try {
      this.onCompleted?.(completion);
    } catch (error) {
      console.error('[GameplayView] Completion was not saved', error);
      this.onStorageError?.();
      return;
    }
    this.won = true;
    this.onSolved?.();
    this.updateStats();
    tween(this.node).delay(1.2).call(() => this.showWin()).start();
  }

  private showWin(): void {
    if (!this.won || this.node.getChildByName('WinOverlay')) return;
    const overlay = instantiate(this.winPrefab);
    overlay.name = 'WinOverlay';
    overlay.setParent(this.node);
    const completion = this.session.complete();
    const unassisted = completion.stats.hintsUsed === 0 && completion.continuesUsed === 0;
    const page = this.metadata.mode !== 'challenge' ? '09-classic-result'
      : unassisted ? '10-challenge-result' : '20-challenge-assisted';
    const content = selectVariant(overlay, page, this.locale);
    const background = findNode(content, 'img_background');
    this.winLayout = {
      overlay,
      background,
      backgroundPosition: background?.position.clone() ?? null,
      backgroundScale: background?.scale.clone() ?? null,
    };
    this.layoutResponsive(view.getVisibleSize().height);
    this.feedback.fadeIn(overlay, 0.25);
    const advance = (action: ResultAction): void => this.commitResultAction(action);
    setText(content, 'level-number', this.title.match(/\d+/)?.[0] ?? this.metadata.levelId);
    setText(content, 'hint-count', compactNumber(this.hintCount));
    setText(content, 'step-count', String(completion.stats.moves));
    setText(content, 'continue-count', String(completion.continuesUsed));
    setText(content, 'used-hint-count', String(completion.stats.hintsUsed));
    setText(content, 'target-count', String(this.metadata.perfectMoveTarget));
    if (this.metadata.mode !== 'challenge') {
      const progress = this.getResultProgress?.();
      if (progress) setText(content, 'progress-count', `${progress.completed} / ${progress.total}`);
      else setText(content, 'progress-count', '');
      if (!unassisted) setText(content, 'unassisted-label', this.locale === 'en' ? 'ASSISTED CLEAR' : '\u8f85\u52a9\u5b8c\u6210');
    } else {
      const perfect = completion.score.stars === 3;
      setText(content, 'completion-state-title', this.locale === 'en'
        ? perfect ? 'PERFECT CLEAR' : unassisted ? 'CHALLENGE CLEAR' : 'ASSISTED CLEAR'
        : perfect ? '\u5b8c\u7f8e\u901a\u5173' : unassisted ? '\u6311\u6218\u5b8c\u6210' : '\u8f85\u52a9\u5b8c\u6210');
      if (!unassisted) {
        const both = completion.stats.hintsUsed > 0 && completion.continuesUsed > 0;
        setText(content, 'completion-rule-label', this.locale === 'en'
          ? both ? 'HINTS AND CONTINUE USED' : completion.continuesUsed > 0 ? 'CONTINUE USED' : 'HINTS USED'
          : both ? '\u5df2\u4f7f\u7528\u63d0\u793a\u548c\u7eed\u5c40' : completion.continuesUsed > 0 ? '\u5df2\u4f7f\u7528\u7eed\u5c40' : '\u5df2\u4f7f\u7528\u63d0\u793a');
      }
    }
    for (let index = 1; index <= 3; index += 1) {
      const gold = findNode(content, `star_${index}_gold`);
      const gray = findNode(content, `star_${index}_gray`);
      if (gold) gold.active = index <= completion.score.stars;
      if (gray) gray.active = index > completion.score.stars;
    }
    if (!this.hasNextLevel) setText(content, 'next-level-label', this.translate('gameplay.levels'));
    this.bind(content, 'next', () => advance(this.hasNextLevel ? 'next' : 'levels'));
    this.bind(content, 'replay', () => advance('replay'));
    this.bind(content, 'levels', () => advance('levels'));
    this.bind(content, 'settings', this.onSettings);
  }

  public destroy(): void {
    input.off(Input.EventType.TOUCH_END, this.finishGlobalTouch, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.cancelGlobalTouch, this);
    this.cancelDragForAdCoverage();
    Tween.stopAllByTarget(this.node);
    this.node.destroy();
  }

  private updateStats(): void {
    const snapshot = this.session.snapshot();
    if (this.chromeContent) {
      setText(this.chromeContent, 'step-count', String(snapshot.remainingMoves ?? snapshot.stats.moves));
      setText(this.chromeContent, 'used-hint-count', String(snapshot.stats.hintsUsed));
      setText(this.chromeContent, 'continue-count', `${snapshot.continuesUsed}/1`);
    }
    this.updateHintButton();
    this.notifyFailure();
  }

  private notifyFailure(): void {
    if (this.session.snapshot().status === 'failed') this.onFailed?.(this.attempt);
  }
}


function positionInAncestor(node: Node, ancestor: Node): Vec3 {
  const result = new Vec3();
  let current: Node | null = node;
  while (current && current !== ancestor) {
    result.add(current.position);
    current = current.parent;
  }
  return result;
}
