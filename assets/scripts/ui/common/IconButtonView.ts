import { _decorator, Button, Sprite } from 'cc';
import { BaseView } from '../../framework/ui/BaseView';
import { requireBinding } from '../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('IconButtonView')
export class IconButtonView extends BaseView {
    @property(Button) public button: Button | null = null;
    @property(Sprite) public icon: Sprite | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('IconButtonView', 'button', this.button);
        requireBinding('IconButtonView', 'icon', this.icon);

    }
}
