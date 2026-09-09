import { _decorator, Component } from 'cc';
import type { I18nKey } from '../i18n/I18nService';
import { bindAction, setText } from './PrefabUi';
import { compactNumber } from './UiNumbers';
const { ccclass } = _decorator;
export interface TopBarViewModel {
  hints: number;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
  onSettings: () => void;
}
@ccclass('TopBarView')
export class TopBarView extends Component {
  public setup(model: TopBarViewModel): void {
    this.setHintCount(model.hints);
    bindAction(this.node, 'settings', model.onSettings);
  }
  public setHintCount(hints: number): void {
    setText(this.node, 'hint-inventory', compactNumber(hints));
    setText(this.node, 'hint-count', compactNumber(hints));
  }
}
