export const DEFAULT_LOCALE = 'zh-Hans';
export const SUPPORTED_LOCALES = ['zh-Hans', 'en'] as const;

export type Locale = typeof SUPPORTED_LOCALES[number];

export type I18nKey =
  | 'brand.name'
  | 'loading.start'
  | 'loading.data'
  | 'loading.home'
  | 'loading.deferred'
  | 'loading.ready'
  | 'loading.failed'
  | 'loading.retry'
  | 'home.play'
  | 'home.continue'
  | 'home.level'
  | 'home.levelPrefix'
  | 'home.levelWithMode'
  | 'home.selectWorld'
  | 'top.hints'
  | 'top.settings'
  | 'daily.claim'
  | 'daily.reward'
  | 'daily.claimed'
  | 'daily.received'
  | 'worlds.title'
  | 'worlds.classic.name'
  | 'worlds.novice.name'
  | 'world.classic.name'
  | 'world.novice.name'
  | 'world.challenge.name'
  | 'world.classic.rule'
  | 'world.challenge.rule'
  | 'levels.progress'
  | 'levels.page'
  | 'settings.title'
  | 'settings.music'
  | 'settings.effects'
  | 'settings.vibration'
  | 'settings.language'
  | 'settings.language.zhHans'
  | 'settings.language.en'
  | 'settings.on'
  | 'settings.off'
  | 'settings.legacyRecords'
  | 'settings.privacy'
  | 'gameplay.moves'
  | 'gameplay.movesLabel'
  | 'gameplay.remainingLabel'
  | 'gameplay.modeRule'
  | 'gameplay.continuesUsed'
  | 'gameplay.failed'
  | 'gameplay.saveFailed'
  | 'gameplay.errors'
  | 'gameplay.errorsLabel'
  | 'gameplay.complete'
  | 'gameplay.hintsUsed'
  | 'gameplay.hintsUsedLabel'
  | 'gameplay.stars'
  | 'gameplay.improveHint'
  | 'gameplay.replay'
  | 'gameplay.levels'
  | 'gameplay.next'
  | 'hint.cancel'
  | 'reward.title'
  | 'reward.message'
  | 'reward.watch'
  | 'reward.ready'
  | 'reward.loading'
  | 'reward.pending'
  | 'reward.cancelled'
  | 'reward.rewarded'
  | 'reward.unavailable'
  | 'reward.error'
  | 'win.level'
  | 'win.improved'
  | 'win.unassisted'
  | 'win.assisted'
  | 'win.completed'
  | 'challenge.failed'
  | 'challenge.continue'
  | 'challenge.continued'
  | 'challenge.continueReady'
  | 'challenge.continueUnavailable'
  | 'challenge.replay'
  | 'challenge.levels'
  | 'legacy.title'
  | 'legacy.classic'
  | 'legacy.novice'
  | 'legacy.empty'
  | 'legacy.summary'
  | 'legacy.metrics'
  | 'legacy.completed'
  | 'legacy.incomplete';

export type I18nParams = Record<string, string | number>;
export type I18nCatalog = Record<I18nKey, string>;

export const I18N_CATALOGS: Record<Locale, I18nCatalog> = {
  'zh-Hans': {
    'brand.name': '六角拼图',
    'loading.start': '正在启动',
    'loading.data': '正在读取关卡',
    'loading.home': '正在准备首页',
    'loading.deferred': '正在整理素材',
    'loading.ready': '准备完成',
    'loading.failed': '资源加载失败，请重试',
    'loading.retry': '重试',
    'home.play': '开始',
    'home.continue': '继续',
    'home.level': '第 {level} 关',
    'home.levelPrefix': '第 {level} 关',
    'home.levelWithMode': '{mode} · 第 {level} 关',
    'home.selectWorld': '选择世界',
    'top.hints': '提示',
    'top.settings': '设置',
    'daily.claim': '领取提示',
    'daily.reward': '每日 +1 提示',
    'daily.claimed': '今日已领',
    'daily.received': '+1 提示已到账',
    'worlds.title': '世界',
    'worlds.classic.name': '轻松主线',
    'worlds.novice.name': '限步挑战',
    'world.classic.name': '轻松主线',
    'world.novice.name': '限步挑战',
    'world.challenge.name': '限步挑战',
    'world.classic.rule': '不限步数',
    'world.challenge.rule': '限步 · 辅助计入评级',
    'levels.progress': '{earned}/{total}',
    'levels.page': '{page}/{pages}',
    'settings.title': '设置',
    'settings.music': '音乐',
    'settings.effects': '音效',
    'settings.vibration': '震动',
    'settings.language': '语言',
    'settings.language.zhHans': '中文',
    'settings.language.en': 'English',
    'settings.on': '开',
    'settings.off': '关',
    'settings.legacyRecords': '旧版记录',
    'settings.privacy': '隐私选项',
    'gameplay.moves': '步数 {moves}',
    'gameplay.movesLabel': '步数',
    'gameplay.remainingLabel': '剩余步数',
    'gameplay.modeRule': '玩法',
    'gameplay.continuesUsed': '继续',
    'gameplay.failed': '步数用尽',
    'gameplay.saveFailed': '保存失败，请重试',
    'gameplay.errors': '错误 {errors}',
    'gameplay.errorsLabel': '错误',
    'gameplay.complete': '关卡完成',
    'gameplay.hintsUsed': '提示 {hints}',
    'gameplay.hintsUsedLabel': '已用提示',
    'gameplay.stars': '星级 {stars}',
    'gameplay.improveHint': '减少提示和错误可获得更多星星',
    'gameplay.replay': '重玩',
    'gameplay.levels': '关卡',
    'gameplay.next': '下一关',
    'hint.cancel': '取消',
    'reward.title': '免费提示',
    'reward.message': '观看一段广告可获得 1 个提示',
    'reward.watch': '观看广告',
    'reward.ready': '广告已准备好',
    'reward.loading': '正在准备广告',
    'reward.pending': '奖励结算中，请稍候',
    'reward.cancelled': '广告已关闭，可以重试',
    'reward.rewarded': '提示已到账',
    'reward.unavailable': '当前暂无可用广告',
    'reward.error': '广告加载失败',
    'win.level': '第 {level} 关',
    'win.improved': '新纪录',
    'win.unassisted': '无辅助',
    'win.assisted': '已辅助',
    'win.completed': '已完成',
    'challenge.failed': '挑战失败',
    'challenge.continue': '看广告 +3 步',
    'challenge.continued': '+3 步已到账',
    'challenge.continueReady': '观看激励广告可继续本次挑战',
    'challenge.continueUnavailable': '本次挑战暂时不能继续',
    'challenge.replay': '重玩',
    'challenge.levels': '关卡',
    'legacy.title': '旧版记录',
    'legacy.classic': '经典',
    'legacy.novice': '进阶',
    'legacy.empty': '没有旧版记录',
    'legacy.summary': '第 {level} 关 · {state}',
    'legacy.metrics': '星 {stars} · 步 {moves} · 错 {errors} · 提示 {hints}',
    'legacy.completed': '已完成',
    'legacy.incomplete': '未完成',
  },
  en: {
    'brand.name': 'HEXA PUZZLE',
    'loading.start': 'Loading',
    'loading.data': 'Loading levels',
    'loading.home': 'Preparing home',
    'loading.deferred': 'Preparing assets',
    'loading.ready': 'Ready',
    'loading.failed': 'Loading failed. Please retry.',
    'loading.retry': 'Retry',
    'home.play': 'PLAY',
    'home.continue': 'CONTINUE',
    'home.level': 'LEVEL {level}',
    'home.levelPrefix': 'LEVEL {level}',
    'home.levelWithMode': '{mode} · LEVEL {level}',
    'home.selectWorld': 'SELECT WORLD',
    'top.hints': 'HINTS',
    'top.settings': 'SETTINGS',
    'daily.claim': 'CLAIM HINT',
    'daily.reward': 'DAILY +1 HINT',
    'daily.claimed': 'CLAIMED TODAY',
    'daily.received': '+1 hint received',
    'worlds.title': 'WORLDS',
    'worlds.classic.name': 'Relaxed',
    'worlds.novice.name': 'Challenge',
    'world.classic.name': 'Relaxed',
    'world.novice.name': 'Challenge',
    'world.challenge.name': 'Challenge',
    'world.classic.rule': 'No move limit',
    'world.challenge.rule': 'Move limit · Assistance affects stars',
    'levels.progress': '{earned}/{total}',
    'levels.page': '{page}/{pages}',
    'settings.title': 'SETTINGS',
    'settings.music': 'Music',
    'settings.effects': 'Effects',
    'settings.vibration': 'Vibration',
    'settings.language': 'Language',
    'settings.language.zhHans': '中文',
    'settings.language.en': 'English',
    'settings.on': 'ON',
    'settings.off': 'OFF',
    'settings.legacyRecords': 'Legacy Records',
    'settings.privacy': 'Privacy Options',
    'gameplay.moves': 'Moves {moves}',
    'gameplay.movesLabel': 'Moves',
    'gameplay.remainingLabel': 'Moves left',
    'gameplay.modeRule': 'Mode',
    'gameplay.continuesUsed': 'Continues',
    'gameplay.failed': 'Out of moves',
    'gameplay.saveFailed': 'Save failed. Please retry.',
    'gameplay.errors': 'Errors {errors}',
    'gameplay.errorsLabel': 'Errors',
    'gameplay.complete': 'Level Complete',
    'gameplay.hintsUsed': 'Hints {hints}',
    'gameplay.hintsUsedLabel': 'Hints Used',
    'gameplay.stars': 'Stars {stars}',
    'gameplay.improveHint': 'Use fewer hints and avoid errors to earn more stars',
    'gameplay.replay': 'Replay',
    'gameplay.levels': 'Levels',
    'gameplay.next': 'Next',
    'hint.cancel': 'Cancel',
    'reward.title': 'Free Hint',
    'reward.message': 'Watch a rewarded ad to get 1 hint',
    'reward.watch': 'Watch Ad',
    'reward.ready': 'Ad ready',
    'reward.loading': 'Preparing ad',
    'reward.pending': 'Reward is being verified',
    'reward.cancelled': 'Ad closed. You can retry',
    'reward.rewarded': 'Hint received',
    'reward.unavailable': 'No ad is available',
    'reward.error': 'Ad failed to load',
    'win.level': 'Level {level}',
    'win.improved': 'New best',
    'win.unassisted': 'Unassisted',
    'win.assisted': 'Assisted',
    'win.completed': 'Completed',
    'challenge.failed': 'Challenge Failed',
    'challenge.continue': 'Watch Ad +3 Moves',
    'challenge.continued': '+3 moves received',
    'challenge.continueReady': 'Watch a rewarded ad to continue this challenge',
    'challenge.continueUnavailable': 'Continue is not available for this attempt',
    'challenge.replay': 'Replay',
    'challenge.levels': 'Levels',
    'legacy.title': 'Legacy Records',
    'legacy.classic': 'Classic',
    'legacy.novice': 'Novice',
    'legacy.empty': 'No legacy records',
    'legacy.summary': 'Level {level} · {state}',
    'legacy.metrics': 'Stars {stars} · Moves {moves} · Errors {errors} · Hints {hints}',
    'legacy.completed': 'Completed',
    'legacy.incomplete': 'Incomplete',
  },
};

export const TRANSLATIONS = I18N_CATALOGS;

export function normalizeLocale(value: unknown): Locale {
  for (const locale of SUPPORTED_LOCALES) {
    if (value === locale) return locale;
  }
  return DEFAULT_LOCALE;
}

export function assertCompleteCatalogs(): void {
  const keys = Object.keys(I18N_CATALOGS[DEFAULT_LOCALE]) as I18nKey[];
  for (const locale of SUPPORTED_LOCALES) {
    const missing = keys.filter((key) => !I18N_CATALOGS[locale][key]);
    if (missing.length > 0) throw new Error(`Missing i18n keys for ${locale}: ${missing.join(', ')}`);
  }
}

export class I18nService {
  private locale: Locale;

  public constructor(locale: unknown = DEFAULT_LOCALE) {
    this.locale = normalizeLocale(locale);
  }

  public get currentLocale(): Locale { return this.locale; }

  public setLocale(locale: unknown): Locale {
    this.locale = normalizeLocale(locale);
    return this.locale;
  }

  public t(key: I18nKey, params: I18nParams = {}): string {
    const template = I18N_CATALOGS[this.locale][key] ?? I18N_CATALOGS[DEFAULT_LOCALE][key] ?? key;
    return template.replace(/\{(\w+)\}/g, (token, name: string) => String(params[name] ?? token));
  }
}
