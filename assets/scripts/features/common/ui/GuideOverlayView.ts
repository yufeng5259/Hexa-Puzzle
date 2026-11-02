import { _decorator, Sprite, Label } from 'cc';
import { SerializedView } from '../../../ui/common/SerializedView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('GuideOverlayView')
export class GuideOverlayView extends SerializedView {
    @property(Sprite) public hand: Sprite | null = null;
    @property(Label) public bubbleLabel: Label | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('GuideOverlayView', 'hand', this.hand);
        requireBinding('GuideOverlayView', 'bubbleLabel', this.bubbleLabel);

    }
}
