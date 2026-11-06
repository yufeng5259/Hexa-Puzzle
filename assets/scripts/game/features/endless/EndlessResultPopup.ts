import { _decorator, Label, Node, Sprite } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { adAvailable, watchAd } from '../../Ads';
import { bonusAmount } from '../../domain/Ads';
import { createRun, HarvestReceipt } from '../../domain/Endless';
import { isJourneyComplete } from '../../domain/Garden';
import { addHoney } from '../../domain/Wallet';
import { services } from '../../Services';
import { flyTo, popIn, stopFx } from '../../fx/Fx';
import { TopHud } from '../common/TopHud';
import { closeEndlessPage } from './EndlessNav';
import { EndlessPage } from './EndlessPage';

const { ccclass, property } = _decorator;

/** 无尽成绩结算（T14-01，F034/F056）：本局分、本机最高、实得花蜜（已入账）、再来一局、视频加领。 */
@ccclass('EndlessResultPopup')
@uiView({ bundle: 'endless', path: 'prefabs/popups/EndlessResultPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class EndlessResultPopup extends PopupBase<HarvestReceipt> {
    @property(Node) trophy: Node = null!;
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(Label) scoreLabel: Label = null!;
    @property(LocalizedLabel) bestLabel: LocalizedLabel = null!;
    @property(Label) rewardLabel: Label = null!;
    @property(Node) bonusAdButton: Node = null!;
    @property(LocalizedLabel) bonusAdLabel: LocalizedLabel = null!;
    @property(Sprite) rewardIcon: Sprite = null!;

    private newBestKey = '';

    protected onOpen(): void {
        this.newBestKey = this.titleLabel.key;
    }

    protected setInfo(): void {
        const r = this.args;
        this.trophy.active = r.newBest;
        this.titleLabel.setKey(r.newBest ? this.newBestKey : 'hg.endless.result_title');
        this.scoreLabel.string = String(r.score);
        this.bestLabel.setParams({ count: r.best });
        this.rewardLabel.string = '+' + r.honey;
        this.renderBonus();
        services.audio.play('win');
        if (r.newBest) popIn(this.trophy, 0.3);
    }

    /** FX-03: harvested honey flies to the HUD. */
    onShowFinish(): void {
        const hud = TopHud.current();
        if (this.args.honey > 0 && hud) flyTo(this.rewardIcon, hud.honeyLabel.node);
    }

    protected onClose(): void {
        stopFx(this.trophy);
    }

    onAgain(_event: unknown, _data: string): void {
        const seed = Math.floor(Math.random() * 233280);
        services.save.transact(draft => { createRun(draft, services.config.endless, seed); });
        this.close();
        void services.ui.open(EndlessPage);
    }

    onBonusAd(_event: unknown, _data: string): void {
        const amount = bonusAmount(services.config.ads, this.args.honey);
        void watchAd({ placement: 'bonus', target: { kind: 'settlement', settlementId: this.args.runId }, reward: { kind: 'honey', amount },
            benefitKey: 'bonus:' + this.args.runId }).then(() => this.renderBonus());
    }

    onBack(): void {
        this.close();
        closeEndlessPage();
    }

    /** Same rule as the puzzle settlement bonus (F056); hidden once all gardens are built (F028). */
    private renderBonus(): void {
        const amount = bonusAmount(services.config.ads, this.args.honey);
        const claimed = services.save.data.claims['bonus:' + this.args.runId] !== undefined;
        this.bonusAdButton.active = amount > 0 && !claimed && adAvailable('bonus') && !isJourneyComplete(services.save.data, services.config.garden);
        this.bonusAdLabel.setParams({ count: '+' + amount });
    }
}
