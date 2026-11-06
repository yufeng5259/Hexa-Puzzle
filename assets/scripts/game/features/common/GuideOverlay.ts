import { Node, Sprite, _decorator } from 'cc';
import { TextParams } from '../../../framework/i18n/I18n';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { completeGuide, GuideStep, skipGuide } from '../../Guide';

const { ccclass, property } = _decorator;

export interface GuideArgs {
    id: string;
    /** Step index, also the index of its baked spotlight mask. */
    index: number;
    total: number;
    step: GuideStep;
    /** > 0: the step completes itself after this many seconds (closing message). */
    autoCompleteSeconds: number;
    /** Tip box of the step the prefab was authored from (step 1). */
    authoredTip: number[];
    tipParams: TextParams;
}

const DESIGN_W = 853, DESIGN_H = 1844;
/** Index of the drag step, the only one that shows the drag ghost. */
const DRAG_STEP = 3;

/** 事件式新手引导层（T51-01..08，F048/F049）：聚光遮罩、提示框、手指、步骤与跳过；不拦截点击，由真实操作推进。 */
@ccclass('GuideOverlay')
@uiView({ bundle: 'common', path: 'prefabs/popups/GuideOverlay', layer: UILayer.Guide, queue: UIQueue.None, transition: 'none' })
export class GuideOverlay extends PopupBase<GuideArgs> {
    @property([Sprite]) masks: Sprite[] = [];
    @property(Node) dragGhost: Node = null!;
    @property(Node) tip: Node = null!;
    @property(LocalizedLabel) tipLabel: LocalizedLabel = null!;
    @property(Node) arrow: Node = null!;
    @property(Node) finger: Node = null!;
    @property(LocalizedLabel) stepLabel: LocalizedLabel = null!;

    /** Tip group position as authored (step 1); other steps move it by the difference of tip boxes. */
    private tipOrigin = { x: 0, y: 0 };

    protected onOpen(): void {
        this.tipOrigin = { x: this.tip.position.x, y: this.tip.position.y };
    }

    protected setInfo(): void {
        const { index, total, step } = this.args;
        this.masks.forEach((mask, i) => { mask.node.active = i === index; });
        this.dragGhost.active = index === DRAG_STEP;
        this.tipLabel.setKey(step.tipKey, this.args.tipParams);
        this.stepLabel.setKey(step.stepKey, { value_1: index + 1, value_2: total });
        const from = center(this.args.authoredTip), to = center(step.tip);
        this.tip.setPosition(this.tipOrigin.x + to.x - from.x, this.tipOrigin.y + to.y - from.y);
        const finger = center(step.finger);
        this.finger.setPosition(finger.x, finger.y);
        this.arrow.active = !!step.arrow;
        if (step.arrow) {
            const arrow = center(step.arrow);
            this.arrow.setPosition(arrow.x, arrow.y);
        }
        this.unscheduleAllCallbacks();
        if (this.args.autoCompleteSeconds > 0) this.scheduleOnce(() => completeGuide(this.args.id), this.args.autoCompleteSeconds);
    }

    onSkip(_event: unknown, _data: string): void {
        skipGuide(this.args.id);
    }

    /** The back key belongs to the page underneath. */
    onBack(): void {}
}

/** Center of a design rect [x, y, w, h] (top-left origin) in the full-screen content's local space. */
function center(rect: number[]): { x: number; y: number } {
    return { x: rect[0] + rect[2] / 2 - DESIGN_W / 2, y: DESIGN_H / 2 - (rect[1] + rect[3] / 2) };
}
