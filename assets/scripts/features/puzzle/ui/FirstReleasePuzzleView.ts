import { _decorator, Camera, isValid, Label, Node, UITransform, Vec3 } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import type { ResourceScope } from '../../../framework/resources/ResourceScope';
import { requireBinding } from '../../../framework/components/Binding';
import { PuzzleBoardPresentation } from '../presentation/PuzzleBoardPresentation';
import { PuzzleController } from '../controller/PuzzleController';
import type { LevelDefinition, HexCell } from '../data/LevelDefinition';
import { PuzzleSession } from '../session/PuzzleSession';
import { centeredCells, type Point2 } from '../presentation/PuzzleLayout';
import type { GuideTarget } from '../../guide/GuideOverlayView';
const { ccclass, property } = _decorator;

@ccclass('FirstReleasePuzzleView')
export class FirstReleasePuzzleView extends BaseView {
    @property(PuzzleBoardPresentation) public board: PuzzleBoardPresentation | null = null;
    @property(PuzzleController) public controller: PuzzleController | null = null;
    @property(Label) public hintCountLabel: Label | null = null;
    @property(Node) public backButton: Node | null = null;
    @property(Node) public settingsButton: Node | null = null;
    @property(Node) public undoButton: Node | null = null;
    @property(Node) public restartButton: Node | null = null;
    @property(Node) public hintButton: Node | null = null;
    public session: PuzzleSession | null = null;
    public allowAction: ((action: string) => boolean) | null = null;
    private unsubscribe: (() => void) | null = null;
    public validateBindings(): void {
        for (const field of ['board','controller','hintCountLabel','backButton','settingsButton','undoButton','restartButton','hintButton'] as const) requireBinding('FirstReleasePuzzleView',field,this[field]);
    }
    public async setLevel(scope: ResourceScope, level: LevelDefinition, session: PuzzleSession, camera?: Camera | null): Promise<void> {
        this.unsubscribe?.(); this.unsubscribe=null;
        this.controller!.suspend();
        await this.board!.present(scope,level);
        if (this.isClosed) return;
        this.session=session;this.controller!.inputCamera=camera || null;
        this.controller!.bind(session);
        this.unsubscribe=session.subscribe(()=>this.projectHint());
        this.projectHint();
    }
    public setHints(count: number): void { this.hintCountLabel!.string=String(count); }
    public undo(): void { this.controller!.onReturnPiece(); }
    public showHint(): void { this.session?.activateHint(); this.projectHint(); }
    public previousTray(): void { if (!this.board!.isTraySettling && (!this.allowAction || this.allowAction('puzzle:tray'))) this.board!.scrollTray(-1); }
    public nextTray(): void { if (!this.board!.isTraySettling && (!this.allowAction || this.allowAction('puzzle:tray'))) this.board!.scrollTray(1); }
    public pieceTarget(id: string): Node | null { return this.board!.pieceEntries().find(entry=>entry.item.pieceId===id)?.node || null; }
    public draggedGuidePolygons(): Point2[][] | null {
        const id = this.controller?.draggingPieceId;
        const entry = id && this.board?.pieceEntries().find(value => value.item.pieceId === id);
        if (!entry) return null;
        const ui = entry.node.getComponent(UITransform)!, fit = centeredCells(entry.item.cells, entry.item.radius);
        return fit.centers.map(center => Array.from({ length: 6 }, (_, i) => {
            const angle = i * Math.PI / 3;
            const p = ui.convertToWorldSpaceAR(new Vec3(center.x + Math.cos(angle) * fit.radius, center.y + Math.sin(angle) * fit.radius, 0));
            return { x: p.x, y: p.y };
        }));
    }
    /** A stable tray pose, independent of the live piece's drag parent and enlarged scale. */
    public guidePieceTarget(id: string): GuideTarget {
        const saved = this.session?.snapshot.placements[id];
        const sourcePlacement = saved ? { ...saved } : null;
        return this.guideShape(() => {
            if (!this.guideIsVisible()) return null;
            const board = this.board!;
            if (board.isTraySettling) return null;
            const entry = board.pieceEntries().find(value => value.item.pieceId === id);
            if (sourcePlacement && entry && board.boardFit && board.boardMount) {
                return { ui: board.boardMount.getComponent(UITransform)!, radius: board.boardFit.radius,
                    centers: entry.item.cells.map(cell => board.pointOfCell({ q: cell.q + sourcePlacement.q, r: cell.r + sourcePlacement.r })) };
            }
            const slot = board.getTraySlot(id), ui = board.piecesMount?.getComponent(UITransform);
            if (!entry || !slot || !ui) return null;
            const fit = centeredCells(entry.item.cells, entry.item.radius);
            return { ui, radius: fit.radius, centers: fit.centers.map(p => ({ x: p.x + slot.position.x, y: p.y + slot.position.y })) };
        });
    }
    /** The complete configured placement, using the same axial coordinates as real picking. */
    public guideDestinationTarget(id: string, translation?: HexCell): GuideTarget {
        return this.guideShape(() => {
            if (!this.guideIsVisible()) return null;
            const board = this.board!, piece = this.session!.level.pieces.find(value => value.id === id);
            const ui = board.boardMount?.getComponent(UITransform);
            if (!piece || !board.boardFit || !ui) return null;
            const anchor = translation ?? piece.targetCells[0];
            return { ui, radius: board.boardFit.radius,
                centers: piece.cells.map(cell => board.pointOfCell({ q: cell.q + anchor.q, r: cell.r + anchor.r })) };
        });
    }
    private guideIsVisible(): boolean { return !this.isClosed && isValid(this, true) && this.node.activeInHierarchy && !!this.session; }
    private guideShape(frame: () => { ui: UITransform; radius: number; centers: Point2[] } | null): GuideTarget {
        const world = (ui: UITransform, point: Point2): Point2 => {
            const p = ui.convertToWorldSpaceAR(new Vec3(point.x, point.y, 0));
            return { x: p.x, y: p.y };
        };
        const polygons = (): Point2[][] | null => {
            const data = frame();
            return data ? data.centers.map(center => Array.from({ length: 6 }, (_, i) => {
                const angle = i * Math.PI / 3;
                return world(data.ui, { x: center.x + Math.cos(angle) * data.radius, y: center.y + Math.sin(angle) * data.radius });
            })) : null;
        };
        return {
            polygons,
            bounds: () => {
                const cells = polygons(); if (!cells?.length) return null;
                const points = cells.reduce((all, cell) => all.concat(cell), [] as Point2[]);
                const xs = points.map(p => p.x), ys = points.map(p => p.y);
                const left = Math.min(...xs), right = Math.max(...xs), bottom = Math.min(...ys), top = Math.max(...ys);
                return { x: (left + right) / 2, y: (bottom + top) / 2, width: right - left, height: top - bottom };
            },
            point: () => { const data = frame(); return data?.centers.length ? world(data.ui, data.centers[0]) : null; },
        };
    }
    public cellTarget(cell: HexCell): { x: number; y: number; width: number; height: number } | null {
        const board=this.board!;if(!board.boardFit)return null;
        const p=board.pointOfCell(cell),world=board.boardMount!.getComponent(UITransform)!.convertToWorldSpaceAR(new Vec3(p.x,p.y,0));
        const scale=board.boardMount!.worldScale;
        return {x:world.x,y:world.y,width:board.boardFit.radius*2*scale.x,height:board.boardFit.radius*Math.sqrt(3)*scale.y};
    }
    private projectHint(): void {
        const hint=this.session?.snapshot.activeHintPieceId ? this.session.hintCandidate() : null;
        this.board!.drawHint(hint?.cells || []);
    }
    protected onHidden(): void { this.controller?.suspend(); }
    protected onShown(): void { if(this.session)this.controller?.resume(); }
    protected onClosed(): void { this.unsubscribe?.();this.unsubscribe=null;this.session=null;this.allowAction=null; }
}
