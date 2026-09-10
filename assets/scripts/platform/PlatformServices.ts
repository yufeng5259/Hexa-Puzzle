import { native, sys } from 'cc';
import { createRewardedAdService } from '../ads/RewardedAdFactory';
import type { RewardedAdService } from '../ads/RewardedAdService';
import type { NativeEnvironment } from '../ads/NativeWrap';
import type { StorageLike } from '../data/SaveTypes';
import { detectRuntimePlatform, type RuntimePlatform } from './RuntimePlatform';

export interface PlatformServices {
  platform: RuntimePlatform;
  storage: StorageLike;
  rewardedAds: RewardedAdService;
}

function platformStorage(platform: RuntimePlatform): StorageLike {
  if (sys.localStorage) {
    const storage = sys.localStorage;
    if (platform !== 'wechat-game') return storage;
    return {
      getItem(key): string | null {
        const value = storage.getItem(key);
        if (value !== '') return value;
        // Cocos forwards wx's missing-key result as ''. Preserve a stored empty
        // value so malformed saves are still backed up instead of overwritten.
        const length = storage.length;
        for (let index = 0; index < length; index += 1) {
          if (storage.key(index) === key) return value;
        }
        return null;
      },
      setItem: (key, value) => { storage.setItem(key, value); },
    };
  }
  if (platform === 'web' && typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

export function createPlatformServices(): PlatformServices {
  const platform = detectRuntimePlatform({
    isWechatGame: sys.platform === sys.Platform.WECHAT_GAME,
    isNative: sys.isNative,
    isAndroid: sys.os === sys.OS.ANDROID,
    isBrowser: sys.isBrowser,
  });
  const storage = platformStorage(platform);
  if (platform !== 'android-native') {
    return { platform, storage, rewardedAds: createRewardedAdService({ platform }) };
  }
  // The Android Java callback targets window.nativeClientCall.
  const host = (typeof window !== 'undefined' ? window : globalThis) as unknown as NativeEnvironment['host'];
  return {
    platform,
    storage,
    rewardedAds: createRewardedAdService({
      platform,
      native: {
        isAndroid: true,
        host,
        reflection: native.reflection ? {
          callStaticMethod(className: string, method: string, signature: string, payload: string): any {
            return native.reflection.callStaticMethod(className, method, signature, payload);
          },
        } : undefined,
      },
    }),
  };
}
