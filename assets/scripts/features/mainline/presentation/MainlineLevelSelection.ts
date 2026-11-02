import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;

/** An item carries its question number explicitly; artwork names never identify a level. */
@ccclass('MainlineLevelSelection')
export class MainlineLevelSelection extends Component {
    public mainlineNumber = 0;

    public configure(number: number): void {
        if (!Number.isInteger(number) || number < 1 || number > 96) throw new Error('MainlineLevelSelection: invalid mainline number');
        this.mainlineNumber = number;
    }

    public onSelect(): void {
        if (!this.enabled || !this.node.activeInHierarchy) return;
        this.node.emit('view-action', this.mainlineNumber
            ? { actionId: 'select:mainline', mainlineNumber: this.mainlineNumber }
            : { actionId: 'nav:puzzle-preview' });
    }
}
