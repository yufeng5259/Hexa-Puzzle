import { Label, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { createRun } from '../../domain/Endless';
import { services } from '../../Services';
import { AchievementPage } from '../daily/AchievementPage';
import { SupplyPopup } from '../daily/SupplyPopup';
import { EndlessPage } from './EndlessPage';

const { ccclass, property } = _decorator;

/** 无尽入口（T11-01，F029）：有未结算的局时“继续这一局”，否则开始新局。 */
@ccclass('EndlessIntroPopup')
@uiView({ bundle: 'endless', path: 'prefabs/popups/EndlessIntroPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class EndlessIntroPopup extends PopupBase {
    @property(Label) scoreLabel: Label = null!;
    @property(Label) bestLabel: Label = null!;
    @property(LocalizedLabel) startLabel: LocalizedLabel = null!;

    protected setInfo(): void {
        const { run, best } = services.save.data.endless;
        this.scoreLabel.string = String(run ? run.score : 0);
        this.bestLabel.string = String(best);
        this.startLabel.setKey(run ? 'hg.endless.continue' : 'hg.endless.start');
    }

    onRecords(_event: unknown, _data: string): void {
        void services.ui.open(AchievementPage);
    }

    onSupply(_event: unknown, _data: string): void {
        void services.ui.open(SupplyPopup);
    }

    /** Resume the saved run; a new run is created and saved before navigating (F029). */
    onStart(_event: unknown, _data: string): void {
        if (!services.save.data.endless.run) {
            const seed = Math.floor(Math.random() * 233280);
            services.save.transact(draft => { createRun(draft, services.config.endless, seed); });
        }
        this.close();
        void services.ui.open(EndlessPage);
    }
}
