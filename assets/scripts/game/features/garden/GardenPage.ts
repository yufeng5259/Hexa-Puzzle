import { Label, Node, Sprite, _decorator } from 'cc';
import { BuildingSlot } from './BuildingSlot';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 家园：三园共用，5 栋建筑直接升级. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
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
    @property(Node) totalFill: Node = null!;
    @property(LocalizedLabel) summaryLabel: LocalizedLabel = null!;
    @property(Label) totalLabel: Label = null!;
    @property(Node) chapterReward: Node = null!;

    onHelp(_event: unknown, _data: string): void {
        throw new Error('GardenPage.onHelp not implemented');
    }

    onAlbum(_event: unknown, _data: string): void {
        throw new Error('GardenPage.onAlbum not implemented');
    }

    onTasks(_event: unknown, _data: string): void {
        throw new Error('GardenPage.onTasks not implemented');
    }

    onWorldMap(_event: unknown, _data: string): void {
        throw new Error('GardenPage.onWorldMap not implemented');
    }

    onChapterReward(_event: unknown, _data: string): void {
        throw new Error('GardenPage.onChapterReward not implemented');
    }
}
