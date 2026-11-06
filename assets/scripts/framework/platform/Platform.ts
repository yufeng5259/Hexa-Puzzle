import { native, sys } from 'cc';
import { debugLog } from '../Log';

/** One rewarded-ad presentation. `earned` only when the platform holds an earned receipt. */
export interface AdShowResult { earned: boolean; receiptId: string | null; errorCode: string | null; }

/** An earned receipt the game has not acknowledged yet (e.g. the app was killed before granting). */
export interface PendingReceipt { requestId: string; receiptId: string; request: Record<string, unknown>; }

export interface IPlatform {
    readonly name: 'web' | 'android';
    /** Show a rewarded video for `request` (game-defined JSON; must contain `requestId`). */
    showRewardedAd(request: Record<string, unknown> & { requestId: string }): Promise<AdShowResult>;
    /** Earned receipts left from earlier sessions. */
    pendingReceipts(): Promise<PendingReceipt[]>;
    /** Tell the platform the reward is saved, so the receipt is not recovered again. */
    acknowledge(requestId: string, receiptId: string): Promise<void>;
    vibrate(kind: 'light' | 'medium'): void;
}

/** Browser/dev platform: the rewarded video is simulated as watched. */
export class WebPlatform implements IPlatform {
    readonly name = 'web' as const;

    showRewardedAd(request: { requestId: string }): Promise<AdShowResult> {
        debugLog('Ad', 'web simulated', request.requestId);
        return new Promise(resolve => setTimeout(() => resolve({ earned: true, receiptId: 'web-' + request.requestId, errorCode: null }), 300));
    }

    pendingReceipts(): Promise<PendingReceipt[]> { return Promise.resolve([]); }
    acknowledge(): Promise<void> { return Promise.resolve(); }
    vibrate(): void {}
}

const AD_CENTER = 'com/hexa/block/puzzlegame/yzad/ADCenter';
const SDK = 'com/hexa/block/puzzlegame/SDKHandleClass';
const VOID_SIG = '(Ljava/lang/String;)V';
const PROTOCOL = 2;
const RPC_TIMEOUT_MS = 20000;

interface RpcReply { callId: string; success: boolean; value: unknown; errorCode: string | null; }
interface AdEvent { event: 'rewarded_ad'; requestId: string; phase: string; presentationEnded: boolean; errorCode: string | null;
    receipt?: { receiptId: string; outcome: string } & Record<string, unknown>; }

/**
 * Android: calls the native ADCenter / SDKHandleClass through jsb reflection; native answers through
 * window.nativeClientCall (RPC replies by callId, and rewarded_ad lifecycle events by requestId).
 */
export class AndroidPlatform implements IPlatform {
    readonly name = 'android' as const;
    private nextCall = 1;
    private readonly calls = new Map<string, (reply: RpcReply) => void>();
    private readonly shows = new Map<string, { receipt: AdEvent['receipt'] | null; done: (r: AdShowResult) => void }>();
    private ready: Promise<boolean> | null = null;

    constructor() {
        (globalThis as unknown as { nativeClientCall: (json: string) => void }).nativeClientCall = json => this.onNative(json);
    }

    async showRewardedAd(request: Record<string, unknown> & { requestId: string }): Promise<AdShowResult> {
        if (!(await this.init())) return { earned: false, receiptId: null, errorCode: 'ads_unavailable' };
        const prepared = await this.rpc(AD_CENTER, 'prepareVideo', {});
        if (!prepared.success) return { earned: false, receiptId: null, errorCode: prepared.errorCode };
        return new Promise(resolve => {
            this.shows.set(request.requestId, { receipt: null, done: resolve });
            void this.rpc(AD_CENTER, 'showVideo', { ...request, protocolVersion: PROTOCOL }).then(reply => {
                // Declined requests get only this reply; a failed show also sends a "failed" event right after it.
                // finish() is idempotent, so a short delay lets that event deliver its receipt first.
                if (!reply.success) setTimeout(() => this.finish(request.requestId, reply.errorCode), 500);
            });
        });
    }

    async pendingReceipts(): Promise<PendingReceipt[]> {
        if (!(await this.init())) return [];
        const reply = await this.rpc(SDK, 'getRewardReceipts', {});
        if (!reply.success) return [];
        return (reply.value as (Record<string, unknown> & { requestId: string; receiptId: string; outcome: string })[])
            .filter(r => r.outcome === 'earned')
            .map(r => ({ requestId: r.requestId, receiptId: r.receiptId, request: r }));
    }

    async acknowledge(requestId: string, receiptId: string): Promise<void> {
        const reply = await this.rpc(SDK, 'acknowledgeReward', { requestId, receiptId, disposition: 'settled' });
        if (!reply.success) debugLog('Ad', 'ack failed', requestId, reply.errorCode);
    }

    vibrate(kind: 'light' | 'medium'): void {
        debugLog('Platform', 'vibrate', kind);
    }

    private init(): Promise<boolean> {
        if (!this.ready) {
            this.ready = this.rpc(AD_CENTER, 'initAd', { protocolVersion: PROTOCOL }).then(reply => {
                debugLog('Ad', 'init', reply.success, reply.errorCode);
                if (!reply.success) this.ready = null;
                return reply.success;
            });
        }
        return this.ready;
    }

    private rpc(cls: string, method: string, body: Record<string, unknown>): Promise<RpcReply> {
        const callId = 'call-' + this.nextCall++;
        return new Promise(resolve => {
            const timer = setTimeout(() => {
                this.calls.delete(callId);
                resolve({ callId, success: false, value: null, errorCode: 'timeout' });
            }, RPC_TIMEOUT_MS);
            this.calls.set(callId, reply => { clearTimeout(timer); resolve(reply); });
            debugLog('Ad', '→', method, callId);
            native.reflection.callStaticMethod(cls, method, VOID_SIG, JSON.stringify({ ...body, callId }));
        });
    }

    private onNative(json: string): void {
        const message = JSON.parse(json) as RpcReply | AdEvent;
        if ('event' in message) {
            debugLog('Ad', 'event', message.phase, message.requestId, message.receipt?.outcome ?? '', message.errorCode ?? '');
            const show = this.shows.get(message.requestId);
            if (!show) return;
            if (message.receipt) show.receipt = message.receipt;
            if (message.presentationEnded) this.finish(message.requestId, message.errorCode);
            return;
        }
        debugLog('Ad', '←', message.callId, message.success, message.errorCode ?? '');
        const call = this.calls.get(message.callId);
        if (!call) return;
        this.calls.delete(message.callId);
        call(message);
    }

    private finish(requestId: string, errorCode: string | null): void {
        const show = this.shows.get(requestId);
        if (!show) return;
        this.shows.delete(requestId);
        const earned = show.receipt?.outcome === 'earned';
        show.done({ earned, receiptId: show.receipt?.receiptId ?? null, errorCode: earned ? null : errorCode });
    }
}

export function createPlatform(): IPlatform {
    return sys.platform === sys.Platform.ANDROID ? new AndroidPlatform() : new WebPlatform();
}
