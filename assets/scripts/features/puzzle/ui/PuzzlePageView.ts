import { _decorator, Label, Node, Prefab, Button } from 'cc';
import { SerializedView } from '../../../ui/common/SerializedView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

/** Prefab bindings for the actual controls; rules and services belong to the feature. */
@ccclass('PuzzlePageView')
export class PuzzlePageView extends SerializedView {
    @property(Label) public titleLabel: Label | null = null;
    @property(Node) public boardRoot: Node | null = null;
    @property(Node) public trayRoot: Node | null = null;
    @property(Node) public hintRoot: Node | null = null;
    @property(Prefab) public cellPrefab: Prefab | null = null;
    @property(Prefab) public slotPrefab: Prefab | null = null;
    @property(Prefab) public piecePrefab: Prefab | null = null;
    @property(Label) public remainingLabel: Label | null = null;
    @property(Button) public hintButton: Button | null = null;
    @property(Button) public returnPieceButton: Button | null = null;
    @property(Button) public pauseButton: Button | null = null;
    @property(Button) public helpButton: Button | null = null;
    @property([Label]) private titleLabelStates: Label[] = [];
    @property([Node]) private boardRootStates: Node[] = [];
    @property([Node]) private trayRootStates: Node[] = [];
    @property([Node]) private hintRootStates: Node[] = [];
    @property([Prefab]) private cellPrefabStates: Prefab[] = [];
    @property([Prefab]) private slotPrefabStates: Prefab[] = [];
    @property([Prefab]) private piecePrefabStates: Prefab[] = [];
    @property([Label]) private remainingLabelStates: Label[] = [];
    @property([Button]) private hintButtonStates: Button[] = [];
    @property([Button]) private returnPieceButtonStates: Button[] = [];
    @property([Button]) private pauseButtonStates: Button[] = [];
    @property([Button]) private helpButtonStates: Button[] = [];
    public selectState(id?: string): void {
        super.selectState(id);
        const index = id ? this.stateIds.indexOf(id) : 0;
        this.titleLabel = this.titleLabelStates[index];
        this.boardRoot = this.boardRootStates[index];
        this.trayRoot = this.trayRootStates[index];
        this.hintRoot = this.hintRootStates[index];
        this.cellPrefab = this.cellPrefabStates[index];
        this.slotPrefab = this.slotPrefabStates[index];
        this.piecePrefab = this.piecePrefabStates[index];
        this.remainingLabel = this.remainingLabelStates[index];
        this.hintButton = this.hintButtonStates[index];
        this.returnPieceButton = this.returnPieceButtonStates[index];
        this.pauseButton = this.pauseButtonStates[index];
        this.helpButton = this.helpButtonStates[index];
    }
    public validateBindings(): void {
        super.validateBindings();
        requireBinding('PuzzlePageView', 'titleLabel', this.titleLabel);
        requireBinding('PuzzlePageView', 'boardRoot', this.boardRoot);
        requireBinding('PuzzlePageView', 'trayRoot', this.trayRoot);
        requireBinding('PuzzlePageView', 'hintRoot', this.hintRoot);
        requireBinding('PuzzlePageView', 'cellPrefab', this.cellPrefab);
        requireBinding('PuzzlePageView', 'slotPrefab', this.slotPrefab);
        requireBinding('PuzzlePageView', 'piecePrefab', this.piecePrefab);
        requireBinding('PuzzlePageView', 'remainingLabel', this.remainingLabel);
        requireBinding('PuzzlePageView', 'hintButton', this.hintButton);
        requireBinding('PuzzlePageView', 'returnPieceButton', this.returnPieceButton);
        requireBinding('PuzzlePageView', 'pauseButton', this.pauseButton);
        requireBinding('PuzzlePageView', 'helpButton', this.helpButton);
        if (this.titleLabelStates.length !== this.stateIds.length || this.titleLabelStates.some(value => !value)) throw new Error('PuzzlePageView.titleLabel: incomplete state bindings');
        if (this.boardRootStates.length !== this.stateIds.length || this.boardRootStates.some(value => !value)) throw new Error('PuzzlePageView.boardRoot: incomplete state bindings');
        if (this.trayRootStates.length !== this.stateIds.length || this.trayRootStates.some(value => !value)) throw new Error('PuzzlePageView.trayRoot: incomplete state bindings');
        if (this.hintRootStates.length !== this.stateIds.length || this.hintRootStates.some(value => !value)) throw new Error('PuzzlePageView.hintRoot: incomplete state bindings');
        if (this.cellPrefabStates.length !== this.stateIds.length || this.cellPrefabStates.some(value => !value)) throw new Error('PuzzlePageView.cellPrefab: incomplete state bindings');
        if (this.slotPrefabStates.length !== this.stateIds.length || this.slotPrefabStates.some(value => !value)) throw new Error('PuzzlePageView.slotPrefab: incomplete state bindings');
        if (this.piecePrefabStates.length !== this.stateIds.length || this.piecePrefabStates.some(value => !value)) throw new Error('PuzzlePageView.piecePrefab: incomplete state bindings');
        if (this.remainingLabelStates.length !== this.stateIds.length || this.remainingLabelStates.some(value => !value)) throw new Error('PuzzlePageView.remainingLabel: incomplete state bindings');
        if (this.hintButtonStates.length !== this.stateIds.length || this.hintButtonStates.some(value => !value)) throw new Error('PuzzlePageView.hintButton: incomplete state bindings');
        if (this.returnPieceButtonStates.length !== this.stateIds.length || this.returnPieceButtonStates.some(value => !value)) throw new Error('PuzzlePageView.returnPieceButton: incomplete state bindings');
        if (this.pauseButtonStates.length !== this.stateIds.length || this.pauseButtonStates.some(value => !value)) throw new Error('PuzzlePageView.pauseButton: incomplete state bindings');
        if (this.helpButtonStates.length !== this.stateIds.length || this.helpButtonStates.some(value => !value)) throw new Error('PuzzlePageView.helpButton: incomplete state bindings');
    }
}
