import { _decorator, Button, Sprite, Label } from 'cc';
import { BaseView } from '../../framework/ui/BaseView';
import { requireBinding } from '../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('CommonButtonView')
export class CommonButtonView extends BaseView {
    @property(Button) public button: Button | null = null;
    @property(Sprite) public background: Sprite | null = null;
    @property(Label) public label: Label | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('CommonButtonView', 'button', this.button);
        requireBinding('CommonButtonView', 'background', this.background);
        requireBinding('CommonButtonView', 'label', this.label);

    }
}
