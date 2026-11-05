import { JsonAsset, Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { EconomyConfig } from '../../config/EconomyConfig';
import { LevelCatalog } from '../../domain/puzzle/LevelCatalog';
import { LocalSaveStore } from '../../save/LocalSaveStore';
import { newSave } from '../../save/SaveData';
import { SaveService } from '../../save/SaveService';
import { services } from '../../Services';
import { acceptToday } from '../../Today';
import { MapPage } from '../map/MapPage';
import { ResumePopup } from '../puzzle/ResumePopup';

const { ccclass, property } = _decorator;

/** 启动加载页（主图）：加载配置、题库、存档与主线包，然后进入地图（F001）。 */
@ccclass('LoadingPage')
@uiView({ bundle: 'resources', path: 'prefabs/LoadingPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class LoadingPage extends ViewBase {
    @property(Sprite) fill: Sprite = null!;
    @property(LocalizedLabel) statusLabel: LocalizedLabel = null!;

    protected onOpen(): void {
        void this.run();
    }

    private async run(): Promise<void> {
        const steps: (() => Promise<void>)[] = [
            async () => {
                const config = await services.res.load('common', 'config/economy', JsonAsset);
                services.config = config.json as EconomyConfig;
            },
            async () => {
                const catalog = await services.res.load('puzzle', 'config/level-catalog', JsonAsset);
                services.catalog = new LevelCatalog(catalog.json);
            },
            async () => {
                const { initial, garden } = services.config;
                services.save = new SaveService(new LocalSaveStore(), () => newSave(initial.honey, initial.hints, garden.buildingCount));
                acceptToday();
            },
            async () => { await services.res.loadBundle('garden'); },
        ];
        for (let i = 0; i < steps.length; i++) {
            this.setProgress(i / steps.length);
            await steps[i]();
        }
        this.setProgress(1);
        await services.ui.open(MapPage, {});
        if (services.save.data.attempt) await services.ui.open(ResumePopup);
        this.close();
    }

    private setProgress(value: number): void {
        this.fill.fillRange = value;
        this.statusLabel.setParams({ percent: Math.round(value * 100) });
    }
}
