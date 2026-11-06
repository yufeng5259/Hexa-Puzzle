import { SpriteFrame, _decorator } from 'cc';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { chapterProgress } from '../../domain/Garden';
import { services } from '../../Services';
import { AlbumPage } from '../collection/AlbumPage';
import { WorldMapNode, WorldMapNodeState } from './WorldMapNode';

const { ccclass, property } = _decorator;

/** 三园世界地图（T27-01，F027）：旧园看相册，当前园回家园，未来园锁定。只读，不改章节。 */
@ccclass('WorldMapPage')
@uiView({ bundle: 'garden', path: 'prefabs/pages/WorldMapPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class WorldMapPage extends ViewBase {
    @property([WorldMapNode]) nodes: WorldMapNode[] = [];
    /** [0] = gold (open), [1] = grey (locked). */
    @property([SpriteFrame]) shieldFrames: SpriteFrame[] = [];

    protected onOpen(): void {
        this.nodes.forEach((node, i) => { node.onSelect = () => this.select(i); });
    }

    protected setInfo(): void {
        const save = services.save.data;
        const cfg = services.config.garden;
        const total = cfg.maxLevel * cfg.buildingCount;
        this.nodes.forEach((node, i) => {
            node.show(i, this.stateOf(i), chapterProgress(save, cfg, i), total, this.shieldFrames[0], this.shieldFrames[1]);
        });
    }

    private stateOf(chapter: number): WorldMapNodeState {
        const current = services.save.data.garden.chapter;
        return chapter < current ? 'past' : chapter === current ? 'current' : 'locked';
    }

    private select(chapter: number): void {
        const state = this.stateOf(chapter);
        if (state === 'current') this.close();
        else if (state === 'past') void services.ui.open(AlbumPage);
    }
}
