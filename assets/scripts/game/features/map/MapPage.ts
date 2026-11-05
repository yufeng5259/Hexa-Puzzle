import { Node, Sprite, _decorator } from 'cc';
import { LevelNode } from './LevelNode';
import { MapEntry } from './MapEntry';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 主线地图（唯一主界面，12 页 × 8 关）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('MapPage')
@uiView({ bundle: 'puzzle', path: 'prefabs/pages/MapPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class MapPage extends ViewBase {
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

    onPageNext(_event: unknown, _data: string): void {
        throw new Error('MapPage.onPageNext not implemented');
    }

    onPagePrev(_event: unknown, _data: string): void {
        throw new Error('MapPage.onPagePrev not implemented');
    }

    onGarden(_event: unknown, _data: string): void {
        throw new Error('MapPage.onGarden not implemented');
    }

    onEndless(_event: unknown, _data: string): void {
        throw new Error('MapPage.onEndless not implemented');
    }
}
