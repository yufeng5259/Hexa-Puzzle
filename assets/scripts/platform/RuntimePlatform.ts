export type RuntimePlatform = 'wechat-game' | 'android-native' | 'other-native' | 'web' | 'unsupported';

export interface PlatformFlags {
  isWechatGame: boolean;
  isNative: boolean;
  isAndroid: boolean;
  isBrowser: boolean;
}

export function detectRuntimePlatform(flags: PlatformFlags): RuntimePlatform {
  if (flags.isWechatGame) return 'wechat-game';
  if (flags.isNative) return flags.isAndroid ? 'android-native' : 'other-native';
  return flags.isBrowser ? 'web' : 'unsupported';
}
