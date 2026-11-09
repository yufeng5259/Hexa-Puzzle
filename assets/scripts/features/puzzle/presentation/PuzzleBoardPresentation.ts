import { _decorator, CCString, Component, instantiate, isValid, Label, Node, Prefab, ScrollView, Vec2, Graphics, Color, UITransform } from 'cc';
import { requireBinding } from '../../../framework/components/Binding';
import type { ResourceScope } from '../../../framework/resources/ResourceScope';
import { PresentationItem } from '../../presentation/PresentationItem';
import { SourceGeometry } from '../../presentation/SourceGeometry';
import type { LevelDefinition } from '../data/LevelCatalog';
import { axialPoint, fitCells, fitTray, fitTrayWindow, pieceCenter, type AxialCell, type HexFit, type Point2, type TrayFit } from './PuzzleLayout';
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

    /** Called before fixture layout/item rendering so authored sample cells never cover real data. */
    public activateLevel(): void {
        const live = requireBinding('PuzzleBoardPresentation', 'liveRoot', this.liveRoot);
        if (!this.fixtureNodes.length && !this.trayScroll) throw new Error('PuzzleBoardPresentation: fixtures or authored scrolling tray required');
        this.fixtureNodes.forEach((node, i) => requireBinding('PuzzleBoardPresentation', `fixtureNodes[${i}]`, node));
        this.fixtureNodes.forEach(node => { node.active = false; }); live.active = true;
    }

    public async present(scope: ResourceScope, level: LevelDefinition): Promise<void> {
        this.cancelPending();
        const revision = this.revision;
        if (!this.current(revision)) return;
        this.activateLevel();
        const board = requireBinding('PuzzleBoardPresentation', 'boardMount', this.boardMount);
        const tray = requireBinding('PuzzleBoardPresentation', 'piecesMount', this.piecesMount);
        const boardUI = requireBinding('PuzzleBoardPresentation', 'boardMount.UITransform', board.getComponent(UITransform));
        const trayUI = requireBinding('PuzzleBoardPresentation', 'piecesMount.UITransform', tray.getComponent(UITransform));
        const cellPrefab = requireBinding('PuzzleBoardPresentation', 'cellPrefab', this.cellPrefab);
        const piecePrefab = requireBinding('PuzzleBoardPresentation', 'piecePrefab', this.piecePrefab);
        const geometries = [this.boardShadow, this.boardFloor, this.boardRim].map((g, i) => requireBinding('PuzzleBoardPresentation', ['boardShadow', 'boardFloor', 'boardRim'][i], g));
        if (scope.isReleased || !this.wellAssetId || !this.obstacleAssetId) throw new Error('PuzzleBoardPresentation: registered cell assets and live borrowed scope required');
        let textures: Record<string, string>;
        try { textures = JSON.parse(this.textureAssetIds); } catch { throw new Error('PuzzleBoardPresentation: invalid textureAssetIds JSON'); }
        if (!textures || typeof textures !== 'object' || level.pieces.some(piece => typeof textures[piece.textureName] !== 'string' || !textures[piece.textureName].trim())) {
            throw new Error('PuzzleBoardPresentation: every piece textureName requires a registered asset mapping');
        }
        const allCells = [...level.targetCells, ...level.obstacleCells];
        const fit = fitCells(allCells, boardUI.width, boardUI.height, this.boardPadding);
        const viewport = this.trayViewport?.getComponent(UITransform);
        const trayWidth = viewport?.width || trayUI.width;
        const trayFit = this.trayScroll ? fitTrayWindow(level.pieces, trayWidth, trayUI.height, this.trayGap, this.trayPadding) : fitTray(level.pieces, trayUI.width, trayUI.height, this.trayGap, this.trayPadding);
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
                    // Reset on every reuse: a former obstacle can become a normal target slot.
                    requireBinding('PuzzleBoardPresentation', 'cell.PresentationItem.body', entry.item.body).grayscale = i >= level.targetCells.length;
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
        // Tray slots follow level order; filtered live entries must not shift a piece into another slot.
        const slots = new Map(level.pieces.map((piece, i) => [piece.id, i]));
        this.pieceEntries().forEach(entry => {
            const translation = snapshot.placements[entry.item.pieceId];
            if (!translation && !slots.has(entry.item.pieceId)) throw new Error(`PuzzleBoardPresentation: unknown piece ${entry.item.pieceId}`);
            entry.node.parent = translation ? board : tray;
            const position = translation ? this.translationRootPosition(entry.item.pieceId, translation) : this.trayFit!.pieces[slots.get(entry.item.pieceId)!].position;
            entry.node.setPosition(position.x, position.y, 0);
            const scale = translation ? this.boardFit!.radius / entry.item.radius : 1;
            entry.node.setScale(scale, scale, 1);
            if (translation) { placed++; filled += entry.item.cells.length; }
        });
        if (this.remainingLabel) this.remainingLabel.string = String(level.mode === 'challenge' ? Math.max(0, level.moveLimit! - snapshot.moves) : this.countMoves ? snapshot.moves : level.pieces.length - placed);
        if (this.totalCellsLabel) this.totalCellsLabel.string = String(filled) + "/" + level.targetCells.length;
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
        this.revision++;
        (this.cells || []).forEach(entry => { if (isValid(entry.item, true)) entry.item.cancelPending(); });
        (this.pieces || []).forEach(entry => { if (isValid(entry.item, true)) entry.item.cancelPending(); });
    }
    public clear(): void {
        if (this.disposed || !isValid(this, true)) return;
        this.cancelPending(); this.levelId = ''; this.level = null; this.boardFit = null; this.trayFit = null;
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
