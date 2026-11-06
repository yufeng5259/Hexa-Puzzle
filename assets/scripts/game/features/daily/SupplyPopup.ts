import { Label, Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { adAvailable, watchAd } from '../../Ads';
import { dailyRules } from '../../domain/Daily';
import { isJourneyComplete } from '../../domain/Garden';
import { claimFreeHint, freeHintClaimed } from '../../domain/Supply';
import { addHoney } from '../../domain/Wallet';
import { services } from '../../Services';
import { today } from '../../Today';

const { ccclass, property } = _decorator;

/** 每日补给（T47-01，F057）：每日免费 1 提示；仍有建设目标时可看视频领花蜜（每日上限见配置）。 */
@ccclass('SupplyPopup')
@uiView({ bundle: 'meta', path: 'prefabs/popups/SupplyPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class SupplyPopup extends PopupBase {
    @property(Label) videoAmountLabel: Label = null!;
    @property(LocalizedLabel) videoConditionLabel: LocalizedLabel = null!;
    @property(Node) freeButton: Node = null!;
    @property(Node) freeClaimed: Node = null!;
    @property(Node) videoButton: Node = null!;
    @property(LocalizedLabel) videoButtonLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) adLimitLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) freeLabel: LocalizedLabel = null!;

    protected setInfo(): void {
        const ads = services.config.ads;
        this.videoAmountLabel.string = '+' + ads.supplyHoney;
        this.videoConditionLabel.setParams({ count: ads.daily.supply });
        this.videoButtonLabel.setParams({ count: '+' + ads.supplyHoney });
        this.adLimitLabel.setParams({ value_1: ads.dailyMax, value_2: ads.intervalSeconds });
        this.freeLabel.setParams({ count: dailyRules().supply.freeHints });
        this.render();
    }

    onFreeHint(_event: unknown, _data: string): void {
        claimFreeHint(services.save, today());
        this.render();
    }

    onVideo(_event: unknown, _data: string): void {
        void watchAd('supply', draft => addHoney(draft, services.config.ads.supplyHoney)).then(() => this.render());
    }

    private render(): void {
        const claimed = freeHintClaimed(services.save, today());
        this.freeButton.active = !claimed;
        this.freeClaimed.active = claimed;
        this.videoButton.active = adAvailable('supply') && !isJourneyComplete(services.save.data, services.config.garden);
    }
}
