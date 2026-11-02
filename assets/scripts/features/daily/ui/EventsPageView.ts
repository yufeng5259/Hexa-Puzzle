import { _decorator, Label, Button } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('EventsPageView')
export class EventsPageView extends BaseView {
    @property(Label) public titleLabel: Label | null = null;
    @property(Button) public backButton: Button | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('EventsPageView', 'titleLabel', this.titleLabel);
        requireBinding('EventsPageView', 'backButton', this.backButton);

    }
}
