import { _decorator, Label, Button } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('DailyTasksPageView')
export class DailyTasksPageView extends BaseView {
    @property(Label) public titleLabel: Label | null = null;
    @property(Button) public backButton: Button | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('DailyTasksPageView', 'titleLabel', this.titleLabel);
        requireBinding('DailyTasksPageView', 'backButton', this.backButton);

    }
}
