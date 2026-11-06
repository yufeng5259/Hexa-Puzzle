import { Node, _decorator } from 'cc';
import { ScrollableItemGrid } from '../../../framework/ui/grid/ScrollableItemGrid';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { dailyRules, MailRule, markMailRead } from '../../domain/Daily';
import { services } from '../../Services';
import { MailDetailPopup } from './MailDetailPopup';
import { MailRowData } from './MailRow';

const { ccclass, property } = _decorator;

/** 本地信箱（T48-01，F050）：随包信件列表，只记录已读，没有附件。 */
@ccclass('MailboxPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/MailboxPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class MailboxPage extends ViewBase {
    @property(Node) envelope: Node = null!;
    @property(ScrollableItemGrid) mails: ScrollableItemGrid = null!;
    @property(Node) readButton: Node = null!;

    private readonly onSave = (): void => this.render();

    protected setInfo(): void {
        this.render();
    }

    protected changeListener(enabled: boolean): void {
        services.save.subscribe(enabled, this.onSave);
    }

    /** Open the newest unread letter, or the newest letter when all are read. */
    onReadLatest(_event: unknown, _data: string): void {
        const all = dailyRules().mails;
        const read = services.save.data.daily.mailRead;
        this.open(all.find(m => read.indexOf(m.id) < 0) ?? all[0]);
    }

    private open(mail: MailRule): void {
        services.save.transact(draft => markMailRead(draft, mail.id));
        void services.ui.open(MailDetailPopup, mail);
    }

    private render(): void {
        const read = services.save.data.daily.mailRead;
        const items: MailRowData[] = dailyRules().mails.map(mail => ({ mail, read: read.indexOf(mail.id) >= 0, open: m => this.open(m) }));
        this.mails.loadData(items);
    }
}
