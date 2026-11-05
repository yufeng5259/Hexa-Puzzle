import { Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 飘字提示. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('Toast')
@uiView({ bundle: 'common', path: 'prefabs/popups/Toast', layer: UILayer.Toast, queue: UIQueue.None, transition: 'none' })
export class Toast extends PopupBase {
    @property(Node) bar: Node = null!;
    @property(LocalizedLabel) textLabel: LocalizedLabel = null!;

}
