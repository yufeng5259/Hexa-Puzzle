import { _decorator, CCString, Component, instantiate, isValid, Label, Node, Prefab, ScrollView, Vec2, Graphics, Color, UITransform } from 'cc';
import { requireBinding } from '../../../framework/components/Binding';
import type { ResourceScope } from '../../../framework/resources/ResourceScope';
import { PresentationItem } from '../../presentation/PresentationItem';
import { SourceGeometry } from '../../presentation/SourceGeometry';
import type { LevelDefinition } from '../data/LevelCatalog';
import { axialPoint, centeredCells, fitCells, fitTray, fitTrayWindow, pieceCenter, type AxialCell, type HexFit, type Point2, type TrayFit } from './PuzzleLayout';
import type { PuzzleSessionSnapshot } from '../session/PuzzleSession';
import { PuzzlePiecePresentation } from './PuzzlePiecePresentation';
const { ccclass, property } = _decorator;
let hintColors: { stroke: Color; fill: Color } | null = null;

/** Projects catalog geometry and attempt snapshots. Owns instances; borrows the page's scope. */
@ccclass('PuzzleBoardPresentation')
export class PuzzleBoardPresentation extends Component {
    @property(Node) public liveRoot: Node | null = null;
    @property([Node]) public fixtureNodes: Node[] = [];
    @property(Node) public boardMount: Node | null = null;
    @property(Node) public piecesMount: Node | null = null;
    @property(Prefab) public cellPrefab: Prefab | null = null;
    @property(Prefab) public piecePrefab: Prefab | null = null;
    @property(SourceGeometry) public boardFloor: SourceGeometry | null = null;
    @property(SourceGeometry) public boardRim: SourceGeometry | null = null;
    @property(SourceGeometry) public boardShadow: SourceGeometry | null = null;
    @property(Label) public remainingLabel: Label | null = null;
    @property(Label) public remainingCaptionLabel: Label | null = null;
    @property(Label) public levelLabel: Label | null = null;
    @property(Label) public totalCellsLabel: Label | null = null;
    @property(Label) public moveLimitLabel: Label | null = null;
    @property(CCString) public wellAssetId = '';
    @property(CCString) public obstacleAssetId = '';
    @property(CCString) public textureAssetIds = '{}';
    @property public boardPadding = 32;
    /** Largest cell radius on the board and in the tray; 0 lets small levels fill the mount. */
    @property public maxRadius = 0;
    @property public trayMaxRadius = 0;
    @property public trayGap = 12;
    @property public trayPadding = 8;
    @property(ScrollView) public trayScroll: ScrollView | null = null;
    @property(Node) public trayViewport: Node | null = null;
    @property(Graphics) public hintGraphics: Graphics | null = null;
    @property public countMoves = false;
    public levelId = '';
    public level: LevelDefinition | null = null;
    public boardFit: HexFit | null = null;
    public trayFit: TrayFit | null = null;
    public boardOffset: Point2 = { x: 0, y: 0 };
    private cells: { node: Node; item: PresentationItem }[] = [];
    private pieces: { node: Node; item: PuzzlePiecePresentation }[] = [];
    private revision = 0;
    private disposed = false;
    private trayIds: string[] | null = null;
    private trayScrollWasEnabled: boolean | null = null;
    private readonly traySlots = new Map<string, { position: Point2 }>();
    private trayMotion: { elapsed: number; contentFrom: number; contentTo: number; offset: number;
        pieces: { node: Node; from: Point2; to: Point2 }[] } | null = null;
    public get isTraySettling(): boolean { return this.trayMotion !== null; }
    public getTraySlot(pieceId: string): { position: Point2 } | null { return this.traySlots.get(pieceId) ?? null; }

    /** Called before fixture layout/item rendering so authored sample cells never cover real data. */
    public activateLevel(): void {
        const live = requireBinding('PuzzleBoardPresentation', 'liveRoot', this.liveRoot);
        if (!this.fixtureNodes.length && !this.trayScroll) throw new Error('PuzzleBoardPresentation: fixtures or authored scrolling tray required');
        this.fixtureNodes.forEach((node, i) => requireBinding('PuzzleBoardPresentation', `fixtureNodes[${i}]`, node));
        this.fixtureNodes.forEach(node => { node.active = false; }); live.active = true;
    }

    public async present(scope: ResourceScope, level: LevelDefinition): Promise<void> {
        this.cancelPending();
        this.trayIds = null; this.traySlots.clear();
        const revision = this.revision;
        if (!this.current(revision)) return;
        this.activateLevel();
        const board = requireBinding('PuzzleBoardPresentation', 'boardMount', this.boardMount);
        const tray = requireBinding('PuzzleBoardPresentation', 'piecesMount', this.piecesMount);
        const boardUI = requireBinding('PuzzleBoardPresentation', 'boardMount.UITransform', board.getComponent(UITransform));
        const trayUI = requireBinding('PuzzleBoardPresentation', 'piecesMount.UITransform', tray.getComponent(UITransform));
        const cellPrefab = requireBinding('PuzzleBoardPresentation', 'cellPrefab', this.cellPrefab);
        const piecePrefab = requireBinding('PuzzleBoardPresentation', 'piecePrefab', this.piecePrefab);
        // Board frame geometry is optional: a skin may draw the board with cell art only.
        const geometries = [this.boardShadow, this.boardFloor, this.boardRim];
        if (scope.isReleased || !this.wellAssetId || !this.obstacleAssetId) throw new Error('PuzzleBoardPresentation: registered cell assets and live borrowed scope required');
        let textures: Record<string, string>;
        try { textures = JSON.parse(this.textureAssetIds); } catch { throw new Error('PuzzleBoardPresentation: invalid textureAssetIds JSON'); }
        if (!textures || typeof textures !== 'object' || level.pieces.some(piece => typeof textures[piece.textureName] !== 'string' || !textures[piece.textureName].trim())) {
            throw new Error('PuzzleBoardPresentation: every piece textureName requires a registered asset mapping');
        }
        const allCells = [...level.targetCells, ...level.obstacleCells];
        const fitted = fitCells(allCells, boardUI.width, boardUI.height, this.boardPadding);
        const fit = this.maxRadius > 0 && fitted.radius > this.maxRadius ? centeredCells(allCells, this.maxRadius) : fitted;
        const viewport = this.trayViewport?.getComponent(UITransform);
        const trayWidth = viewport?.width || trayUI.width;
        const trayFit = this.trayScroll ? fitTrayWindow(level.pieces, trayWidth, trayUI.height, this.trayGap, this.trayPadding, this.trayMaxRadius || Infinity) : fitTray(level.pieces, trayUI.width, trayUI.height, this.trayGap, this.trayPadding);
        if (this.trayScroll) {
            if (this.trayScroll.content !== tray) throw new Error('PuzzleBoardPresentation: ScrollView content binding mismatch');
            trayUI.width = trayFit.contentWidth!;
            this.trayScroll.scrollToLeft(0);
        }
        try {
            while (this.cells.length < allCells.length) {
                const node = instantiate(cellPrefab); node.parent = board;
                const item = node.getComponent(PresentationItem);
                if (!item) { node.destroy(); throw new Error('PuzzleBoardPresentation: cell Prefab requires PresentationItem'); }
                this.cells.push({ node, item });
            }
            while (this.pieces.length < level.pieces.length) {
                const node = instantiate(piecePrefab); node.parent = tray;
                const item = node.getComponent(PuzzlePiecePresentation);
                if (!item) { node.destroy(); throw new Error('PuzzleBoardPresentation: piece Prefab requires PuzzlePiecePresentation'); }
                this.pieces.push({ node, item });
            }
            const h = Math.sqrt(3) * fit.radius;
            await Promise.all([
                ...this.cells.map(async (entry, i) => {
                    entry.node.active = i < allCells.length; if (!entry.node.active) return;
                    const center = fit.centers[i]; entry.node.setPosition(center.x - fit.radius, center.y + h / 2, 0);
                    // Dedicated obstacle art carries its own metal shading; reset on every reuse.
                    requireBinding('PuzzleBoardPresentation', 'cell.PresentationItem.body', entry.item.body).grayscale = false;
                    await entry.item.present(scope, { bodyAssetId: i < level.targetCells.length ? this.wellAssetId : this.obstacleAssetId,
                        rootSize: [2 * fit.radius, h], bodyBox: { x: fit.radius, y: -h / 2, width: 2 * fit.radius, height: h } });
                }),
                ...this.pieces.map(async (entry, i) => {
                    entry.node.active = i < level.pieces.length; if (!entry.node.active) { entry.item.clear(); return; }
                    if (entry.node.parent !== tray) entry.node.parent = tray;
                    // A previously played level may have left this root at board scale.
                    if (entry.node.setScale) entry.node.setScale(1, 1, 1);
                    const layout = trayFit.pieces[i]; entry.node.setPosition(layout.position.x, layout.position.y, 0);
                    await entry.item.present(scope, { piece: level.pieces[i], radius: trayFit.radius, assetId: textures[level.pieces[i].textureName] });
                }),
            ]);
            if (!this.current(revision) || scope.isReleased) return;
            geometries.forEach((geometry, i) => {
                if (!geometry) return;
                geometry.node.active = true;
                const ui = requireBinding('PuzzleBoardPresentation', 'geometry.UITransform', geometry.node.getComponent(UITransform));
                ui.setContentSize(boardUI.width, boardUI.height);
                // SourceGeometry projects source-screen coordinates into Cocos; flip=true compensates that Y projection once.
                geometry.spec = JSON.stringify({ renderer: 'block.hex.v1', role: ['shadow', 'floor', 'rim'][i],
                    cells: allCells.map(cell => [cell.q, cell.r]), bbox: [0, 0, boardUI.width, boardUI.height], padding: this.boardPadding, flip_y: true });
                geometry.render();
            });
            if (this.remainingLabel) this.remainingLabel.string = String(level.mode === 'challenge' ? level.moveLimit : this.countMoves ? 0 : level.pieces.length);
            if (this.remainingCaptionLabel) this.remainingCaptionLabel.string = level.mode === 'challenge' ? '剩余步数' : this.countMoves ? '已用步数' : '剩余拼块';
            if (this.levelLabel) this.levelLabel.string = level.mainlineNumber === null ? `挑战 ${level.index}` : `第 ${level.mainlineNumber} 关`;
            if (this.totalCellsLabel) this.totalCellsLabel.string = `0/${level.targetCells.length}`;
            if (this.moveLimitLabel) this.moveLimitLabel.string = level.moveLimit === null ? '∞' : String(level.moveLimit);
            this.levelId = level.id;
            this.level = level; this.boardFit = fit; this.trayFit = trayFit;
            const first = axialPoint(allCells[0], fit.radius);
            this.boardOffset = { x: fit.centers[0].x - first.x, y: fit.centers[0].y - first.y };
        } catch (error) { if (this.current(revision) && !scope.isReleased) { this.clear(); throw error; } }
    }
    public pieceEntries(): readonly { node: Node; item: PuzzlePiecePresentation }[] {
        return (this.pieces || []).filter(entry => isValid(entry.node, true) && isValid(entry.item, true) && entry.node.active && !!entry.item.pieceId);
    }
    public pointOfCell(cell: AxialCell): Point2 {
        const fit = requireBinding('PuzzleBoardPresentation', 'boardFit (present first)', this.boardFit);
        const point = axialPoint(cell, fit.radius);
        return { x: point.x + this.boardOffset.x, y: point.y + this.boardOffset.y };
    }
    /** Piece root is at its shape bounding center, not necessarily at axial (0,0). */
    public translationRootPosition(pieceId: string, translation: AxialCell): Point2 {
        const level = requireBinding('PuzzleBoardPresentation', 'level (present first)', this.level);
        const piece = level.pieces.find(value => value.id === pieceId);
        if (!piece) throw new Error(`PuzzleBoardPresentation: unknown piece ${pieceId}`);
        const point = this.pointOfCell(translation), center = pieceCenter(piece.cells, this.boardFit!.radius);
        return { x: point.x + center.x, y: point.y + center.y };
    }
    /** Synchronous projection; rules and asset ownership stay outside this component. */
    public renderSnapshot(snapshot: PuzzleSessionSnapshot): void {
        if (this.disposed || !isValid(this, true)) return;
        const level = requireBinding('PuzzleBoardPresentation', 'level (present first)', this.level);
        if (snapshot.levelId !== level.id) throw new Error('PuzzleBoardPresentation: snapshot level mismatch');
        const board = requireBinding('PuzzleBoardPresentation', 'boardMount', this.boardMount);
        const tray = requireBinding('PuzzleBoardPresentation', 'piecesMount', this.piecesMount);
        let filled = 0, placed = 0;
        const slots = new Map(level.pieces.map((piece, i) => [piece.id, i]));
        const remaining = level.pieces.filter(piece => !snapshot.placements[piece.id]).map(piece => piece.id);
        const changed = this.trayScroll && (this.trayIds === null || remaining.join('|') !== this.trayIds.join('|'));
        if (changed) this.reflowTray(remaining);
        this.pieceEntries().forEach(entry => {
            const translation = snapshot.placements[entry.item.pieceId];
            if (!translation && !slots.has(entry.item.pieceId)) throw new Error(`PuzzleBoardPresentation: unknown piece ${entry.item.pieceId}`);
            const wasTray = entry.node.parent === tray;
            entry.node.parent = translation ? board : tray;
            const position = translation ? this.translationRootPosition(entry.item.pieceId, translation)
                : this.getTraySlot(entry.item.pieceId)?.position ?? this.trayFit!.pieces[slots.get(entry.item.pieceId)!].position;
            // An unchanged projection must not snap nodes currently travelling to their slots.
            if (translation || !this.trayMotion || !wasTray) entry.node.setPosition(position.x, position.y, 0);
            const scale = translation ? this.boardFit!.radius / entry.item.radius : 1;
            entry.node.setScale(scale, scale, 1);
            if (translation) { placed++; filled += entry.item.cells.length; }
        });
        if (this.remainingLabel) this.remainingLabel.string = String(level.mode === 'challenge' ? Math.max(0, level.moveLimit! - snapshot.moves) : this.countMoves ? snapshot.moves : level.pieces.length - placed);
        if (this.totalCellsLabel) this.totalCellsLabel.string = String(filled) + "/" + level.targetCells.length;
    }
    private reflowTray(ids: string[]): void {
        const tray = this.piecesMount!, ui = tray.getComponent(UITransform)!, scroll = this.trayScroll!;
        const width = this.trayViewport!.getComponent(UITransform)!.width;
        const slot = (width - 2 * this.trayPadding - 2 * this.trayGap) / 3, pitch = slot + this.trayGap;
        const oldIds = this.trayIds, oldX = tray.position.x;
        const oldOffset = Math.max(0, -scroll.getScrollOffset().x);
        const start = new Map(this.pieceEntries().filter(entry => entry.node.parent === tray)
            .map(entry => [entry.item.pieceId, { x: entry.node.position.x + oldX, y: entry.node.position.y }]));
        this.trayMotion = null; scroll.stopAutoScroll();
        const contentWidth = Math.max(width, 2 * this.trayPadding + ids.length * slot + Math.max(0, ids.length - 1) * this.trayGap);
        this.traySlots.clear();
        ids.forEach((id, i) => this.traySlots.set(id, { position: { x: -contentWidth / 2 + this.trayPadding + slot / 2 + i * pitch, y: 0 } }));
        // Removing slots before the viewport should not jump the player back to page one.
        const leading = Math.floor(oldOffset / pitch);
        const before = (oldIds ?? []).slice(0, leading).filter(id => !ids.includes(id)).length;
        const inserted = ids.slice(0, leading).filter(id => oldIds !== null && !oldIds.includes(id)).length;
        const max = Math.max(0, contentWidth - width);
        const offset = Math.max(0, Math.min(max, oldOffset + (inserted - before) * pitch));
        ui.width = contentWidth;
        scroll.scrollToOffset(new Vec2(Math.max(0, Math.min(max, oldOffset)), 0), 0);
        const contentFrom = tray.position.x, contentTo = (contentWidth - width) / 2 - offset;
        const pieces: { node: Node; from: Point2; to: Point2 }[] = [];
        for (const entry of this.pieceEntries()) {
            const target = this.traySlots.get(entry.item.pieceId), prior = start.get(entry.item.pieceId);
            if (!target || !prior) continue;
            const from = { x: prior.x - contentFrom, y: prior.y };
            entry.node.setPosition(from.x, from.y, 0);
            pieces.push({ node: entry.node, from, to: target.position });
        }
        this.trayIds = ids;
        if (oldIds && (pieces.some(move => Math.abs(move.from.x - move.to.x) > .01 || Math.abs(move.from.y - move.to.y) > .01) || Math.abs(contentFrom - contentTo) > .01)) {
            if (this.trayScrollWasEnabled === null) this.trayScrollWasEnabled = scroll.enabled;
            scroll.enabled = false;
            this.trayMotion = { elapsed: 0, contentFrom, contentTo, offset, pieces };
        } else {
            pieces.forEach(move => move.node.setPosition(move.to.x, move.to.y, 0));
            scroll.scrollToOffset(new Vec2(offset, 0), 0);
            this.restoreTrayScroll();
        }
    }
    public update(dt: number): void {
        const motion = this.trayMotion; if (!motion) return;
        motion.elapsed += dt;
        const t = Math.min(1, Math.max(0, motion.elapsed / .22)), ease = 1 - Math.pow(1 - t, 3);
        if (isValid(this.piecesMount, true)) this.piecesMount!.setPosition(motion.contentFrom + (motion.contentTo - motion.contentFrom) * ease, this.piecesMount!.position.y, 0);
        motion.pieces.forEach(move => { if (isValid(move.node, true) && move.node.parent === this.piecesMount) move.node.setPosition(move.from.x + (move.to.x - move.from.x) * ease, move.from.y + (move.to.y - move.from.y) * ease, 0); });
        if (t >= 1) this.finishTrayMotion();
    }
    private finishTrayMotion(): void {
        const motion = this.trayMotion; this.trayMotion = null;
        if (!motion) return;
        motion.pieces.forEach(move => { if (isValid(move.node, true) && move.node.parent === this.piecesMount) move.node.setPosition(move.to.x, move.to.y, 0); });
        if (isValid(this.trayScroll, true)) this.trayScroll!.scrollToOffset(new Vec2(motion.offset, 0), 0);
        this.restoreTrayScroll();
    }
    private restoreTrayScroll(): void {
        if (this.trayScrollWasEnabled !== null && isValid(this.trayScroll, true)) this.trayScroll!.enabled = this.trayScrollWasEnabled;
        this.trayScrollWasEnabled = null;
    }
    public scrollTray(direction: number): void {
        const scroll=this.trayScroll, viewport=this.trayViewport?.getComponent(UITransform);
        if (!scroll || !viewport) return;
        scroll.scrollToOffset(new Vec2(Math.min(scroll.getMaxScrollOffset().x,Math.max(0,-scroll.getScrollOffset().x + direction*viewport.width)),0),0.2);
    }
    public drawHint(cells: readonly AxialCell[]): void {
        const g=this.hintGraphics; if (!g || !this.boardFit) return; g.clear();
        hintColors??={stroke:new Color(255,231,105,255),fill:new Color(255,231,105,75)};
        g.lineWidth=5;g.strokeColor=hintColors.stroke;g.fillColor=hintColors.fill;
        for(const cell of cells){const p=this.pointOfCell(cell);for(let i=0;i<6;i++){const a=i*Math.PI/3,x=p.x+Math.cos(a)*this.boardFit.radius,y=p.y+Math.sin(a)*this.boardFit.radius;if(i===0)g.moveTo(x,y);else g.lineTo(x,y);}g.close();g.fill();g.stroke();}
    }
    public cancelPending(): void {
        if (this.disposed) return;
        this.finishTrayMotion();
        this.revision++;
        (this.cells || []).forEach(entry => { if (isValid(entry.item, true)) entry.item.cancelPending(); });
        (this.pieces || []).forEach(entry => { if (isValid(entry.item, true)) entry.item.cancelPending(); });
    }
    public clear(): void {
        if (this.disposed || !isValid(this, true)) return;
        this.cancelPending(); this.levelId = ''; this.level = null; this.boardFit = null; this.trayFit = null;
        this.trayIds = null; this.traySlots.clear();
        (this.cells || []).forEach(entry => { if (isValid(entry.node, true)) entry.node.active = false; });
        (this.pieces || []).forEach(entry => {
            if (isValid(entry.item, true)) entry.item.clear();
            if (isValid(entry.node, true)) entry.node.active = false;
        });
        [this.boardFloor, this.boardRim, this.boardShadow].forEach(geometry => {
            if (isValid(geometry, true) && isValid(geometry!.node, true)) geometry!.node.active = false;
        });
    }
    public onDisable(): void { this.cancelPending(); }
    public onDestroy(): void {
        if (this.disposed) return;
        this.cancelPending(); this.disposed = true;
        // boardMount/piecesMount are serialized descendants. Creator owns subtree
        // teardown; their components may already be destroyed and fields nulled.
        this.cells = []; this.pieces = [];
    }
    private current(revision: number): boolean {
        return revision === this.revision && !this.disposed && isValid(this, true) && this.enabled && this.node.activeInHierarchy;
    }
}
