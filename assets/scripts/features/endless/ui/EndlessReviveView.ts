import { _decorator, Label } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('EndlessReviveView')
export class EndlessReviveView extends BaseView {
    @property(Label) public titleLabel: Label | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('EndlessReviveView', 'titleLabel', this.titleLabel);

    }
}
