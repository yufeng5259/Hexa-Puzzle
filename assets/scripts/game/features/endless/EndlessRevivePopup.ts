import { Label, Node, _decorator } from 'cc';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { adAvailable, watchAd } from '../../Ads';
import { applyRevive, harvest, projectedHarvest, revivePlan } from '../../domain/Endless';
import { services } from '../../Services';
import { today } from '../../Today';
import { EndlessResultPopup } from './EndlessResultPopup';

const { ccclass, property } = _decorator;

export interface EndlessReviveArgs {
    /** Called after a successful clearing so the page redraws the board. */
    onRevived: () => void;
}

/** 无尽无位置（T12-01，F033/F055）：免费收获结束，或看视频按可验证方案清理后续局（每局 1 次）。 */
@ccclass('EndlessRevivePopup')
@uiView({ bundle: 'endless', path: 'prefabs/popups/EndlessRevivePopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class EndlessRevivePopup extends PopupBase<EndlessReviveArgs> {
    @property(Label) honeyLabel: Label = null!;
    @property(Node) clearAdButton: Node = null!;

    protected setInfo(): void {
        const run = services.save.data.endless.run!;
        const cfg = services.config.endless;
        this.honeyLabel.string = String(projectedHarvest(services.save.data, cfg, run.score, today()));
        this.clearAdButton.active = revivePlan(run, cfg) !== null && adAvailable('endless');
    }

    onHarvest(_event: unknown, _data: string): void {
        const receipt = harvest(services.save, services.config.endless, today());
        this.close();
        void services.ui.open(EndlessResultPopup, receipt);
    }

    /** The plan is computed against the run at request time; applyRevive rejects it if the run changed. */
    onClearAd(_event: unknown, _data: string): void {
        const cfg = services.config.endless;
        const plan = revivePlan(services.save.data.endless.run!, cfg)!;
        const revived = this.args.onRevived;
        const runId = services.save.data.endless.run!.runId;
        void watchAd({ placement: 'endless', target: { kind: 'endless', runId }, reward: { kind: 'endless-revive', clearCells: plan.clearCells },
            benefitKey: 'revive:' + runId }).then(ok => {
            if (!ok) return;
            this.close();
            revived();
        });
    }
}
