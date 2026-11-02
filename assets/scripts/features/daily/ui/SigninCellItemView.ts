import { _decorator, Sprite } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('SigninCellItemView')
export class SigninCellItemView extends BaseView {
    @property(Sprite) public icon: Sprite | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('SigninCellItemView', 'icon', this.icon);

    }
}
