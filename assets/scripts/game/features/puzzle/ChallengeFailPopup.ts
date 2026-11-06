import { Label, Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { adAvailable, watchAd } from '../../Ads';
import { puzzleTarget } from '../../domain/AdReward';
import { startAttempt } from '../../domain/Mainline';
import { services } from '../../Services';
import { PuzzlePage } from './PuzzlePage';
import { closePuzzlePage } from './PuzzleNav';

const { ccclass, property } = _decorator;

export interface ChallengeFailArgs { level: number; }

/** 限步失败（T08-01，F011/F054）：免费重试、视频 +3 步续关（每局 1 次）、返回地图。 */
@ccclass('ChallengeFailPopup')
@uiView({ bundle: 'puzzle', path: 'prefabs/popups/ChallengeFailPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class ChallengeFailPopup extends PopupBase<ChallengeFailArgs> {
    @property(Label) remainLabel: Label = null!;
    @property(Node) adButton: Node = null!;
    @property(LocalizedLabel) adLabel: LocalizedLabel = null!;

    protected setInfo(): void {
        const attempt = services.save.data.attempt!;
        const level = services.catalog.getMainline(this.args.level);
        this.remainLabel.string = String(level.pieces.length - Object.keys(attempt.placements).length);
        this.adButton.active = adAvailable('challenge');
        services.audio.play('fail');
    }

    /** New attempt, moves back to 0, no cost. */
    onRetry(_event: unknown, _data: string): void {
        services.save.transact(draft => { startAttempt(draft, this.args.level); });
        this.reopen();
    }

    onContinueAd(_event: unknown, _data: string): void {
        const attempt = services.save.data.attempt!;
        const levelId = services.catalog.getMainline(attempt.levelNumber).id;
        void watchAd({ placement: 'challenge', target: puzzleTarget(attempt.attemptId, levelId),
            reward: { kind: 'continue', bonusMoves: services.config.ads.continueMoves }, benefitKey: 'continue:' + attempt.attemptId })
            .then(ok => { if (ok) this.reopen(); });
    }

    onMap(_event: unknown, _data: string): void {
        this.onBack();
    }

    /** Leaving abandons the failed attempt. */
    onBack(): void {
        services.save.transact(draft => { draft.attempt = null; });
        this.close();
        closePuzzlePage();
    }

    private reopen(): void {
        this.close();
        void services.ui.open(PuzzlePage, { level: this.args.level });
    }
}
