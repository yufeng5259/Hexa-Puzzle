import { _decorator, Sprite, Button } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('TaskItemView')
export class TaskItemView extends BaseView {
    @property(Sprite) public icon: Sprite | null = null;
    @property(Button) public button: Button | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('TaskItemView', 'icon', this.icon);
        requireBinding('TaskItemView', 'button', this.button);

    }
}
