import { _decorator, Sprite, Label } from 'cc';
import { BaseView } from '../../framework/ui/BaseView';
import { requireBinding } from '../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('ResourceCounterView')
export class ResourceCounterView extends BaseView {
    @property(Sprite) public icon: Sprite | null = null;
    @property(Label) public valueLabel: Label | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('ResourceCounterView', 'icon', this.icon);
        requireBinding('ResourceCounterView', 'valueLabel', this.valueLabel);

    }
}
