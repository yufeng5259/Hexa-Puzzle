import { Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { startAttempt } from '../../domain/Mainline';
import { services } from '../../Services';
import { PuzzlePage } from './PuzzlePage';

const { ccclass, property } = _decorator;

/** 未完成拼图续玩（T09-01，F013）：启动时存在未完成局则弹出；继续原局或重新开始。 */
@ccclass('ResumePopup')
@uiView({ bundle: 'puzzle', path: 'prefabs/popups/ResumePopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class ResumePopup extends PopupBase {
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(Node) snapshotRoot: Node = null!;
    @property(LocalizedLabel) progressLabel: LocalizedLabel = null!;

    protected setInfo(): void {
        const attempt = services.save.data.attempt!;
        const level = services.catalog.getMainline(attempt.levelNumber);
        this.titleLabel.setParams({ level: attempt.levelNumber });
        this.progressLabel.setParams({ value_1: Object.keys(attempt.placements).length, value_2: level.pieces.length });
    }

    onResume(_event: unknown, _data: string): void {
        const level = services.save.data.attempt!.levelNumber;
        this.close();
        void services.ui.open(PuzzlePage, { level });
    }

    onRestart(_event: unknown, _data: string): void {
        const level = services.save.data.attempt!.levelNumber;
        services.save.transact(draft => { startAttempt(draft, level); });
        this.close();
        void services.ui.open(PuzzlePage, { level });
    }

    /** Closing keeps the attempt; the map can resume it later from the level node. */
    onBack(): void {
        this.close();
    }
}
