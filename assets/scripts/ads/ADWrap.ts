import type { RewardRequest } from '../data/SaveTypes';
import { AD_BRIDGE_TIMEOUT_MS, AD_PROTOCOL_VERSION } from './AdPlacementConfig';
import type { NativeWrap, NativeReply } from './NativeWrap';
import type { RewardAcknowledgement } from './AdProtocol';

/** Rewarded subset of the reference ADWrap; UI, audio and inventory stay with this game's services. */
export class ADWrap {
  public constructor(private readonly bridge: NativeWrap, public readonly enabled = true) {}
  public Init(): Promise<NativeReply> { return this.bridge.call('yzad/ADCenter', 'initAd', { protocolVersion: AD_PROTOCOL_VERSION }); }
  public PrepareVideo(): Promise<NativeReply> { return this.bridge.call('yzad/ADCenter', 'prepareVideo'); }
  public IsVideoPrepared(): boolean {
    const reply = this.bridge.callDirect('yzad/ADCenter', 'isVideoPrepared');
    return reply.success && reply.value === true;
  }
  public ShowVideo(request: RewardRequest): Promise<NativeReply> {
    return this.bridge.call('yzad/ADCenter', 'showVideo', { ...request, protocolVersion: AD_PROTOCOL_VERSION }, AD_BRIDGE_TIMEOUT_MS);
  }
  public getRewardReceipts(): Promise<NativeReply> { return this.bridge.call('SDKHandleClass', 'getRewardReceipts'); }
  public acknowledgeReward(receipt: RewardAcknowledgement): Promise<NativeReply> { return this.bridge.call('SDKHandleClass', 'acknowledgeReward', { ...receipt }); }
  public getPresentationState(requestId: string): Promise<NativeReply> { return this.bridge.call('SDKHandleClass', 'getPresentationState', { requestId }); }
  public getPrivacyOptionsRequired(): Promise<NativeReply> { return this.bridge.call('SDKHandleClass', 'getPrivacyOptionsRequired'); }
  public showPrivacyOptions(): Promise<NativeReply> { return this.bridge.call('SDKHandleClass', 'showPrivacyOptions'); }
  public onEvent(listener: (event: Record<string, unknown>) => void): () => void { return this.bridge.onEvent(listener); }
}
