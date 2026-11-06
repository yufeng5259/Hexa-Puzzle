import { JsonAsset, Label, Node, Sprite, SpriteFrame, UITransform, Vec3, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { chapterStep, gardenProgress, GardenLayout, isJourneyComplete, nextPrice, shortage, upgrade } from '../../domain/Garden';
import { services } from '../../Services';
import { today } from '../../Today';
import { AlbumPage } from '../collection/AlbumPage';
import { HelpPopup } from '../common/HelpPopup';
import { Toast } from '../common/Toast';
import { TasksPage } from '../daily/TasksPage';
import { BuildingSlot } from './BuildingSlot';
import { ChapterCompletePopup } from './ChapterCompletePopup';
import { JourneyCompletePopup } from './JourneyCompletePopup';
import { NextThemePopup } from './NextThemePopup';
import { WorldMapPage } from './WorldMapPage';

const { ccclass, property } = _decorator;

/** Design canvas the layout coordinates refer to (top-left origin). */
const DESIGN_W = 853, DESIGN_H = 1844;
/** Theme the prefab's decorative scene bees were drawn for. */
const DECOR_THEME = 'sunny';

/** 家园：三园共用，5 栋建筑直接升级（F023–F028）。 */
@ccclass('GardenPage')
@uiView({ bundle: 'garden', path: 'prefabs/pages/GardenPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class GardenPage extends ViewBase {
    @property(Sprite) terrain: Sprite = null!;
    @property([BuildingSlot]) slots: BuildingSlot[] = [];
    @property(Sprite) waterRotor: Sprite = null!;
    @property([Sprite]) scaffolds: Sprite[] = [];
    @property(Node) sceneBees: Node = null!;
    @property(Node) upgradeFx: Node = null!;
    @property(LocalizedLabel) upgradeLevelLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) spentLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) themeNameLabel: LocalizedLabel = null!;
    @property(Sprite) totalFill: Sprite = null!;
    @property(LocalizedLabel) summaryLabel: LocalizedLabel = null!;
    @property(Label) totalLabel: Label = null!;
    @property(Node) chapterReward: Node = null!;

    private layout: GardenLayout | null = null;
    /** Asset path last requested per slot (index 5 = rotor, 6 = terrain); late results for other paths are dropped. */
    private readonly requested: string[] = [];
    private placedTheme = '';
    /** Building whose shortage is being explained (F025); cleared once affordable. */
    private shortBuilding: number | null = null;
    private readonly onSave = (): void => this.render();

    protected onOpen(): void {
        this.slots.forEach((slot, i) => { slot.onSelect = () => this.tryUpgrade(i); });
        this.upgradeFx.active = false;
        for (const s of this.scaffolds) s.node.active = false;
        void services.res.load('garden', 'config/layout', JsonAsset).then(asset => {
            if (!this.isOpened) return;
            this.layout = asset.json as GardenLayout;
            this.render();
        });
    }

    protected setInfo(): void {
        this.shortBuilding = null;
        this.render();
    }

    protected changeListener(enabled: boolean): void {
        services.save.subscribe(enabled, this.onSave);
    }

    protected onShow(): void {
        this.render();
    }

    onHelp(_event: unknown, _data: string): void {
        void services.ui.open(HelpPopup, { article: 'build' });
    }

    onAlbum(_event: unknown, _data: string): void {
        void services.ui.open(AlbumPage);
    }

    onTasks(_event: unknown, _data: string): void {
        void services.ui.open(TasksPage);
    }

    onWorldMap(_event: unknown, _data: string): void {
        void services.ui.open(WorldMapPage);
    }

    onChapterReward(_event: unknown, _data: string): void {
        this.openChapterStep();
    }

    private tryUpgrade(id: number): void {
        const save = services.save.data;
        const cfg = services.config.garden;
        const level = save.garden.buildings[id];
        if (nextPrice(cfg, save.garden.chapter, level) === null) return;
        const missing = shortage(save, cfg, id);
        if (missing > 0) {
            this.shortBuilding = id;
            Toast.show('hg.garden.short', { count: missing });
            this.render();
            return;
        }
        this.shortBuilding = null;
        services.save.transact(draft => { upgrade(draft, cfg, id, level, today()); });
        if (chapterStep(services.save.data, cfg) !== null) this.openChapterStep();
    }

    /** Completed garden → claim reward, then next theme, or the journey-complete page on the last garden. */
    private openChapterStep(): void {
        const step = chapterStep(services.save.data, services.config.garden);
        if (step === 'claim') void services.ui.open(ChapterCompletePopup);
        else if (step === 'next') void services.ui.open(NextThemePopup);
        else if (step === 'journey') void services.ui.open(JourneyCompletePopup);
    }

    private render(): void {
        const save = services.save.data;
        const cfg = services.config.garden;
        const chapter = save.garden.chapter;
        const theme = cfg.themes[chapter];
        this.themeNameLabel.setKey('hg.garden.theme.' + theme);
        this.sceneBees.active = theme === DECOR_THEME;
        this.loadFrame(6, `terrain/${theme}`, this.terrain);
        this.slots.forEach((slot, i) => {
            const level = save.garden.buildings[i];
            const name = services.i18n.t('hg.garden.building.' + cfg.buildings[i]);
            slot.show({ level, maxLevel: cfg.maxLevel, price: nextPrice(cfg, chapter, level) }, name);
            this.loadFrame(i, `buildings/${theme}/${cfg.buildings[i]}_${level}`, slot.body);
        });
        const rotorLevel = save.garden.buildings[cfg.rotorBuilding];
        this.waterRotor.node.active = rotorLevel > 0;
        if (rotorLevel > 0) this.loadFrame(5, `buildings/${theme}/${cfg.buildings[cfg.rotorBuilding]}_${rotorLevel}_rotor`, this.waterRotor);
        if (this.layout && this.placedTheme !== theme) this.place(theme);
        const total = cfg.maxLevel * cfg.buildingCount;
        const progress = gardenProgress(save);
        this.totalFill.fillRange = progress / total;
        this.totalLabel.string = `${progress}/${total}`;
        if (this.shortBuilding !== null && shortage(save, cfg, this.shortBuilding) === 0) this.shortBuilding = null;
        if (isJourneyComplete(save, cfg)) this.summaryLabel.setKey('hg.garden.summary.done');
        else if (this.shortBuilding !== null) this.summaryLabel.setKey('hg.garden.summary.shortage', { count: shortage(save, cfg, this.shortBuilding) });
        else this.summaryLabel.setKey('hg.garden.summary.building');
        this.chapterReward.active = chapterStep(save, cfg) !== null;
    }

    /** Position bodies and the rotor on this theme's stage canvases (layout.json). */
    private place(theme: string): void {
        const cfg = services.config.garden;
        const boxes = this.layout![theme];
        this.slots.forEach((slot, i) => this.fit(slot.body, boxes[i].center, boxes[i].width));
        this.fit(this.waterRotor, boxes[cfg.rotorBuilding].center, boxes[cfg.rotorBuilding].width);
        this.placedTheme = theme;
    }

    private fit(sprite: Sprite, center: [number, number], width: number): void {
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.node.getComponent(UITransform)!.setContentSize(width, width);
        const world = this.node.getComponent(UITransform)!.convertToWorldSpaceAR(new Vec3(center[0] - DESIGN_W / 2, DESIGN_H / 2 - center[1], 0));
        const local = sprite.node.parent!.getComponent(UITransform)!.convertToNodeSpaceAR(world);
        sprite.node.setPosition(local);
    }

    /** Load a garden-bundle sprite frame owned by this page; stale or post-close results are ignored. */
    private loadFrame(slot: number, path: string, target: Sprite): void {
        if (this.requested[slot] === path) return;
        this.requested[slot] = path;
        void services.res.load('garden', path + '/spriteFrame', SpriteFrame).then(frame => {
            if (!this.isOpened || this.requested[slot] !== path) return;
            target.spriteFrame = this.lease.acquire(frame);
        });
    }
}
