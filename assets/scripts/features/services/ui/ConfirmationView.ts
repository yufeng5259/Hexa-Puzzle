import { _decorator, Label, Button } from 'cc';
import { SerializedView } from '../../../ui/common/SerializedView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('ConfirmationView')
export class ConfirmationView extends SerializedView {
    @property(Label) public titleLabel: Label | null = null;
    @property(Button) public backButton: Button | null = null;
    @property([Label]) private titleLabelStates: Label[] = [];
    @property([Button]) private backButtonStates: Button[] = [];
    public selectState(id?: string): void {
        super.selectState(id);
        const index = id ? this.stateIds.indexOf(id) : 0;
        this.titleLabel = this.titleLabelStates[index];
        this.backButton = this.backButtonStates[index];
    }
    public validateBindings(): void {
        super.validateBindings();
        requireBinding('ConfirmationView', 'titleLabel', this.titleLabel);
        requireBinding('ConfirmationView', 'backButton', this.backButton);
        if (this.titleLabelStates.length !== this.stateIds.length || this.titleLabelStates.some(value => !value)) throw new Error('ConfirmationView.titleLabel: incomplete state bindings');
        if (this.backButtonStates.length !== this.stateIds.length || this.backButtonStates.some(value => !value)) throw new Error('ConfirmationView.backButton: incomplete state bindings');
    }
}
