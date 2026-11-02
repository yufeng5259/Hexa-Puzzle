import { _decorator, Label, ProgressBar, isValid } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Startup progress display; FoundationBoot owns the loading work. */
@ccclass('LoadingPageView')
export class LoadingPageView extends BaseView {
    @property(ProgressBar) public progressBar: ProgressBar | null = null;
    @property(Label) public progressLabel: Label | null = null;

    public validateBindings(): void {
        requireBinding('LoadingPageView', 'progressBar', this.progressBar);
        requireBinding('LoadingPageView', 'progressLabel', this.progressLabel);
    }

    public setProgress(value: number): void {
        if (!isValid(this, true) || this.isClosed) return;
        if (!Number.isFinite(value)) throw new Error('LoadingPageView: progress must be finite');
        const progress = Math.min(1, Math.max(0, value));
        this.progressBar!.progress = progress;
        this.progressLabel!.string = `${Math.round(progress * 100)}%`;
    }
}
