import { SaveDataError, type AttemptSave, type RewardRequest, type SaveData } from '../data/SaveTypes';
import type { SaveService } from '../data/SaveService';
import type { NativeRewardReceipt, PlacementId, RewardAcknowledgement } from './AdProtocol';
import type { RewardedAdService } from './RewardedAdService';

export interface RewardAttemptResult {
  status: 'rewarded' | 'cancelled' | 'unavailable' | 'busy' | 'pending' | 'error';
  requestId?: string;
  errorCode?: string;
  save: SaveData;
}
export type AttemptValidator = (attempt: AttemptSave) => Promise<boolean>;

export class RewardCoordinator {
  private processing: Promise<unknown> = Promise.resolve();
  private recovering: Promise<void> | null = null;
  private requesting = false;
  private disposed = false;
  private readonly listeners = new Set<(save: SaveData) => void>();
  private readonly errorListeners = new Set<(errorCode: string) => void>();
  private readonly unsubscribe: () => void;

  public constructor(private readonly save: SaveService, private readonly ads: RewardedAdService, private readonly validateAttempt: AttemptValidator) {
    this.unsubscribe = ads.onReceipt((receipt) => {
      void this.enqueue(() => this.settle(receipt)).catch((error) => this.report(error));
    });
  }
  public get busy(): boolean { return this.requesting || this.ads.presentationActive; }
  public availability(placementId: PlacementId, attemptId: string): ReturnType<SaveService['getPlacementAvailability']> {
    return this.save.getPlacementAvailability(placementId, attemptId);
  }
  public async request(placementId: PlacementId, attemptId: string): Promise<RewardAttemptResult> {
    if (this.disposed) return this.result('error', undefined, 'coordinator_disposed');
    if (this.busy) return this.result('busy', undefined, 'presentation_busy');
    const available = this.availability(placementId, attemptId);
    if (!available.available) return this.result(available.reason === 'awaiting_evidence' ? 'pending' : 'unavailable', undefined, available.reason);
    this.requesting = true;
    let request: RewardRequest | null = null;
    let dispatched = false;
    try {
      if (await this.ads.prepare() !== 'ready') return this.result('unavailable', undefined, 'not_ready');
      if (this.disposed) return this.result('error', undefined, 'coordinator_disposed');
      request = await this.enqueue(() => {
        const registered = this.save.registerRewardRequest(placementId, attemptId);
        this.publish();
        return registered;
      });
      if (this.disposed) return this.result('pending', request.requestId, 'coordinator_disposed');
      this.save.markAwaiting(request.requestId);
      dispatched = true;
      const presentation = await this.ads.show(request);
      if (this.disposed) return this.result('pending', request.requestId, 'coordinator_disposed');
      if (presentation.receipt) await this.enqueue(() => this.settle(presentation.receipt!));
      else if (presentation.presentationEnded && !presentation.settlementPending && presentation.state !== 'rewarded') {
        await this.enqueue(() => { this.save.closeUnshownRequest(request!.requestId, presentation.errorCode ?? 'not_ready'); this.publish(); });
      }
      await this.processing;
      const terminal = this.save.snapshot().rewards.terminal[request.requestId];
      if (terminal?.state === 'settled') return this.result('rewarded', request.requestId);
      if (terminal?.state === 'closed_no_reward') return this.result(presentation.state === 'cancelled' ? 'cancelled' : 'unavailable', request.requestId, presentation.errorCode);
      if (terminal?.state === 'quarantined') return this.result('error', request.requestId, 'receipt_quarantined');
      return this.result('pending', request.requestId, presentation.errorCode);
    } catch (error) {
      if (!request && error instanceof SaveDataError) {
        const current = this.availability(placementId, attemptId);
        if (!current.available && error.code === current.reason) {
          return this.result(current.reason === 'awaiting_evidence' ? 'pending' : 'unavailable', undefined, current.reason);
        }
      }
      if (request && !dispatched && !this.disposed) {
        try { this.save.closeUnshownRequest(request.requestId, 'pre_dispatch_storage_error'); this.publish(); }
        catch (storageError) { this.report(storageError); }
      }
      this.report(error);
      return this.result('error', request?.requestId, this.errorCode(error));
    } finally { this.requesting = false; }
  }
  public recover(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.recovering) return this.recovering;
    const recovery = this.recoverNative();
    this.recovering = recovery.then(() => { this.recovering = null; }, (error) => { this.recovering = null; throw error; });
    return this.recovering;
  }
  private async recoverNative(): Promise<void> {
    let failures = 0;
    const receipts = await this.ads.recoverReceipts();
    if (this.disposed) return;
    for (const receipt of receipts) {
      try { await this.enqueue(() => this.settle(receipt)); }
      catch (error) { failures++; this.report(error); }
    }
    for (const pending of this.save.pendingRequestSnapshots()) {
      if (pending.state !== 'registered' || this.disposed || this.requesting) continue;
      try { await this.enqueue(() => {
        const current = this.save.pendingRequestSnapshots().find((item) => item.requestId === pending.requestId);
        if (this.requesting || current?.state !== 'registered') return;
        this.save.closeUnshownRequest(pending.requestId, 'registered_not_dispatched');
        this.publish();
      }); }
      catch (error) { failures++; this.report(error); }
    }
    for (const ack of this.save.unacknowledgedRewardAcks()) {
      try { await this.enqueue(() => this.acknowledge(ack)); }
      catch (error) { failures++; this.report(error); }
    }
    await this.ads.refreshPresentation();
    if (failures) throw new Error('reward_recovery_incomplete');
  }
  private async settle(receipt: NativeRewardReceipt): Promise<void> {
    if (this.disposed) return;
    let resumableAttemptId: string | null = null;
    const attempt = this.save.getCurrentAttempt();
    if (receipt.outcome === 'earned' && receipt.placementId === 'challenge_continue' && attempt?.attemptId === receipt.attemptId) {
      if (await this.validateAttempt(attempt)) resumableAttemptId = attempt.attemptId;
    }
    if (this.disposed) return;
    const settlement = this.save.settleRewardReceipt(receipt, resumableAttemptId);
    this.publish();
    await this.acknowledge(settlement.ack);
  }
  private async acknowledge(ack: RewardAcknowledgement): Promise<void> {
    if (this.disposed) return;
    if (await this.ads.acknowledge(ack) && !this.disposed) this.save.markNativeAcknowledged(ack.requestId, ack.receiptId, ack.disposition);
  }
  private enqueue<T>(operation: () => T | Promise<T>): Promise<T> {
    const work = this.processing.then(() => {
      if (this.disposed) throw new Error('coordinator_disposed');
      return operation();
    });
    this.processing = work.then(() => undefined, () => undefined);
    return work;
  }
  private result(status: RewardAttemptResult['status'], requestId?: string, errorCode?: string): RewardAttemptResult {
    return { status, requestId, errorCode, save: this.save.snapshot() };
  }
  private publish(): void {
    if (this.disposed) return;
    for (const listener of Array.from(this.listeners)) {
      try { listener(this.save.snapshot()); } catch (error) { this.report(error); }
    }
  }
  private errorCode(error: unknown): string { return error instanceof SaveDataError ? error.code : 'reward_storage_or_transport_error'; }
  private report(error: unknown): void {
    if (this.disposed) return;
    const code = this.errorCode(error);
    console.error('[RewardCoordinator]', code);
    for (const listener of Array.from(this.errorListeners)) {
      try { listener(code); } catch { /* A failing UI observer cannot block recovery. */ }
    }
  }
  public onChange(listener: (save: SaveData) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  public onError(listener: (errorCode: string) => void): () => void { this.errorListeners.add(listener); return () => this.errorListeners.delete(listener); }
  public dispose(): void {
    this.disposed = true;
    this.unsubscribe();
    this.listeners.clear();
    this.errorListeners.clear();
  }
}
