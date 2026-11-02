import { _decorator, CCString, Node } from 'cc';
import { BaseView } from '../../framework/ui/BaseView';
const { ccclass, property } = _decorator;

/** Only views with distinct authored layouts need state selection. */
@ccclass('SerializedView')
export class SerializedView extends BaseView {
    @property([Node]) public stateRoots: Node[] = [];
    @property([CCString]) public stateIds: string[] = [];
    public validateBindings(): void {
        if (this.stateRoots.length !== this.stateIds.length || this.stateRoots.some(root => !root))
            throw new Error(`${this.node.name}: invalid state bindings`);
    }
    public selectState(id?: string): void {
        const index = id ? this.stateIds.indexOf(id) : 0;
        if (index < 0) throw new Error(`${this.node.name}: unknown layout state ${id}`);
        this.stateRoots.forEach((root, position) => root.active = position === index);
    }
}
