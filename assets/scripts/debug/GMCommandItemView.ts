import { _decorator, Button, Label } from 'cc';
import { BaseView } from '../framework/ui/BaseView';
import { requireBinding } from '../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('GMCommandItemView')
export class GMCommandItemView extends BaseView {
    @property(Button) public button: Button | null = null;
    @property(Label) public label: Label | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('GMCommandItemView', 'button', this.button);
        requireBinding('GMCommandItemView', 'label', this.label);

    }
}
