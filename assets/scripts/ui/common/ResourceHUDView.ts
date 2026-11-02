import { _decorator, Label, Sprite, Button } from 'cc';
import { BaseView } from '../../framework/ui/BaseView';
import { requireBinding } from '../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('ResourceHUDView')
export class ResourceHUDView extends BaseView {
    @property(Label) public honeyLabel: Label | null = null;
    @property(Label) public hintLabel: Label | null = null;
    @property(Sprite) public avatar: Sprite | null = null;
    @property(Button) public settingsButton: Button | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('ResourceHUDView', 'honeyLabel', this.honeyLabel);
        requireBinding('ResourceHUDView', 'hintLabel', this.hintLabel);
        requireBinding('ResourceHUDView', 'avatar', this.avatar);
        requireBinding('ResourceHUDView', 'settingsButton', this.settingsButton);

    }
}
