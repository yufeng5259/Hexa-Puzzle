import { _decorator, Sprite, Label, Button } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('MailItemView')
export class MailItemView extends BaseView {
    @property(Sprite) public icon: Sprite | null = null;
    @property(Label) public titleLabel: Label | null = null;
    @property(Button) public button: Button | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('MailItemView', 'icon', this.icon);
        requireBinding('MailItemView', 'titleLabel', this.titleLabel);
        requireBinding('MailItemView', 'button', this.button);

    }
}
