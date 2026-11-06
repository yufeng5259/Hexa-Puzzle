import { Label, Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

export type AdStatus = 'loading' | 'unavailable' | 'confirming' | 'cooldown';
/** Order of the `states` nodes in the prefab. */
const STATES: AdStatus[] = ['loading', 'unavailable', 'confirming', 'cooldown'];

export interface AdStatusArgs {
    state: AdStatus;
    /** Reward text parameter for loading / confirming (e.g. "+1"). */
    reward?: string;
    /** Remaining cooldown for the cooldown state. */
    seconds?: number;
}

/** 激励广告状态（F052，T42–T45）：加载中 / 暂无可用 / 奖励确认中 / 冷却倒计时；关闭不影响免费出路。 */
@ccclass('AdStatusPopup')
@uiView({ bundle: 'common', path: 'prefabs/popups/AdStatusPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class AdStatusPopup extends PopupBase<AdStatusArgs> {
    @property([Node]) states: Node[] = [];
    @property(LocalizedLabel) loadingRewardLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) confirmRewardLabel: LocalizedLabel = null!;
    @property(Label) cooldownLabel: Label = null!;

    private remaining = 0;

    protected setInfo(): void {
        const a = this.args;
        this.states.forEach((node, i) => { node.active = STATES[i] === a.state; });
        if (a.reward !== undefined) {
            this.loadingRewardLabel.setParams({ count: a.reward });
            this.confirmRewardLabel.setParams({ count: a.reward });
        }
        this.unschedule(this.tick);
        if (a.state === 'cooldown') {
            this.remaining = a.seconds!;
            this.renderCountdown();
            this.schedule(this.tick, 1);
        }
    }

    protected onClose(): void {
        this.unschedule(this.tick);
    }

    onCancel(_event: unknown, _data: string): void {
        this.close();
    }

    /** The caller retries after the popup closes. */
    onRetry(_event: unknown, _data: string): void {
        this.close();
    }

    private tick(): void {
        this.remaining = Math.max(0, this.remaining - 1);
        this.renderCountdown();
        if (this.remaining === 0) this.close();
    }

    private renderCountdown(): void {
        const m = Math.floor(this.remaining / 60), s = this.remaining % 60;
        this.cooldownLabel.string = `${m}:${s < 10 ? '0' : ''}${s}`;
    }
}
