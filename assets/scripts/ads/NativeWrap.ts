export interface NativeReply {
    callId: string;
    success: boolean;
    errorCode?: string;
    value?: unknown;
}

export interface NativeEnvironment {
    isAndroid: boolean;
    reflection?: { callStaticMethod(...args: any[]): any };
    host: { nativeClientCall?: (payload: unknown) => void };
}

export interface NativeTimer {
    setTimeout(callback: () => void, milliseconds: number): unknown;
    clearTimeout(handle: unknown): void;
}

interface PendingCall {
    resolve: (reply: NativeReply) => void;
    timer?: unknown;
}

const ANDROID_PACKAGE = 'com/world/hexapuzzle/';
const DEFAULT_TIMEOUT = 15000;
const ASYNC_METHODS = new Map<string, string[]>([
    ['yzad/ADCenter', ['initAd', 'prepareVideo', 'showVideo']],
    ['SDKHandleClass', ['getRewardReceipts', 'acknowledgeReward', 'getPresentationState', 'getPrivacyOptionsRequired', 'showPrivacyOptions']],
]);
let nextBridgeId = 0;
const runtimeId = Array.from({ length: 4 }, () => Math.floor(Math.random() * 0x100000000).toString(16)).join('-');

/** Controlled JSON transport; the platform factory installs the host callback once. */
export class NativeWrap {
    private readonly bridgeId = ++nextBridgeId;
    private nextCallId = 0;
    private readonly pending = new Map<string, PendingCall>();
    private readonly listeners = new Set<(event: Record<string, unknown>) => void>();
    private disposed = false;

    constructor(private readonly environment: NativeEnvironment, private readonly timer: NativeTimer = {
        setTimeout: (callback, milliseconds) => setTimeout(callback, milliseconds),
        clearTimeout: (handle) => clearTimeout(handle as number),
    }) {}

    get pendingCount(): number { return this.pending.size; }

    call(className: string, method: string, param: Record<string, unknown> = {}, timeoutMs = DEFAULT_TIMEOUT): Promise<NativeReply> {
        const callId = this.createCallId();
        const methods = ASYNC_METHODS.get(className);
        const errorCode = this.checkAvailable(!!methods && methods.indexOf(method) >= 0);
        if (errorCode) return Promise.resolve({ callId, success: false, errorCode });
        let serialized: string;
        try {
            serialized = JSON.stringify(Object.assign({}, param, { callId }));
        } catch (_) {
            return Promise.resolve({ callId, success: false, errorCode: 'serialization_error' });
        }
        const boundedTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 2147483647
            ? timeoutMs : DEFAULT_TIMEOUT;
        return new Promise<NativeReply>((resolve) => {
            const entry: PendingCall = { resolve };
            this.pending.set(callId, entry);
            try {
                // Register before JNI: native may call back before reflection returns.
                entry.timer = this.timer.setTimeout(() => this.finish({ callId, success: false, errorCode: 'timeout' }), boundedTimeout);
            } catch (_) {
                this.finish({ callId, success: false, errorCode: 'timer_error' });
                return;
            }
            if (!this.pending.has(callId)) {
                this.clearTimer(entry);
                return;
            }
            try {
                this.environment.reflection!.callStaticMethod(ANDROID_PACKAGE + className, method, '(Ljava/lang/String;)V', serialized);
            } catch (_) {
                // A reflection exception cannot prove native did not start showing.
                this.finish({ callId, success: false, errorCode: 'bridge_error' });
            }
        });
    }

    callDirect(className: string, method: string, param: Record<string, unknown> = {}): NativeReply {
        const callId = this.createCallId();
        const errorCode = this.checkAvailable(className === 'yzad/ADCenter' && method === 'isVideoPrepared');
        if (errorCode) return { callId, success: false, errorCode };
        try {
            const serialized = JSON.stringify(Object.assign({}, param, { callId }));
            const raw = this.environment.reflection!.callStaticMethod(ANDROID_PACKAGE + className, method, '(Ljava/lang/String;)Ljava/lang/String;', serialized);
            const result = this.parseRecord(raw);
            if (!result || (result.success !== undefined && typeof result.success !== 'boolean') || !Object.prototype.hasOwnProperty.call(result, 'value')) {
                return { callId, success: false, errorCode: 'sync_error' };
            }
            return {
                callId,
                success: result.success !== false,
                value: result.value,
                ...(typeof result.errorCode === 'string' ? { errorCode: result.errorCode } : {}),
            };
        } catch (_) {
            return { callId, success: false, errorCode: 'sync_error' };
        }
    }

    nativeClientCall(payload: unknown): void {
        if (this.disposed) return;
        const parsed = this.parseRecord(payload);
        if (!parsed) return;
        // Lifecycle envelopes are never one-shot RPC replies, even if malformed.
        if (Object.prototype.hasOwnProperty.call(parsed, 'event')) {
            if (parsed.event !== 'rewarded_ad' || Object.prototype.hasOwnProperty.call(parsed, 'callId')) return;
            for (const listener of Array.from(this.listeners)) {
                try { listener(parsed); } catch (_) { /* Isolate independent observers. */ }
            }
            return;
        }
        if (typeof parsed.callId !== 'string' || !parsed.callId || typeof parsed.success !== 'boolean') return;
        this.finish({
            callId: parsed.callId,
            success: parsed.success,
            ...(typeof parsed.errorCode === 'string' ? { errorCode: parsed.errorCode } : {}),
            ...(Object.prototype.hasOwnProperty.call(parsed, 'value') ? { value: parsed.value } : {}),
        });
    }

    onEvent(listener: (event: Record<string, unknown>) => void): () => void {
        if (!this.disposed) this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.listeners.clear();
        for (const callId of Array.from(this.pending.keys())) {
            this.finish({ callId, success: false, errorCode: 'disposed_pending' });
        }
    }

    private createCallId(): string {
        return 'hexa-' + runtimeId + '-' + this.bridgeId + '-' + (++this.nextCallId);
    }

    private checkAvailable(allowed: boolean): string | undefined {
        if (this.disposed) return 'disposed';
        if (!allowed) return 'method_disabled';
        if (!this.environment.isAndroid) return 'non_android';
        if (!this.environment.reflection || typeof this.environment.reflection.callStaticMethod !== 'function') return 'bridge_missing';
        return undefined;
    }

    private parseRecord(payload: unknown): Record<string, unknown> | undefined {
        if (typeof payload !== 'string' || !payload) return undefined;
        try {
            const parsed: unknown = JSON.parse(payload);
            return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
                ? parsed as Record<string, unknown> : undefined;
        } catch (_) { return undefined; }
    }

    private finish(reply: NativeReply): void {
        const entry = this.pending.get(reply.callId);
        if (!entry) return;
        this.pending.delete(reply.callId);
        this.clearTimer(entry);
        entry.resolve(reply);
    }

    private clearTimer(entry: PendingCall): void {
        if (entry.timer === undefined) return;
        try { this.timer.clearTimeout(entry.timer); } catch (_) { /* Resolution must still complete. */ }
        entry.timer = undefined;
    }
}
