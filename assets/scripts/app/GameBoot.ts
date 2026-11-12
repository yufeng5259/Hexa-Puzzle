import { _decorator, Component, Label } from 'cc';
import { ViewHost } from '../framework/ui/ViewHost';

const { ccclass, property } = _decorator;

/**
 * v2 entry point on Main.scene. P0 keeps only the scene wiring (ViewHost and a
 * status label); services, configuration and navigation are assembled in P1.
 */
@ccclass('GameBoot')
export class GameBoot extends Component {
    @property(ViewHost) public host: ViewHost | null = null;
    @property(Label) public statusLabel: Label | null = null;

    protected start(): void {
        if (this.statusLabel) this.statusLabel.string = '蜂巢小镇 v2 重建中';
    }

    /** Serialized retry button handler; reused once boot can fail in P1. */
    public onRetry(): void {
        this.start();
    }
}
