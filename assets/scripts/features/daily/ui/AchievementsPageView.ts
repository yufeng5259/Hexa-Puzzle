import { _decorator, Label, Button, Prefab, ScrollView, Mask, Node } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('AchievementsPageView')
export class AchievementsPageView extends BaseView {
    @property(Label) public titleLabel: Label | null = null;
    @property(Button) public backButton: Button | null = null;
    @property(Prefab) public itemPrefab: Prefab | null = null;
    @property(ScrollView) public scrollView: ScrollView | null = null;
    @property(Mask) public viewport: Mask | null = null;
    @property(Node) public content: Node | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('AchievementsPageView', 'titleLabel', this.titleLabel);
        requireBinding('AchievementsPageView', 'backButton', this.backButton);
        requireBinding('AchievementsPageView', 'itemPrefab', this.itemPrefab);
        requireBinding('AchievementsPageView', 'scrollView', this.scrollView);
        requireBinding('AchievementsPageView', 'viewport', this.viewport);
        requireBinding('AchievementsPageView', 'content', this.content);

    }
}
