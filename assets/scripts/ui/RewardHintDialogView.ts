import { _decorator, Component } from 'cc';
import type { RewardedAdState } from '../ads/RewardedAdService';
import type { I18nKey, Locale } from '../i18n/I18nService';
import { bindAction, selectVariant, setActionEnabled, setText } from './PrefabUi';
const { ccclass } = _decorator;
export type RewardHintDialogState = RewardedAdState | 'pending' | 'cancelled';
export interface RewardHintDialogModel {
  locale: Locale; t: (key: I18nKey) => string; remainingRefills: () => number;
  onWatch: () => void; onClose: () => void;
}
@ccclass('RewardHintDialogView')
export class RewardHintDialogView extends Component {
  private model: RewardHintDialogModel | null = null;
  private state: RewardHintDialogState = 'idle';
  public setup(model: RewardHintDialogModel): void {
    this.model = model;
    bindAction(this.node, 'primary', () => { if (this.state === 'rewarded') model.onClose(); else model.onWatch(); });
    bindAction(this.node, 'secondary', model.onClose);
    bindAction(this.node, 'close', model.onClose);
    this.setState('idle');
  }
  public setState(state: RewardHintDialogState): void {
    const model = this.model;
    if (!model) return;
    this.state = state;
    const pending = state === 'pending' || state === 'awaiting_settlement';
    const busy = state === 'idle' || state === 'loading' || state === 'showing' || pending;
    const unavailable = state === 'unavailable';
    const root = selectVariant(this.node, state === 'rewarded' ? '18-hint-earned' : busy ? '16-hint-loading'
      : unavailable ? '17-hint-unavailable' : '07-hint-confirm', model.locale);
    if (!busy && !unavailable && state !== 'rewarded') {
      const count = Math.max(0, model.remainingRefills());
      setText(root, 'detail', model.locale === 'en' ? `Rewards left this game: ${count}` : `本局还可领取 ${count} 次`);
    }
    if (busy) setText(root, 'message', model.t(pending ? 'reward.pending' : 'reward.loading'));
    if (state === 'cancelled') setText(root, 'detail', model.t('reward.cancelled'));
    if (state === 'error') setText(root, 'detail', model.t('reward.error'));
    setActionEnabled(this.node, 'primary', state === 'ready' || state === 'cancelled' || state === 'error' || state === 'rewarded');
  }
}
