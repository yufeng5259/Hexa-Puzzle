import { _decorator, Button, Component, instantiate, isValid, Node, Prefab, UITransform } from 'cc';
import type { EventTouch } from 'cc';
import { requireBinding } from '../../../framework/components/Binding';
import type { ResourceScope } from '../../../framework/resources/ResourceScope';
import { PresentationItem } from '../../presentation/PresentationItem';
import { centeredCells, insideHex, type AxialCell, type Point2 } from './PuzzleLayout';
const { ccclass, property } = _decorator;
export interface PieceDisplay { piece: { id: string; cells: readonly AxialCell[] }; radius: number; assetId: string; }

/** One real piece = one Prefab instance. Inputs only emit an intent; no movement/rules here. */
@ccclass('PuzzlePiecePresentation')
export class PuzzlePiecePresentation extends Component {
    @property(Node) public previewRoot: Node | null = null;
    @property(Node) public cellsRoot: Node | null = null;
    @property(Prefab) public cellPrefab: Prefab | null = null;
    @property(UITransform) public touchArea: UITransform | null = null;
    public pieceId = '';
    public cells: readonly AxialCell[] = [];
    public radius = 0;
    private items: { node: Node; item: PresentationItem }[] = [];
    private revision = 0;
    private disposed = false;

    public async present(scope: ResourceScope, data: PieceDisplay): Promise<void> {
        this.cancelPending();
        const revision = this.revision;
        if (!this.current(revision)) return;
        this.pieceId = '';
        requireBinding('PuzzlePiecePresentation', 'previewRoot', this.previewRoot).active = false;
        const mount = requireBinding('PuzzlePiecePresentation', 'cellsRoot', this.cellsRoot);
        const prefab = requireBinding('PuzzlePiecePresentation', 'cellPrefab', this.cellPrefab);
        const touch = requireBinding('PuzzlePiecePresentation', 'touchArea', this.touchArea);
        const button = this.node.getComponent(Button);
        if (button) button.interactable = false;
        if (touch.node !== this.node) throw new Error('PuzzlePiecePresentation: touchArea must belong to its root');
        if (!data.piece.id || !data.assetId || scope.isReleased) throw new Error('PuzzlePiecePresentation: piece ID, registered asset and live borrowed scope required');
        const layout = centeredCells(data.piece.cells, data.radius), h = Math.sqrt(3) * data.radius;
        try {
            while (this.items.length < data.piece.cells.length) {
                const node = instantiate(prefab); node.parent = mount;
                const item = node.getComponent(PresentationItem);
                if (!item) { node.destroy(); throw new Error('PuzzlePiecePresentation: cell Prefab requires PresentationItem'); }
                this.items.push({ node, item });
            }
            await Promise.all(this.items.map(async (entry, i) => {
                entry.node.active = i < layout.centers.length;
                if (!entry.node.active) return;
                const center = layout.centers[i]; entry.node.setPosition(center.x - data.radius, center.y + h / 2, 0);
                await entry.item.present(scope, { bodyAssetId: data.assetId, rootSize: [2 * data.radius, h],
                    bodyBox: { x: data.radius, y: -h / 2, width: 2 * data.radius, height: h } });
            }));
            if (!this.current(revision) || scope.isReleased) return;
            touch.setContentSize(layout.width, layout.height);
            this.pieceId = data.piece.id; this.cells = data.piece.cells.map(cell => ({ ...cell })); this.radius = data.radius;
        } catch (error) {
            if (this.current(revision) && !scope.isReleased) { this.clear(); throw error; }
        }
    }
    public onEnable(): void {
        const node = this.touchArea?.node;
        node?.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        node?.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        node?.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        node?.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }
    public onTouchStart(event?: EventTouch): void { this.emitInput('start', event); }
    public onTouchMove(event?: EventTouch): void { this.emitInput('move', event); }
    public onTouchEnd(event?: EventTouch): void { this.emitInput('end', event); }
    public onTouchCancel(event?: EventTouch): void { this.emitInput('cancel', event); }
    public containsLocal(point: Point2): boolean {
        return this.radius > 0 && this.cells.length > 0 && centeredCells(this.cells, this.radius).centers.some(center =>
            insideHex({ x: point.x - center.x, y: point.y - center.y }, this.radius));
    }
    private emitInput(phase: string, event?: EventTouch): void {
        if (!this.pieceId) return;
        const point = event?.getUILocation();
        this.node.emit('puzzle-piece-input', { phase, pieceId: this.pieceId,
            ...(point ? { pointerId: event!.getID(), point: { x: point.x, y: point.y } } : {}) });
    }
    public cancelPending(): void {
        if (this.disposed) return;
        this.revision++;
        (this.items || []).forEach(entry => { if (isValid(entry.item, true)) entry.item.cancelPending(); });
    }
    public clear(): void {
        if (this.disposed || !isValid(this, true)) return;
        this.cancelPending(); this.pieceId = ''; this.cells = []; this.radius = 0;
        (this.items || []).forEach(entry => { if (isValid(entry.node, true)) entry.node.active = false; });
    }
    public onDisable(): void {
        this.cancelPending(); const node = this.touchArea?.node;
        if (!isValid(node, true)) return;
        node!.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        node!.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        node!.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        node!.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }
    public onDestroy(): void {
        if (this.disposed) return;
        this.onDisable(); this.disposed = true;
        // These instances are descendants of cellsRoot. Creator destroys that subtree,
        // possibly before this component; never destroy the same children again here.
        this.items = [];
    }
    private current(revision: number): boolean {
        return revision === this.revision && !this.disposed && isValid(this, true) && this.enabled && this.node.activeInHierarchy;
    }
}
