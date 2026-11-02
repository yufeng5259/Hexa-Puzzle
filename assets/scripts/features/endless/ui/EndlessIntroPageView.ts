import { _decorator, Label } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('EndlessIntroPageView')
export class EndlessIntroPageView extends BaseView {
    @property(Label) public titleLabel: Label | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('EndlessIntroPageView', 'titleLabel', this.titleLabel);

    }
}
