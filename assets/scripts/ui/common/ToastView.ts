import { _decorator, Label } from 'cc';
import { BaseView } from '../../framework/ui/BaseView';
import { requireBinding } from '../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('ToastView')
export class ToastView extends BaseView {
    @property(Label) public messageLabel: Label | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('ToastView', 'messageLabel', this.messageLabel);

    }
}
