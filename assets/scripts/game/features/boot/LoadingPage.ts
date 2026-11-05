import { Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 启动加载页（主图）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('LoadingPage')
@uiView({ bundle: 'resources', path: 'prefabs/LoadingPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class LoadingPage extends ViewBase {
    @property(Sprite) fill: Sprite = null!;
    @property(LocalizedLabel) statusLabel: LocalizedLabel = null!;

}
