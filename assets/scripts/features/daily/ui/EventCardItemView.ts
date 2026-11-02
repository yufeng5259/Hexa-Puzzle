import { _decorator, Sprite, Label, Button } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('EventCardItemView')
export class EventCardItemView extends BaseView {
    @property(Sprite) public icon: Sprite | null = null;
    @property(Label) public titleLabel: Label | null = null;
    @property(Button) public button: Button | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('EventCardItemView', 'icon', this.icon);
        requireBinding('EventCardItemView', 'titleLabel', this.titleLabel);
        requireBinding('EventCardItemView', 'button', this.button);

    }
}
