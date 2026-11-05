import { _decorator, Component } from 'cc';
import { ResourceLease } from '../res/ResourceLease';
import { UIViewMeta } from './uiView';

const { ccclass } = _decorator;

export interface ViewHost {
    close(view: ViewBase<any>): void;
}

/**
 * BigHero ViewComponent lifecycle on 3.x:
 * onOpen (first open) → setInfo (every open) → changeListener(true) → onShow → onShowFinish
 * … onHide → changeListener(false) → onHideFinish … onClose (before destroy).
 */
@ccclass('ViewBase')
export class ViewBase<A = void> extends Component {
    readonly lease = new ResourceLease();
    meta!: UIViewMeta;
    host!: ViewHost;
    private openArgs!: A;
    private opened = false;
    private showed = false;

    get args(): A { return this.openArgs; }
    get isOpened(): boolean { return this.opened; }
    get isShowed(): boolean { return this.showed; }

    /** Called by UIManager only. */
    _open(args: A): void {
        this.openArgs = args;
        if (!this.opened) {
            this.opened = true;
            this.onOpen();
        }
        this.setInfo();
    }
    _setShowed(value: boolean): void {
        if (this.showed === value) return;
        this.showed = value;
        this.changeListener(value);
        if (value) this.onShow(); else this.onHide();
    }
    _close(): void {
        this.opened = false;
        this.onClose();
        this.lease.releaseAll();
    }

    close(): void { this.host.close(this); }

    /** Back key / back button; default closes this view. */
    onBack(): void { this.close(); }

    protected onOpen(): void {}
    protected setInfo(): void {}
    protected changeListener(_enabled: boolean): void {}
    protected onShow(): void {}
    onShowFinish(): void {}
    protected onHide(): void {}
    onHideFinish(): void {}
    protected onClose(): void {}
}
