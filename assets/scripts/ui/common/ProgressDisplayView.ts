import { _decorator, ProgressBar, Label } from 'cc';
import { BaseView } from '../../framework/ui/BaseView';
import { requireBinding } from '../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('ProgressDisplayView')
export class ProgressDisplayView extends BaseView {
    @property(ProgressBar) public progressBar: ProgressBar | null = null;
    @property(Label) public valueLabel: Label | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('ProgressDisplayView', 'progressBar', this.progressBar);
        requireBinding('ProgressDisplayView', 'valueLabel', this.valueLabel);

    }
}
