import { _decorator, Component, UITransform, view } from 'cc';

const { ccclass } = _decorator;

/**
 * Full-screen background: scales uniformly so it covers its parent (the screen-sized page root or backdrop)
 * when the screen's aspect differs from the 853×1844 design. Added by the prefab generator to full-canvas images.
 */
@ccclass('CoverFit')
export class CoverFit extends Component {
    onEnable(): void {
        view.on('canvas-resize', this.fit, this);
        this.fit();
        // Widgets on the parent align during the frame; fit again once sizes are final.
        this.scheduleOnce(this.fit, 0);
    }

    onDisable(): void {
        view.off('canvas-resize', this.fit, this);
    }

    private fit(): void {
        const parent = this.node.parent!.getComponent(UITransform)!;
        const own = this.node.getComponent(UITransform)!;
        const scale = Math.max(parent.width / own.width, parent.height / own.height, 1);
        this.node.setScale(scale, scale, 1);
    }
}
