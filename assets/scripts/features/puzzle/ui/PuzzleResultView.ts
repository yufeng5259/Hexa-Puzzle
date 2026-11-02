import { _decorator, Label, Button } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('PuzzleResultView')
export class PuzzleResultView extends BaseView {
    @property(Label) public titleLabel: Label | null = null;
    @property(Button) public backButton: Button | null = null;
    @property(Button) public nextButton: Button | null = null;
    @property(Button) public gardenButton: Button | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('PuzzleResultView', 'titleLabel', this.titleLabel);
        requireBinding('PuzzleResultView', 'backButton', this.backButton);
        requireBinding('PuzzleResultView', 'nextButton', this.nextButton);
        requireBinding('PuzzleResultView', 'gardenButton', this.gardenButton);

    }
}
