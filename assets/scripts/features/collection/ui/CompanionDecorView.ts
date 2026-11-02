import { _decorator, Label, Button } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('CompanionDecorView')
export class CompanionDecorView extends BaseView {
    @property(Label) public titleLabel: Label | null = null;
    @property(Button) public backButton: Button | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('CompanionDecorView', 'titleLabel', this.titleLabel);
        requireBinding('CompanionDecorView', 'backButton', this.backButton);

    }
}
