import { _decorator, Label, Button, Prefab, ScrollView, Mask, Node } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('CompanionListPageView')
export class CompanionListPageView extends BaseView {
    @property(Label) public titleLabel: Label | null = null;
    @property(Button) public backButton: Button | null = null;
    @property(Prefab) public itemPrefab: Prefab | null = null;
    @property(ScrollView) public scrollView: ScrollView | null = null;
    @property(Mask) public viewport: Mask | null = null;
    @property(Node) public content: Node | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('CompanionListPageView', 'titleLabel', this.titleLabel);
        requireBinding('CompanionListPageView', 'backButton', this.backButton);
        requireBinding('CompanionListPageView', 'itemPrefab', this.itemPrefab);
        requireBinding('CompanionListPageView', 'scrollView', this.scrollView);
        requireBinding('CompanionListPageView', 'viewport', this.viewport);
        requireBinding('CompanionListPageView', 'content', this.content);

    }
}
