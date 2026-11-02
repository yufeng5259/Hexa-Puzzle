import { _decorator, Label, Button } from 'cc';
import { SerializedView } from '../../../ui/common/SerializedView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('ChapterNextView')
export class ChapterNextView extends SerializedView {
    @property(Label) public titleLabel: Label | null = null;
    @property(Button) public backButton: Button | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('ChapterNextView', 'titleLabel', this.titleLabel);
        requireBinding('ChapterNextView', 'backButton', this.backButton);

    }
}
