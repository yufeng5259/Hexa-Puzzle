import { Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ItemGridCell } from '../../../framework/ui/grid/ItemGridCell';
import { MailRule } from '../../domain/Daily';

const { ccclass, property } = _decorator;

export interface MailRowData {
    mail: MailRule;
    read: boolean;
    open: (mail: MailRule) => void;
}

/** 信件行（ScrollableItemGrid 单元）：未读/已读信封、标题、状态。 */
@ccclass('MailRow')
export class MailRow extends ItemGridCell<MailRowData> {
    @property(Node) unreadIcon: Node = null!;
    @property(Node) readIcon: Node = null!;
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) statusLabel: LocalizedLabel = null!;

    private data: MailRowData | null = null;

    onRefresh(data: MailRowData, _index: number): void {
        this.data = data;
        this.unreadIcon.active = !data.read;
        this.readIcon.active = data.read;
        this.titleLabel.setKey(data.mail.titleKey);
        this.statusLabel.setKey(data.read ? 'hg.daily.mail_read' : 'hg.daily.mail_unread');
    }

    onOpen(_event: unknown, _data: string): void {
        this.data!.open(this.data!.mail);
    }
}
