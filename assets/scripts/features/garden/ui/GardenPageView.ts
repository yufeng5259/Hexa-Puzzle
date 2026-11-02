import { _decorator, Label, Button, Node, Prefab, ProgressBar } from 'cc';
import { SerializedView } from '../../../ui/common/SerializedView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('GardenPageView')
export class GardenPageView extends SerializedView {
    @property(Label) public titleLabel: Label | null = null;
    @property(Button) public backButton: Button | null = null;
    @property(Node) public buildingsRoot: Node | null = null;
    @property(Prefab) public buildingPrefab: Prefab | null = null;
    @property(Node) public effectRoot: Node | null = null;
    @property(ProgressBar) public gardenProgress: ProgressBar | null = null;
    @property(Label) public gardenProgressLabel: Label | null = null;
    @property([Label]) private titleLabelStates: Label[] = [];
    @property([Button]) private backButtonStates: Button[] = [];
    @property([Node]) private buildingsRootStates: Node[] = [];
    @property([Prefab]) private buildingPrefabStates: Prefab[] = [];
    @property([Node]) private effectRootStates: Node[] = [];
    @property([ProgressBar]) private gardenProgressStates: ProgressBar[] = [];
    @property([Label]) private gardenProgressLabelStates: Label[] = [];
    public selectState(id?: string): void {
        super.selectState(id);
        const index = id ? this.stateIds.indexOf(id) : 0;
        this.titleLabel = this.titleLabelStates[index];
        this.backButton = this.backButtonStates[index];
        this.buildingsRoot = this.buildingsRootStates[index];
        this.buildingPrefab = this.buildingPrefabStates[index];
        this.effectRoot = this.effectRootStates[index];
        this.gardenProgress = this.gardenProgressStates[index];
        this.gardenProgressLabel = this.gardenProgressLabelStates[index];
    }
    public validateBindings(): void {
        super.validateBindings();
        requireBinding('GardenPageView', 'titleLabel', this.titleLabel);
        requireBinding('GardenPageView', 'backButton', this.backButton);
        requireBinding('GardenPageView', 'buildingsRoot', this.buildingsRoot);
        requireBinding('GardenPageView', 'buildingPrefab', this.buildingPrefab);
        requireBinding('GardenPageView', 'effectRoot', this.effectRoot);
        requireBinding('GardenPageView', 'gardenProgress', this.gardenProgress);
        requireBinding('GardenPageView', 'gardenProgressLabel', this.gardenProgressLabel);
        if (this.titleLabelStates.length !== this.stateIds.length || this.titleLabelStates.some(value => !value)) throw new Error('GardenPageView.titleLabel: incomplete state bindings');
        if (this.backButtonStates.length !== this.stateIds.length || this.backButtonStates.some(value => !value)) throw new Error('GardenPageView.backButton: incomplete state bindings');
        if (this.buildingsRootStates.length !== this.stateIds.length || this.buildingsRootStates.some(value => !value)) throw new Error('GardenPageView.buildingsRoot: incomplete state bindings');
        if (this.buildingPrefabStates.length !== this.stateIds.length || this.buildingPrefabStates.some(value => !value)) throw new Error('GardenPageView.buildingPrefab: incomplete state bindings');
        if (this.effectRootStates.length !== this.stateIds.length || this.effectRootStates.some(value => !value)) throw new Error('GardenPageView.effectRoot: incomplete state bindings');
        if (this.gardenProgressStates.length !== this.stateIds.length || this.gardenProgressStates.some(value => !value)) throw new Error('GardenPageView.gardenProgress: incomplete state bindings');
        if (this.gardenProgressLabelStates.length !== this.stateIds.length || this.gardenProgressLabelStates.some(value => !value)) throw new Error('GardenPageView.gardenProgressLabel: incomplete state bindings');
    }
}
