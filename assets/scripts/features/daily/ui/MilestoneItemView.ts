import { _decorator, Sprite } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('MilestoneItemView')
export class MilestoneItemView extends BaseView {
    @property(Sprite) public icon: Sprite | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('MilestoneItemView', 'icon', this.icon);

    }
}
