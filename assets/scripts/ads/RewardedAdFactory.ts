import { ADWrap } from './ADWrap';
import { NativeWrap, type NativeEnvironment } from './NativeWrap';
import { NativeRewardedAdService } from './NativeRewardedAdService';
import { UnavailableRewardedAdService, type RewardedAdService } from './RewardedAdService';
import type { RuntimePlatform } from '../platform/RuntimePlatform';

export type RewardedAdEnvironment =
  | { platform: 'android-native'; native: NativeEnvironment }
  | { platform: Exclude<RuntimePlatform, 'android-native'> };

const services = new WeakMap<object, RewardedAdService>();
export function createRewardedAdService(environment: RewardedAdEnvironment, enabled = true): RewardedAdService {
  if (environment.platform === 'wechat-game') return new UnavailableRewardedAdService('wechat_ads_not_configured');
  if (environment.platform !== 'android-native') return new UnavailableRewardedAdService();
  const nativeEnvironment = environment.native;
  if (!nativeEnvironment.isAndroid) return new UnavailableRewardedAdService();
  const existing = services.get(nativeEnvironment.host);
  if (existing) return existing;
  const bridge = new NativeWrap(nativeEnvironment);
  nativeEnvironment.host.nativeClientCall = (payload: unknown) => bridge.nativeClientCall(payload);
  const service = new NativeRewardedAdService(new ADWrap(bridge, enabled));
  services.set(nativeEnvironment.host, service);
  return service;
}
