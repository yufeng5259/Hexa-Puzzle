import { _decorator, Label, Button, ScrollView, Mask, Node } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('MailDetailView')
export class MailDetailView extends BaseView {
    @property(Label) public titleLabel: Label | null = null;
    @property(Button) public backButton: Button | null = null;
    @property(Label) public bodyLabel: Label | null = null;
    @property(ScrollView) public scrollView: ScrollView | null = null;
    @property(Mask) public viewport: Mask | null = null;
    @property(Node) public content: Node | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('MailDetailView', 'titleLabel', this.titleLabel);
        requireBinding('MailDetailView', 'backButton', this.backButton);
        requireBinding('MailDetailView', 'bodyLabel', this.bodyLabel);
        requireBinding('MailDetailView', 'scrollView', this.scrollView);
        requireBinding('MailDetailView', 'viewport', this.viewport);
        requireBinding('MailDetailView', 'content', this.content);

    }
}
