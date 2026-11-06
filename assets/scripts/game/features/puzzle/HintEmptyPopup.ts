import { Label, Node, _decorator } from 'cc';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { adAvailable, watchAd } from '../../Ads';
import { puzzleTarget } from '../../domain/AdReward';
import { claimFreeHint, freeHintClaimed } from '../../domain/Supply';
import { addHints } from '../../domain/Wallet';
import { services } from '../../Services';
import { today } from '../../Today';

const { ccclass, property } = _decorator;

/** 提示不足（T41-01，F016/F053/F057）：继续自己拼、视频 +1 提示、每日免费 +1。 */
@ccclass('HintEmptyPopup')
@uiView({ bundle: 'puzzle', path: 'prefabs/popups/HintEmptyPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class HintEmptyPopup extends PopupBase {
    @property(Label) stockLabel: Label = null!;
    @property(Node) adButton: Node = null!;
    @property(Node) freeButton: Node = null!;

    protected setInfo(): void {
        this.render();
    }

    onResume(_event: unknown, _data: string): void {
        this.close();
    }

    onHintAd(_event: unknown, _data: string): void {
        const attempt = services.save.data.attempt!;
        const levelId = services.catalog.getMainline(attempt.levelNumber).id;
        void watchAd({ placement: 'hint', target: puzzleTarget(attempt.attemptId, levelId), reward: { kind: 'hints', amount: 1 },
            benefitKey: 'hint:' + attempt.attemptId }).then(() => this.render());
    }

    onFreeHint(_event: unknown, _data: string): void {
        claimFreeHint(services.save, today());
        this.render();
    }

    private render(): void {
        this.stockLabel.string = String(services.save.data.wallet.hints);
        this.freeButton.active = !freeHintClaimed(services.save, today());
        this.adButton.active = adAvailable('hint') && !!services.save.data.attempt;
    }
}
