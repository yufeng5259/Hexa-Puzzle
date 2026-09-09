import { _decorator, Component, Label } from 'cc';
import type { Locale } from '../i18n/I18nService';
import { nodes, setText } from './PrefabUi';
const { ccclass } = _decorator;
@ccclass('ToastView')
export class ToastView extends Component {
  public setup(message: string, locale: Locale = 'zh-Hans'): void {
    setText(this.node, 'message', message);
    for (const node of nodes(this.node)) {
      if (node.name.startsWith('zh_')) node.active = locale === 'zh-Hans';
      if (node.name.startsWith('en_')) node.active = locale === 'en';
      if (node.name === 'message_txt') {
        const label = node.getComponent(Label);
        if (label) label.string = message;
      }
    }
  }
}
