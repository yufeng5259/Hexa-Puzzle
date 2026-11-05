import { Label, Node, Sprite, SpriteFrame, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { adAvailable, watchAd } from '../../Ads';
import { bonusAmount } from '../../domain/Ads';
import { isJourneyComplete } from '../../domain/Garden';
import { WinReceipt } from '../../domain/Mainline';
import { addHoney } from '../../domain/Wallet';
import { services } from '../../Services';
import { GardenPage } from '../garden/GardenPage';
import { closePuzzlePage } from './PuzzleNav';
import { LevelPreviewPopup } from './LevelPreviewPopup';

const { ccclass, property } = _decorator;

/** 拼图胜利结算（普通 T06-01 / 限步星级 T07-01，F014/F015/F056）。奖励已在打开前入账。 */
@ccclass('PuzzleWinPopup')
@uiView({ bundle: 'puzzle', path: 'prefabs/popups/PuzzleWinPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class PuzzleWinPopup extends PopupBase<WinReceipt> {
    @property(Node) starLight: Node = null!;
    @property(Node) starsRow: Node = null!;
    @property([Sprite]) stars: Sprite[] = [];
    @property(Node) pilotBee: Node = null!;
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) levelLabel: LocalizedLabel = null!;
    @property(Label) rewardLabel: Label = null!;
    @property(LocalizedLabel) bestLabel: LocalizedLabel = null!;
    @property(Node) bonusAdButton: Node = null!;
    @property(LocalizedLabel) bonusAdLabel: LocalizedLabel = null!;
    @property(SpriteFrame) emptyStar: SpriteFrame = null!;
    @property challengeTitleKey = "block.5a183ef06031.text.5ce2d4cc8539";

    private goldStar: SpriteFrame | null = null;
    private classicTitleKey = '';

    protected onOpen(): void {
        this.goldStar = this.stars[0].spriteFrame;
        this.classicTitleKey = this.titleLabel.key;
    }

    protected setInfo(): void {
        const r = this.args;
        const challenge = r.mode === 'challenge';
        this.titleLabel.setKey(challenge ? this.challengeTitleKey : this.classicTitleKey);
        this.levelLabel.setParams({ level: r.levelNumber });
        this.rewardLabel.string = '+' + r.honey;
        this.starsRow.active = this.starLight.active = this.bestLabel.node.active = challenge;
        this.pilotBee.active = !challenge;
        this.stars.forEach((star, i) => { star.spriteFrame = i < r.stars ? this.goldStar : this.emptyStar; });
        if (challenge) this.bestLabel.setParams({ count: r.bestStars });
        this.renderBonus();
    }

    onNext(_event: unknown, _data: string): void {
        const next = this.args.levelNumber + 1;
        this.close();
        closePuzzlePage();
        if (next <= services.config.mainline.levelCount) void services.ui.open(LevelPreviewPopup, { level: next });
    }

    onBonusAd(_event: unknown, _data: string): void {
        const key = 'bonus:' + this.args.attemptId;
        const amount = bonusAmount(services.config.ads, this.args.honey);
        void watchAd('bonus', draft => {
            if (draft.claims[key] !== undefined) throw new Error('Bonus already claimed');
            addHoney(draft, amount);
            draft.claims[key] = amount;
        }).then(() => this.renderBonus());
    }

    onHome(_event: unknown, _data: string): void {
        this.close();
        closePuzzlePage();
        void services.ui.open(GardenPage);
    }

    onBack(): void {
        this.close();
        closePuzzlePage();
    }

    /** Bonus is offered only with a base reward, quota left, a honey goal still open, and after the protected first levels (F028/F052/F056). */
    private renderBonus(): void {
        const r = this.args;
        const amount = bonusAmount(services.config.ads, r.honey);
        const claimed = services.save.data.claims['bonus:' + r.attemptId] !== undefined;
        this.bonusAdButton.active = amount > 0 && !claimed && r.levelNumber > services.config.ads.protectedLevels
            && adAvailable('bonus') && !isJourneyComplete(services.save.data, services.config.garden);
        this.bonusAdLabel.setParams({ count: '+' + amount });
    }
}
