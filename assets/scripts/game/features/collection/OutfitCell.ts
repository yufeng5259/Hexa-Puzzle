import { Component, Node, _decorator } from 'cc';
import { TextParams } from '../../../framework/i18n/I18n';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';

const { ccclass, property } = _decorator;

/** 衣柜格：正在使用（勾）/ 已拥有 / 未拥有（锁 + 来源）。 */
@ccclass('OutfitCell')
export class OutfitCell extends Component {
    @property(Node) usingNode: Node = null!;
    @property(Node) lockNode: Node = null!;
    @property(LocalizedLabel) statusLabel: LocalizedLabel = null!;

    onPick: () => void = () => {};
    /**
     * The prefab-authored status key names how the outfit is obtained ("未拥有 签到第{count}天" …).
     * Captured on the first show, before setKey replaces it: the page refreshes cells before their onLoad runs.
     */
    private sourceKey = '';

    show(using: boolean, owned: boolean, usingKey: string, sourceParams: TextParams): void {
        if (!this.sourceKey) this.sourceKey = this.statusLabel.key;
        this.usingNode.active = using;
        this.lockNode.active = !owned;
        if (using) this.statusLabel.setKey(usingKey);
        else if (owned) this.statusLabel.setKey('hg.collection.owned');
        else this.statusLabel.setKey(this.sourceKey, sourceParams);
    }

    onSelect(_event: unknown, _data: string): void {
        this.onPick();
    }
}
