import { _decorator, Sprite, Button } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('RewardItemView')
export class RewardItemView extends BaseView {
    @property(Sprite) public icon: Sprite | null = null;
    @property(Button) public button: Button | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('RewardItemView', 'icon', this.icon);
        requireBinding('RewardItemView', 'button', this.button);

    }
}
