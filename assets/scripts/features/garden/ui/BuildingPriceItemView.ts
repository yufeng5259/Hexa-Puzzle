import { _decorator, Sprite, Button, Label } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('BuildingPriceItemView')
export class BuildingPriceItemView extends BaseView {
    @property(Sprite) public icon: Sprite | null = null;
    @property(Button) public button: Button | null = null;
    @property(Label) public priceLabel: Label | null = null;
    @property(Sprite) public currencyIcon: Sprite | null = null;
    @property(Button) public upgradeButton: Button | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('BuildingPriceItemView', 'icon', this.icon);
        requireBinding('BuildingPriceItemView', 'button', this.button);
        requireBinding('BuildingPriceItemView', 'priceLabel', this.priceLabel);
        requireBinding('BuildingPriceItemView', 'currencyIcon', this.currencyIcon);
        requireBinding('BuildingPriceItemView', 'upgradeButton', this.upgradeButton);

    }
}
