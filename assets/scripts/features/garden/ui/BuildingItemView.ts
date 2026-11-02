import { _decorator, Sprite, Node } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('BuildingItemView')
export class BuildingItemView extends BaseView {
    @property(Sprite) public body: Sprite | null = null;
    @property(Node) public rotorRoot: Node | null = null;
    @property(Sprite) public rotor: Sprite | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('BuildingItemView', 'body', this.body);
        requireBinding('BuildingItemView', 'rotorRoot', this.rotorRoot);
        requireBinding('BuildingItemView', 'rotor', this.rotor);

    }
}
