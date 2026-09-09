import type { RewardRequest } from '../data/SaveTypes';
import { ADWrap } from './ADWrap';
import { AD_SHOW_OBSERVATION_MS } from './AdPlacementConfig';
import { copyRequest, isNativeAdEvent, isNativeReceipt, isPresentation, isRewardRequest, type NativeRewardReceipt, type RewardAcknowledgement } from './AdProtocol';
import type { NativeReply, NativeTimer } from './NativeWrap';
import type { RewardedAdResult, RewardedAdService, RewardedAdState } from './RewardedAdService';

interface PresentationWait {
  request: RewardRequest;
  receipt: NativeRewardReceipt | null;
  resolve: ((result: RewardedAdResult) => void) | null;
  timer: unknown;
}
const localFailures = ['non_android', 'bridge_missing', 'method_disabled', 'serialization_error', 'timer_error', 'disposed'];
const defaultTimer: NativeTimer = {
  setTimeout: (callback, milliseconds) => setTimeout(callback, milliseconds),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

export class NativeRewardedAdService implements RewardedAdService {
  private static owner: NativeRewardedAdService | null = null;
  public state: RewardedAdState = 'idle';
  private wait: PresentationWait | null = null;
  private preparing: Promise<RewardedAdState> | null = null;
  private readonly receiptListeners = new Set<(receipt: NativeRewardReceipt) => void>();
  private readonly presentationListeners = new Set<(active: boolean) => void>();

  public constructor(private readonly ads: ADWrap, private readonly timer: NativeTimer = defaultTimer) {
    ads.onEvent((value) => {
      if (!isNativeAdEvent(value)) return;
      if (value.receipt) this.receiveReceipt(value.receipt);
      if (this.wait?.request.requestId !== value.requestId) return;
      if (value.presentationEnded === true && (value.phase === 'dismissed' || value.phase === 'failed')) {
        this.endPresentation(value.phase === 'failed' ? 'error' : 'cancelled', value.errorCode);
      }
    });
  }
  public get presentationActive(): boolean { return NativeRewardedAdService.owner !== null; }
  public prepare(): Promise<RewardedAdState> {
    if (this.preparing) return this.preparing;
    if (this.presentationActive) return Promise.resolve(this.state);
    if (!this.ads.enabled) { this.state = 'unavailable'; return Promise.resolve(this.state); }
    this.state = 'loading';
    this.preparing = this.prepareNative().then((state) => {
      this.state = state;
      this.preparing = null;
      return state;
    }, () => { this.state = 'error'; this.preparing = null; return this.state; });
    return this.preparing;
  }
  private async prepareNative(): Promise<RewardedAdState> {
    const initial = await this.ads.Init();
    if (!initial.success || initial.value !== true) return 'unavailable';
    const prepared = await this.ads.PrepareVideo();
    return prepared.success && prepared.value === 'ready' ? 'ready' : prepared.errorCode === 'timeout' ? 'error' : 'unavailable';
  }
  public show(request: RewardRequest): Promise<RewardedAdResult> {
    const requestId = request?.requestId ?? '';
    if (!isRewardRequest(request)) return Promise.resolve(this.localResult(requestId, 'error', 'invalid_request'));
    if (this.presentationActive) return Promise.resolve(this.localResult(requestId, 'busy', 'presentation_busy'));
    if (!this.ads.enabled || this.state !== 'ready') return Promise.resolve(this.localResult(requestId, 'unavailable', this.ads.enabled ? 'not_ready' : 'ads_disabled'));
    NativeRewardedAdService.owner = this;
    this.state = 'showing';
    return new Promise((resolve) => {
      const wait: PresentationWait = { request: copyRequest(request), receipt: null, resolve, timer: null };
      this.wait = wait;
      this.emit(this.presentationListeners, true);
      try { wait.timer = this.timer.setTimeout(() => { void this.observePresentation(wait); }, AD_SHOW_OBSERVATION_MS); }
      catch { this.endPresentation('error', 'timer_error', true); return; }
      try {
        void this.ads.ShowVideo(wait.request).then((reply) => this.handleShowReply(wait, reply), () => this.unknownPresentation(wait, 'bridge_error'));
      } catch { this.unknownPresentation(wait, 'bridge_error'); }
    });
  }
  private localResult(requestId: string, state: RewardedAdResult['state'], errorCode: string): RewardedAdResult {
    return { requestId, state, errorCode, presentationEnded: true, settlementPending: false };
  }
  private handleShowReply(wait: PresentationWait, reply: NativeReply): void {
    if (this.wait !== wait) return;
    if (isPresentation(reply.value) && reply.value.requestId === wait.request.requestId) {
      if (reply.value.receipt) this.receiveReceipt(reply.value.receipt);
      if (reply.value.presentationEnded) this.endPresentation(reply.success ? 'cancelled' : 'error', reply.errorCode);
      return;
    }
    if (!reply.success && localFailures.indexOf(reply.errorCode ?? '') >= 0) {
      this.endPresentation('unavailable', reply.errorCode, true);
    } else if (!reply.success || !isPresentation(reply.value)) {
      this.unknownPresentation(wait, reply.errorCode ?? 'invalid_presentation_reply');
      void this.refreshPresentation();
    }
  }
  private unknownPresentation(wait: PresentationWait, errorCode: string): void {
    if (this.wait !== wait) return;
    this.state = 'awaiting_settlement';
    const resolve = wait.resolve;
    wait.resolve = null;
    resolve?.({ requestId: wait.request.requestId, state: 'timeout', errorCode, presentationEnded: false, settlementPending: true });
  }
  private async observePresentation(wait: PresentationWait): Promise<void> {
    await this.refreshPresentation();
    if (this.wait === wait) this.unknownPresentation(wait, 'presentation_unconfirmed');
  }
  public async refreshPresentation(): Promise<void> {
    const owner = NativeRewardedAdService.owner;
    if (owner && owner !== this) return owner.refreshPresentation();
    const wait = this.wait;
    if (!wait) return;
    let reply: NativeReply;
    try { reply = await this.ads.getPresentationState(wait.request.requestId); }
    catch { return; }
    if (this.wait !== wait || !reply.success || !isPresentation(reply.value) || reply.value.requestId !== wait.request.requestId) return;
    if (reply.value.receipt) this.receiveReceipt(reply.value.receipt);
    if (reply.value.presentationEnded) this.endPresentation('cancelled');
  }
  private endPresentation(fallback: RewardedAdResult['state'], errorCode?: string, definitelyNotShown = false): void {
    const wait = this.wait;
    if (!wait) return;
    this.wait = null;
    NativeRewardedAdService.owner = null;
    try { this.timer.clearTimeout(wait.timer); } catch { /* The presentation is already confirmed closed. */ }
    const state = wait.receipt?.outcome === 'earned' ? 'rewarded' : fallback;
    this.state = state === 'rewarded' ? 'rewarded' : state === 'error' ? 'error' : 'idle';
    this.emit(this.presentationListeners, false);
    wait.resolve?.({
      requestId: wait.request.requestId, state, presentationEnded: true,
      settlementPending: !wait.receipt && !definitelyNotShown, errorCode,
      ...(wait.receipt ? { receipt: wait.receipt } : {}),
    });
  }
  private receiveReceipt(receipt: NativeRewardReceipt): void {
    if (this.wait?.request.requestId === receipt.requestId && this.wait.receipt?.outcome !== 'earned') {
      this.wait.receipt = JSON.parse(JSON.stringify(receipt)) as NativeRewardReceipt;
    }
    this.emit(this.receiptListeners, receipt);
  }
  public async recoverReceipts(): Promise<NativeRewardReceipt[]> {
    const reply = await this.ads.getRewardReceipts();
    if (!reply.success || !Array.isArray(reply.value)) throw new Error(reply.errorCode ?? 'invalid_receipt_list');
    if (!reply.value.every(isNativeReceipt)) throw new Error('invalid_receipt');
    return reply.value;
  }
  public async acknowledge(receipt: RewardAcknowledgement): Promise<boolean> {
    const reply = await this.ads.acknowledgeReward(receipt);
    return reply.success && reply.value === true;
  }
  public async getPrivacyOptionsRequired(): Promise<boolean> {
    const reply = await this.ads.getPrivacyOptionsRequired();
    return reply.success && reply.value === true;
  }
  public async showPrivacyOptions(): Promise<boolean> {
    if (this.presentationActive) return false;
    const reply = await this.ads.showPrivacyOptions();
    return reply.success && reply.value === true;
  }
  public onReceipt(listener: (receipt: NativeRewardReceipt) => void): () => void {
    this.receiptListeners.add(listener); return () => this.receiptListeners.delete(listener);
  }
  public onPresentation(listener: (active: boolean) => void): () => void {
    this.presentationListeners.add(listener); return () => this.presentationListeners.delete(listener);
  }
  private emit<T>(listeners: Set<(value: T) => void>, value: T): void {
    for (const listener of Array.from(listeners)) {
      try { listener(typeof value === 'object' ? JSON.parse(JSON.stringify(value)) as T : value); }
      catch (error) { console.error('[RewardedAdService] Listener failed', error); }
    }
  }
}
