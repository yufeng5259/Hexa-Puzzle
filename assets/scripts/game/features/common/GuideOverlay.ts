import { Node, Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 事件式新手引导层（8 步数据驱动）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('GuideOverlay')
@uiView({ bundle: 'common', path: 'prefabs/popups/GuideOverlay', layer: UILayer.Guide, queue: UIQueue.None, transition: 'none' })
export class GuideOverlay extends PopupBase {
    @property([Sprite]) masks: Sprite[] = [];
    @property(Node) dragGhost: Node = null!;
    @property(Node) tip: Node = null!;
    @property(LocalizedLabel) tipLabel: LocalizedLabel = null!;
    @property(Node) arrow: Node = null!;
    @property(Node) finger: Node = null!;
    @property(LocalizedLabel) stepLabel: LocalizedLabel = null!;

    onSkip(_event: unknown, _data: string): void {
        throw new Error('GuideOverlay.onSkip not implemented');
    }
}
