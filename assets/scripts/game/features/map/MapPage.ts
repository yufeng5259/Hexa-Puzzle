import { Node, Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { gardenProgress } from '../../domain/Garden';
import { isCleared, isEndlessUnlocked, reachableLevel } from '../../domain/Mainline';
import { services } from '../../Services';
import { AlbumPage } from '../collection/AlbumPage';
import { CompanionListPage } from '../collection/CompanionListPage';
import { Toast } from '../common/Toast';
import { AchievementPage } from '../daily/AchievementPage';
import { EventPage } from '../daily/EventPage';
import { MailboxPage } from '../daily/MailboxPage';
import { SigninPage } from '../daily/SigninPage';
import { SupplyPopup } from '../daily/SupplyPopup';
import { TasksPage } from '../daily/TasksPage';
import { EndlessIntroPopup } from '../endless/EndlessIntroPopup';
import { GardenPage } from '../garden/GardenPage';
import { LevelPreviewPopup } from '../puzzle/LevelPreviewPopup';
import { LevelNode } from './LevelNode';
import { MapEntry } from './MapEntry';

const { ccclass, property } = _decorator;

export interface MapPageArgs {
    /** Page index to show; defaults to the page of the playable level. */
    page?: number;
}

/** Node index whose position the glow and avatar marker were authored around. */
const DESIGN_CURRENT = 3;

/** 主线地图（唯一主界面，12 页 × 8 关，F007/F008）。 */
@ccclass('MapPage')
@uiView({ bundle: 'puzzle', path: 'prefabs/pages/MapPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class MapPage extends ViewBase<MapPageArgs> {
    @property(Node) currentGlow: Node = null!;
    @property([LevelNode]) levels: LevelNode[] = [];
    @property(Node) currentMarker: Node = null!;
    @property([MapEntry]) entries: MapEntry[] = [];
    @property(Node) pageNext: Node = null!;
    @property(Node) pagePrev: Node = null!;
    @property(LocalizedLabel) pageRangeLabel: LocalizedLabel = null!;
    @property(Sprite) gardenFill: Sprite = null!;
    @property(LocalizedLabel) gardenProgressLabel: LocalizedLabel = null!;
    @property(Node) endlessLocked: Node = null!;
    @property(LocalizedLabel) endlessConditionLabel: LocalizedLabel = null!;
    @property(Node) endlessBest: Node = null!;
    @property(LocalizedLabel) endlessBestLabel: LocalizedLabel = null!;

    private page = 0;
    private glowOffset = { x: 0, y: 0 };
    private markerOffset = { x: 0, y: 0 };
    private readonly onSave = (): void => this.render();

    protected onOpen(): void {
        const anchor = this.levels[DESIGN_CURRENT].node.position;
        this.glowOffset = { x: this.currentGlow.position.x - anchor.x, y: this.currentGlow.position.y - anchor.y };
        this.markerOffset = { x: this.currentMarker.position.x - anchor.x, y: this.currentMarker.position.y - anchor.y };
        this.levels.forEach(node => { node.onSelect = level => this.selectLevel(level); });
        this.entries.forEach(entry => { entry.onOpen = id => this.openEntry(id); });
    }

    protected setInfo(): void {
        const perPage = services.config.mainline.levelsPerPage;
        this.page = this.args.page ?? Math.floor((reachableLevel(services.save.data, services.config.mainline) - 1) / perPage);
        this.render();
    }

    protected changeListener(enabled: boolean): void {
        services.save.subscribe(enabled, this.onSave);
    }

    protected onShow(): void {
        this.render();
    }

    onPageNext(_event: unknown, _data: string): void {
        this.page++;
        this.render();
    }

    onPagePrev(_event: unknown, _data: string): void {
        this.page--;
        this.render();
    }

    onGarden(_event: unknown, _data: string): void {
        void services.ui.open(GardenPage);
    }

    onEndless(_event: unknown, _data: string): void {
        if (isEndlessUnlocked(services.save.data, services.config.mainline)) void services.ui.open(EndlessIntroPopup);
        else Toast.show('hg.map.endless_locked', { level: services.config.mainline.endlessUnlockLevel });
    }

    /** The main map is the root page: back does nothing on web (Android exit dialog comes with the native platform). */
    onBack(): void {}

    private selectLevel(level: number): void {
        if (level > reachableLevel(services.save.data, services.config.mainline)) {
            Toast.show('hg.map.level_locked');
            return;
        }
        void services.ui.open(LevelPreviewPopup, { level });
    }

    private openEntry(id: string): void {
        const pages: Record<string, () => Promise<unknown>> = {
            signin: () => services.ui.open(SigninPage),
            achievement: () => services.ui.open(AchievementPage),
            tasks: () => services.ui.open(TasksPage),
            companions: () => services.ui.open(CompanionListPage),
            supply: () => services.ui.open(SupplyPopup),
            event: () => services.ui.open(EventPage),
            album: () => services.ui.open(AlbumPage),
            mail: () => services.ui.open(MailboxPage),
        };
        void pages[id]();
    }

    private render(): void {
        const save = services.save.data;
        const { mainline, garden } = services.config;
        const perPage = mainline.levelsPerPage;
        const reachable = reachableLevel(save, mainline);
        const first = this.page * perPage + 1;
        this.levels.forEach((node, i) => {
            const n = first + i;
            const level = services.catalog.getMainline(n);
            const challenge = level.mode === 'challenge';
            const stars = challenge ? (save.mainline.bestStars[level.id] ?? 0) : isCleared(save, n) ? 3 : 0;
            node.show({ number: n, unlocked: n <= reachable, challenge, stars });
        });
        const current = this.levels[reachable - first];
        this.currentGlow.active = this.currentMarker.active = !!current;
        if (current) {
            const p = current.node.position;
            this.currentGlow.setPosition(p.x + this.glowOffset.x, p.y + this.glowOffset.y);
            this.currentMarker.setPosition(p.x + this.markerOffset.x, p.y + this.markerOffset.y);
        }
        this.pagePrev.active = this.page > 0;
        this.pageNext.active = this.page < Math.ceil(mainline.levelCount / perPage) - 1;
        this.pageRangeLabel.setParams({ first, last: first + perPage - 1 });
        const total = garden.maxLevel * garden.buildingCount;
        const progress = gardenProgress(save);
        this.gardenFill.fillRange = progress / total;
        this.gardenProgressLabel.setParams({ value_1: progress, value_2: total });
        const unlocked = isEndlessUnlocked(save, mainline);
        this.endlessLocked.active = !unlocked;
        this.endlessBest.active = unlocked;
        if (unlocked) this.endlessBestLabel.setParams({ score: save.endless.best });
        else this.endlessConditionLabel.setParams({ level: mainline.endlessUnlockLevel });
    }
}
