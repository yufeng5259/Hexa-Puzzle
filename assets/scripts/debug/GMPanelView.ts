import { _decorator, Prefab, Button, ScrollView, Mask, Node } from 'cc';
import { BaseView } from '../framework/ui/BaseView';
import { requireBinding } from '../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('GMPanelView')
export class GMPanelView extends BaseView {
    @property(Prefab) public commandPrefab: Prefab | null = null;
    @property(Button) public closeButton: Button | null = null;
    @property(ScrollView) public scrollView: ScrollView | null = null;
    @property(Mask) public viewport: Mask | null = null;
    @property(Node) public content: Node | null = null;

    public validateBindings(): void {
        super.validateBindings();
        requireBinding('GMPanelView', 'commandPrefab', this.commandPrefab);
        requireBinding('GMPanelView', 'closeButton', this.closeButton);
        requireBinding('GMPanelView', 'scrollView', this.scrollView);
        requireBinding('GMPanelView', 'viewport', this.viewport);
        requireBinding('GMPanelView', 'content', this.content);

    }
}
