import { Node, _decorator } from 'cc';
import { ScrollableItemGrid } from '../../../framework/ui/grid/ScrollableItemGrid';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 小蜜的信箱（本地信件）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('MailboxPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/MailboxPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class MailboxPage extends ViewBase {
    @property(Node) envelope: Node = null!;
    @property(ScrollableItemGrid) mails: ScrollableItemGrid = null!;
    @property(Node) readButton: Node = null!;

    onReadLatest(_event: unknown, _data: string): void {
        throw new Error('MailboxPage.onReadLatest not implemented');
    }
}
