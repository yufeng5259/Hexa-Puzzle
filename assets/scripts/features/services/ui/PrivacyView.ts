import { _decorator, Label, Button, ScrollView, Mask, Node } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('PrivacyView')
export class PrivacyView extends BaseView {
    @property(Label) public titleLabel: Label | null = null;
    @property(Button) public backButton: Button | null = null;
    @property(Label) public bodyLabel: Label | null = null;
    @property(ScrollView) public scrollView: ScrollView | null = null;
    @property(Mask) public viewport: Mask | null = null;
    @property(Node) public content: Node | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('PrivacyView', 'titleLabel', this.titleLabel);
        requireBinding('PrivacyView', 'backButton', this.backButton);
        requireBinding('PrivacyView', 'bodyLabel', this.bodyLabel);
        requireBinding('PrivacyView', 'scrollView', this.scrollView);
        requireBinding('PrivacyView', 'viewport', this.viewport);
        requireBinding('PrivacyView', 'content', this.content);

    }
}
