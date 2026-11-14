import { _decorator, Component, Enum } from 'cc';
const { ccclass, property } = _decorator;

export enum EdgeSide { Left = 0, Right = 1 }

/**
 * Marks a page element that keeps its design distance to the left or right edge of the safe
 * frame when the frame is wider than the 853 design width (LayoutView.fitScreen reads it).
 * Only horizontal; vertical placement stays with the HUD / bottom bands. No effect on tablets.
 */
@ccclass('EdgePin')
export class EdgePin extends Component {
    @property({ type: Enum(EdgeSide) }) public side: EdgeSide = EdgeSide.Left;
}
