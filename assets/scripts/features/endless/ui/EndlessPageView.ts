import { _decorator, Label, Prefab, Button } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('EndlessPageView')
export class EndlessPageView extends BaseView {
    @property(Label) public titleLabel: Label | null = null;
    @property(Label) public scoreLabel: Label | null = null;
    @property(Prefab) public cellPrefab: Prefab | null = null;
    @property(Prefab) public piecePrefab: Prefab | null = null;
    @property(Button) public harvestButton: Button | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('EndlessPageView', 'titleLabel', this.titleLabel);
        requireBinding('EndlessPageView', 'scoreLabel', this.scoreLabel);
        requireBinding('EndlessPageView', 'cellPrefab', this.cellPrefab);
        requireBinding('EndlessPageView', 'piecePrefab', this.piecePrefab);
        requireBinding('EndlessPageView', 'harvestButton', this.harvestButton);

    }
}
