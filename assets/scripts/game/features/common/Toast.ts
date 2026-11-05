import { Node, _decorator } from 'cc';
import { TextParams } from '../../../framework/i18n/I18n';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { services } from '../../Services';

const { ccclass, property } = _decorator;

export interface ToastArgs { key: string; params?: TextParams; }

const SECONDS = 1.6;

/** 飘字提示：显示一条本地化文字，约 1.6 秒后自动关闭；再次调用替换文字并重新计时。 */
@ccclass('Toast')
@uiView({ bundle: 'common', path: 'prefabs/popups/Toast', layer: UILayer.Toast, queue: UIQueue.None, transition: 'none' })
export class Toast extends PopupBase<ToastArgs> {
    @property(Node) bar: Node = null!;
    @property(LocalizedLabel) textLabel: LocalizedLabel = null!;

    static show(key: string, params?: TextParams): void {
        void services.ui.open(Toast, { key, params });
    }

    protected setInfo(): void {
        this.textLabel.setParams({ text: services.i18n.t(this.args.key, this.args.params) });
        this.unscheduleAllCallbacks();
        this.scheduleOnce(() => this.close(), SECONDS);
    }
}
