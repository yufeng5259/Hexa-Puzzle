import { _decorator, Component } from 'cc';
import type { I18nKey, Locale } from '../i18n/I18nService';
import { bindAction, selectVariant, setActionEnabled, setText } from './PrefabUi';
import type { RewardHintDialogState } from './RewardHintDialogView';
const { ccclass } = _decorator;
export interface ChallengeFailureViewModel {
  locale: Locale; continuesUsed: number;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
  onReplay: () => void; onContinue: () => void; onLevels: () => void;
}
@ccclass('ChallengeFailureView')
export class ChallengeFailureView extends Component {
  private model: ChallengeFailureViewModel | null = null;
  private state: RewardHintDialogState = 'idle';
  private available = false;
  private covered = false;
  public setup(model: ChallengeFailureViewModel): void {
    this.model = model;
    bindAction(this.node, 'primary', model.onContinue);
    bindAction(this.node, 'replay', model.onReplay);
    bindAction(this.node, 'levels', model.onLevels);
    bindAction(this.node, 'close', model.onLevels);
    this.setState('idle', false);
  }
  public setState(state: RewardHintDialogState, available = this.available): void {
    this.state = state;
    this.available = available;
    const model = this.model;
    if (!model) return;
    const used = model.continuesUsed >= 1;
    const root = selectVariant(this.node, used ? '19-continue-used' : '08-challenge-failure', model.locale);
    setText(root, 'quota', model.locale === 'en' ? `Continues: ${model.continuesUsed}/1` : `本局续局 ${model.continuesUsed}/1`);
    if (!used) {
      const key: I18nKey | null = state === 'loading' || state === 'showing' ? 'reward.loading'
        : state === 'pending' || state === 'awaiting_settlement' ? 'reward.pending'
        : state === 'unavailable' ? 'reward.unavailable' : state === 'error' ? 'reward.error'
        : state === 'cancelled' ? 'reward.cancelled' : null;
      setText(root, 'message', key ? model.t(key) : model.locale === 'en' ? 'Watch an ad for 3 more moves' : '观看广告，原局增加 3 步');
    }
    this.applyButtons();
  }
  public setCovered(covered: boolean): void { this.covered = covered; this.applyButtons(); }
  private applyButtons(): void {
    const retryable = this.state === 'ready' || this.state === 'cancelled' || this.state === 'error';
    setActionEnabled(this.node, 'primary', !this.covered && this.available && retryable && (this.model?.continuesUsed ?? 1) < 1);
    for (const id of ['replay', 'levels', 'close']) setActionEnabled(this.node, id, !this.covered);
  }
}
