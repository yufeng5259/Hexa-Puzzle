import { Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ItemGridCell } from '../../../framework/ui/grid/ItemGridCell';

const { ccclass, property } = _decorator;

/** 信件行. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('MailRow')
export class MailRow extends ItemGridCell<unknown> {
    @property(Node) unreadIcon: Node = null!;
    @property(Node) readIcon: Node = null!;
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) statusLabel: LocalizedLabel = null!;

    onOpen(_event: unknown, _data: string): void {
        throw new Error('MailRow.onOpen not implemented');
    }
}
