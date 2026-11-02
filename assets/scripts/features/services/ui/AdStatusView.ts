import { _decorator, Label } from 'cc';
import { SerializedView } from '../../../ui/common/SerializedView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('AdStatusView')
export class AdStatusView extends SerializedView {
    @property(Label) public titleLabel: Label | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('AdStatusView', 'titleLabel', this.titleLabel);

    }
}
