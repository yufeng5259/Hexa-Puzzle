import { _decorator } from 'cc';
import { BaseView } from '../../framework/ui/BaseView';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('DialogFrameView')
export class DialogFrameView extends BaseView {


    public validateBindings(): void {
        super.validateBindings();


    }
}
