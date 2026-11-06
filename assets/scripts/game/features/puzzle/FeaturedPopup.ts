import { _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { featuredLevels, replaysToday } from '../../domain/Mainline';
import { services } from '../../Services';
import { today } from '../../Today';
import { FeaturedEntry } from './FeaturedEntry';
import { LevelPreviewPopup } from './LevelPreviewPopup';

const { ccclass, property } = _decorator;

/** 每日精选复玩（T10-01，F021）：按日期稳定选出已通关普通关，与普通复玩共用每日花蜜次数。 */
@ccclass('FeaturedPopup')
@uiView({ bundle: 'puzzle', path: 'prefabs/popups/FeaturedPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class FeaturedPopup extends PopupBase {
    @property(LocalizedLabel) quotaLabel: LocalizedLabel = null!;
    @property([FeaturedEntry]) entries: FeaturedEntry[] = [];

    protected onOpen(): void {
        this.entries.forEach(entry => { entry.onSelect = level => this.play(level); });
    }

    protected setInfo(): void {
        const save = services.save.data;
        const { mainline } = services.config;
        const day = today();
        const used = replaysToday(save, day);
        this.quotaLabel.setParams({ value_1: used, value_2: mainline.replayDailyLimit });
        const levels = featuredLevels(save, n => services.catalog.getMainline(n).mode === 'classic', day, this.entries.length);
        const honey = used < mainline.replayDailyLimit ? mainline.replay : 0;
        this.entries.forEach((entry, i) => {
            entry.node.active = i < levels.length;
            if (i < levels.length) entry.show(levels[i], honey);
        });
    }

    /** "继续主线": back to the map. */
    onContinue(_event: unknown, _data: string): void {
        this.close();
    }

    private play(level: number): void {
        this.close();
        void services.ui.open(LevelPreviewPopup, { level, featured: true });
    }
}
