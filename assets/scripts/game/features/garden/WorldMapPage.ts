import { SpriteFrame, _decorator } from 'cc';
import { WorldMapNode } from './WorldMapNode';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 三园世界地图. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('WorldMapPage')
@uiView({ bundle: 'garden', path: 'prefabs/pages/WorldMapPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class WorldMapPage extends ViewBase {
    @property([WorldMapNode]) nodes: WorldMapNode[] = [];
    @property([SpriteFrame]) shieldFrames: SpriteFrame[] = [];

}
