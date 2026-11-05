import { Node, _decorator } from 'cc';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 图示帮助（目录 + 拖放拼图 / 满线消除 / 五级建设）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('HelpPopup')
@uiView({ bundle: 'common', path: 'prefabs/popups/HelpPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class HelpPopup extends PopupBase {
    @property(Node) catalog: Node = null!;
    @property([Node]) articles: Node[] = [];

    onOpenArticle(_event: unknown, _data: string): void {
        throw new Error('HelpPopup.onOpenArticle not implemented');
    }

    onTry(_event: unknown, _data: string): void {
        throw new Error('HelpPopup.onTry not implemented');
    }

    onCatalog(_event: unknown, _data: string): void {
        throw new Error('HelpPopup.onCatalog not implemented');
    }
}
