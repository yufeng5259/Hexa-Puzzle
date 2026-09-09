import { ADWrap } from './ADWrap';
import { NativeWrap, type NativeEnvironment } from './NativeWrap';
import { NativeRewardedAdService } from './NativeRewardedAdService';
import { UnavailableRewardedAdService, type RewardedAdService } from './RewardedAdService';

const services = new WeakMap<object, RewardedAdService>();
export function createRewardedAdService(environment: NativeEnvironment, enabled = true): RewardedAdService {
  if (!environment.isAndroid) return new UnavailableRewardedAdService();
  const existing = services.get(environment.host);
  if (existing) return existing;
  const bridge = new NativeWrap(environment);
  environment.host.nativeClientCall = (payload: unknown) => bridge.nativeClientCall(payload);
  const service = new NativeRewardedAdService(new ADWrap(bridge, enabled));
  services.set(environment.host, service);
  return service;
}
