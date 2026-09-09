export interface PrefabContract {
  surface: string;
  resourcePath: string | null;
  filePath: string | null;
  prefabRequired: readonly string[];
  runtimeProvided: readonly string[];
  futurePrefabTarget: readonly string[];
}

function prefab(surface: string, resourcePath: string | null, filePath: string, prefabRequired: readonly string[], runtimeProvided: readonly string[] = []): PrefabContract {
  return { surface, resourcePath, filePath, prefabRequired, runtimeProvided, futurePrefabTarget: [] };
}

const levelButtonNodes = [
  'button_bg_available',
  'button_bg_current',
  'button_bg_completed',
  'button_bg_locked',
  'number_label',
  'stars_root/star_1_filled',
  'stars_root/star_1_empty',
  'stars_root/star_2_filled',
  'stars_root/star_2_empty',
  'stars_root/star_3_filled',
  'stars_root/star_3_empty',
  'completion_badge',
  'lock_icon',
] as const;

function view(page: string, children: readonly string[] = []): string[] {
  return [`view_${page}`, ...children.map((child) => `view_${page}/${child}`)];
}

function active(surface: string, folder: string, required: readonly string[], dynamic: readonly string[] = []): PrefabContract {
  return prefab(surface, `prefabs/${folder}/${surface}`, `assets/resources/prefabs/${folder}/${surface}.prefab`, required, dynamic);
}

function states(pages: readonly string[], children: readonly string[]): string[] {
  const result: string[] = [];
  for (const page of pages) result.push(...view(page, children));
  return result;
}

export const PREFAB_CONTRACTS: readonly PrefabContract[] = [
  active('TopBar', 'common', view('topbar', ['img_hint-capsule', 'zh_hint-count', 'en_hint-count'])),
  active('HomePage', 'pages', states(['01-home', '14-home-claimed'], ['hit_play', 'hit_worlds', 'hit_daily', 'zh_play-title', 'en_play-title'])),
  active('MapPage', 'pages', view('02-worlds', ['hit_classic', 'hit_challenge', 'hit_back'])),
  active('LevelPage', 'pages', [
    ...view('03-classic-levels', Array.from({ length: 20 }, (_, index) => `hit_level-${('0' + (index + 1)).slice(-2)}`)),
    ...view('04-challenge-levels', Array.from({ length: 10 }, (_, index) => `hit_level-${('0' + (index + 1)).slice(-2)}`)),
  ]),
  active('GameplayPage', 'pages', states(['05-classic-gameplay', '06-challenge-gameplay', '15-persistent-hint'],
    ['board_mount', 'tray_mount', 'editor_board_preview', 'editor_tray_preview', 'hit_hint', 'hit_back']), ['Board', 'Tray', 'PlacementPreview']),
  active('SettingsPanel', 'items', view('11-settings', [
    'hit_close', 'hit_music', 'hit_sound', 'hit_vibration', 'hit_language-zh', 'hit_language-en', 'hit_privacy', 'hit_legacy',
    'img_music-toggle-on', 'img_music-toggle-off',
  ])),
  active('WinOverlay', 'items', [
    ...view('09-classic-result', ['hit_next', 'hit_replay', 'hit_levels']),
    ...states(['10-challenge-result', '20-challenge-assisted'], ['star_1_gold', 'star_1_gray', 'star_2_gold', 'star_2_gray', 'star_3_gold', 'star_3_gray']),
  ]),
  active('Toast', 'items', view('toast', ['img_toast-bg', 'zh_message', 'en_message'])),
  active('RewardHintDialog', 'items', states(['07-hint-confirm', '16-hint-loading', '17-hint-unavailable', '18-hint-earned'], ['hit_primary', 'hit_close', 'zh_message', 'en_message'])),
  active('ChallengeFailurePanel', 'items', states(['08-challenge-failure', '19-continue-used'], ['hit_primary', 'hit_replay', 'hit_levels', 'zh_quota', 'en_quota'])),
  active('LegacyRecordsPanel', 'items', view('12-legacy-records', [
    'hit_classic', 'hit_novice', 'hit_previous', 'hit_next', 'hit_return', 'zh_page-indicator', 'en_page-indicator',
    ...Array.from({ length: 4 }, (_, index) => `en_record-${index + 1}-number`),
  ])),
  active('LoadingPage', 'pages', view('13-loading', ['img_progress-track', 'img_progress-fill', 'zh_progress-value', 'en_progress-value', 'hit_retry'])),
  active('CellVisual', 'items', []),
];

export const ARCHIVED_PREFAB_CONTRACTS: readonly PrefabContract[] = [
  prefab('MapCard', null, 'assets/resources/prefabs/items/MapCard.prefab', [
    'card_bg',
    'environment_art',
    'crest_frame',
    'crest_icon',
    'name_label',
    'rule_label',
    'progress_pill/star_icon',
    'progress_pill/progress_label',
  ]),
  prefab('MapBack', null, 'assets/resources/prefabs/items/MapBack.prefab', ['back_icon']),
  ...['Locked', 'Available', 'Current', 'Completed'].map((state): PrefabContract => prefab(`Level${state}`, null, `assets/resources/prefabs/items/Level${state}.prefab`, levelButtonNodes)),
];
