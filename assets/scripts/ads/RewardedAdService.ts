import type { RewardRequest } from '../data/SaveTypes';
import type { NativeRewardReceipt, RewardAcknowledgement } from './AdProtocol';

export type RewardedAdState = 'idle' | 'loading' | 'ready' | 'showing' | 'awaiting_settlement' | 'rewarded' | 'unavailable' | 'error';

export interface RewardedAdResult {
  state: 'rewarded' | 'unavailable' | 'error' | 'cancelled' | 'timeout' | 'busy';
  requestId: string;
  presentationEnded: boolean;
  settlementPending: boolean;
  errorCode?: string;
  receipt?: NativeRewardReceipt;
}

export interface RewardedAdService {
  readonly state: RewardedAdState;
  readonly presentationActive: boolean;
  prepare(): Promise<RewardedAdState>;
  show(request: RewardRequest): Promise<RewardedAdResult>;
  recoverReceipts(): Promise<NativeRewardReceipt[]>;
  acknowledge(receipt: RewardAcknowledgement): Promise<boolean>;
  refreshPresentation(): Promise<void>;
  getPrivacyOptionsRequired(): Promise<boolean>;
  showPrivacyOptions(): Promise<boolean>;
  onReceipt(listener: (receipt: NativeRewardReceipt) => void): () => void;
  onPresentation(listener: (active: boolean) => void): () => void;
}

export class UnavailableRewardedAdService implements RewardedAdService {
  public constructor(private readonly errorCode = 'unsupported_platform') {}
  public readonly state = 'unavailable' as const;
  public readonly presentationActive = false;
  public async prepare(): Promise<RewardedAdState> { return this.state; }
  public async show(request: RewardRequest): Promise<RewardedAdResult> {
    return { state: 'unavailable', requestId: request.requestId, presentationEnded: true, settlementPending: false, errorCode: this.errorCode };
  }
  public async recoverReceipts(): Promise<NativeRewardReceipt[]> { return []; }
  public async acknowledge(_receipt: RewardAcknowledgement): Promise<boolean> { return false; }
  public async refreshPresentation(): Promise<void> {}
  public async getPrivacyOptionsRequired(): Promise<boolean> { return false; }
  public async showPrivacyOptions(): Promise<boolean> { return false; }
  public onReceipt(_listener: (receipt: NativeRewardReceipt) => void): () => void { return () => {}; }
  public onPresentation(_listener: (active: boolean) => void): () => void { return () => {}; }
}
