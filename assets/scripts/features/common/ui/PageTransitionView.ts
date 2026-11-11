import { _decorator, Graphics, isValid, UIOpacity, UITransform } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** A serialized curtain owns input blocking; the old page stays alive until cover completes. */
@ccclass('PageTransitionView')
export class PageTransitionView extends BaseView {
    @property(Graphics) public curtain: Graphics | null = null;
    @property(UIOpacity) public opacity: UIOpacity | null = null;
    public phase: 'idle' | 'preparing' | 'covering' | 'covered' | 'revealing' = 'idle';
    private motion: { elapsed: number; fade: number; entrance: number; reveal: boolean;
        target: UIOpacity | null; y: number; resolve: (completed: boolean) => void } | null = null;
    public get busy(): boolean { return this.phase !== 'idle'; }
    public validateBindings(): void {
        requireBinding('PageTransitionView', 'curtain', this.curtain);
        requireBinding('PageTransitionView', 'opacity', this.opacity);
    }
    public begin(): void {
        this.reset(); this.opacity!.opacity = 0; this.phase = 'preparing'; this.show();
        this.node.setSiblingIndex(this.node.parent!.children.length - 1);
    }
    public cover(seconds: number): Promise<boolean> { return this.animate(seconds, false, null, 0); }
    public reveal(seconds: number, target: UIOpacity, entrance: number): Promise<boolean> {
        return this.animate(seconds, true, target, entrance);
    }
    private animate(fade: number, reveal: boolean, target: UIOpacity | null, entrance: number): Promise<boolean> {
        if (![fade, entrance].every(n => Number.isFinite(n) && n >= 0)) throw new Error('Invalid page transition duration');
        this.cancel(); this.phase = reveal ? 'revealing' : 'covering';
        return new Promise(resolve => {
            const y = target?.node.position.y ?? 0;
            if (target && entrance > 0) { target.opacity = 220; target.node.setPosition(target.node.position.x, y - 14, 0); }
            this.motion = { elapsed: 0, fade, reveal, entrance, target, y, resolve };
            this.update(0);
        });
    }
    public update(dt: number): void {
        const m = this.motion; if (!m) return;
        m.elapsed += Math.max(0, dt);
        const t = m.fade === 0 ? 1 : Math.min(1, m.elapsed / m.fade), ease = t * t * (3 - 2 * t);
        this.opacity!.opacity = Math.round(255 * (m.reveal ? 1 - ease : ease));
        this.paint();
        if (m.target && isValid(m.target, true)) {
            const p = m.entrance === 0 ? 1 : Math.min(1, m.elapsed / m.entrance), e = 1 - Math.pow(1 - p, 3);
            m.target.opacity = Math.round(220 + 35 * e);
            m.target.node.setPosition(m.target.node.position.x, m.y - 14 * (1 - e), 0);
        }
        if (m.elapsed >= Math.max(m.fade, m.entrance)) {
            this.motion = null; this.phase = m.reveal ? 'idle' : 'covered';
            if (m.reveal) this.hide();
            m.resolve(true);
        }
    }
    public reset(): void { this.cancel(); this.phase = 'idle'; if (this.opacity) this.opacity.opacity = 0; this.hide(); }
    private cancel(): void {
        const m = this.motion; this.motion = null;
        if (!m) return;
        if (m.target && isValid(m.target, true)) { m.target.opacity = 255; m.target.node.setPosition(m.target.node.position.x, m.y, 0); }
        m.resolve(false);
    }
    private paint(): void {
        const ui = requireBinding('PageTransitionView', 'UITransform', this.node.getComponent(UITransform));
        // Creator Graphics bakes alpha into vertices; UIOpacity alone does not fade its existing fill.
        const fill = this.curtain!.fillColor.clone(); fill.a = this.opacity!.opacity;
        this.curtain!.fillColor = fill;
        this.curtain!.clear(); this.curtain!.rect(-ui.width / 2, -ui.height / 2, ui.width, ui.height); this.curtain!.fill();
    }
    protected onShown(): void { this.paint(); }
    protected onHidden(): void { this.cancel(); this.phase = 'idle'; }
}
