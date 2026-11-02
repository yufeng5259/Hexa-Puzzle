import { _decorator, Label, Node, Button } from 'cc';
import { SerializedView } from '../../../ui/common/SerializedView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('PuzzlePreviewView')
export class PuzzlePreviewView extends SerializedView {
    @property(Label) public titleLabel: Label | null = null;
    @property(Node) public boardRoot: Node | null = null;
    @property(Node) public trayRoot: Node | null = null;
    @property(Button) public startButton: Button | null = null;
    @property(Button) public backButton: Button | null = null;
    @property(Label) public rewardLabel: Label | null = null;
    @property([Label]) private titleLabelStates: Label[] = [];
    @property([Node]) private boardRootStates: Node[] = [];
    @property([Node]) private trayRootStates: Node[] = [];
    @property([Button]) private startButtonStates: Button[] = [];
    @property([Button]) private backButtonStates: Button[] = [];
    @property([Label]) private rewardLabelStates: Label[] = [];
    public selectState(id?: string): void {
        super.selectState(id);
        const index = id ? this.stateIds.indexOf(id) : 0;
        this.titleLabel = this.titleLabelStates[index];
        this.boardRoot = this.boardRootStates[index];
        this.trayRoot = this.trayRootStates[index];
        this.startButton = this.startButtonStates[index];
        this.backButton = this.backButtonStates[index];
        this.rewardLabel = this.rewardLabelStates[index];
    }
    public validateBindings(): void {
        super.validateBindings();
        requireBinding('PuzzlePreviewView', 'titleLabel', this.titleLabel);
        requireBinding('PuzzlePreviewView', 'boardRoot', this.boardRoot);
        requireBinding('PuzzlePreviewView', 'trayRoot', this.trayRoot);
        requireBinding('PuzzlePreviewView', 'startButton', this.startButton);
        requireBinding('PuzzlePreviewView', 'backButton', this.backButton);
        requireBinding('PuzzlePreviewView', 'rewardLabel', this.rewardLabel);
        if (this.titleLabelStates.length !== this.stateIds.length || this.titleLabelStates.some(value => !value)) throw new Error('PuzzlePreviewView.titleLabel: incomplete state bindings');
        if (this.boardRootStates.length !== this.stateIds.length || this.boardRootStates.some(value => !value)) throw new Error('PuzzlePreviewView.boardRoot: incomplete state bindings');
        if (this.trayRootStates.length !== this.stateIds.length || this.trayRootStates.some(value => !value)) throw new Error('PuzzlePreviewView.trayRoot: incomplete state bindings');
        if (this.startButtonStates.length !== this.stateIds.length || this.startButtonStates.some(value => !value)) throw new Error('PuzzlePreviewView.startButton: incomplete state bindings');
        if (this.backButtonStates.length !== this.stateIds.length || this.backButtonStates.some(value => !value)) throw new Error('PuzzlePreviewView.backButton: incomplete state bindings');
        if (this.rewardLabelStates.length !== this.stateIds.length || this.rewardLabelStates.some(value => !value)) throw new Error('PuzzlePreviewView.rewardLabel: incomplete state bindings');
    }
}
