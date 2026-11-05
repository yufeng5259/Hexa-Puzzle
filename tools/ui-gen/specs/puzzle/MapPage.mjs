import { layer, group, sprite, label } from '../../lib/dsl.mjs';

// Base art: the original map page (background, 8 level positions, current marker, decor).
// Single-player redesign (HUD, entry captions, bottom entry texts) comes from T09-01, whose map layer is the same page.
const T09 = 'T09-01_未完成拼图续玩';
const GOLD = 'PNG/公共UI/金色关卡盾牌母件_747dc74440.png';
const GREY = 'PNG/公共UI/灰色关卡盾牌母件_bad4bb901e.png';
const STAR_GOLD = 'PNG/公共UI/金色星级母件_c3b3c58c59.png';
const STAR_GREY = 'PNG/公共UI/灰色星级母件_f430e91c0a.png';
const RED_DOT = 'PNG/页面素材/微信图片_20261019173444_81_187/UI/每日签到红点_87ba916694.png';
const NUMBER = { size: 43, color: [255, 245, 211], bold: true, outline: [105, 65, 32], outlineWidth: 1.3 };
const CAPTION = { size: 24, color: [255, 248, 223], bold: true, outline: [101, 64, 29], outlineWidth: 1.2 };

// Index 0 is the lowest level on the page (bottom of the path); [shield rect, star rects].
const LEVELS = [
  [[246, 1297, 110, 111], [[252, 1379, 37, 35], [285, 1379, 37, 35], [318, 1379, 37, 35]]],
  [[439, 1195, 119, 120], [[449, 1279, 38, 36], [483, 1279, 38, 36], [517, 1279, 38, 36]]],
  [[515, 1051, 119, 113], [[523, 1136, 38, 36], [557, 1136, 38, 36], [591, 1136, 38, 36]]],
  [[306, 941, 131, 124], [[315, 1033, 40, 38], [351, 1033, 40, 38], [387, 1033, 40, 38]]],
  [[167, 765, 116, 110], [[176, 853, 36, 34], [208, 853, 37, 35], [241, 853, 37, 35]]],
  [[335, 668, 110, 104], [[342, 749, 36, 34], [375, 749, 35, 33], [407, 749, 36, 34]]],
  [[444, 545, 105, 106], [[449, 626, 35, 33], [481, 625, 36, 34], [514, 626, 35, 33]]],
  [[231, 434, 103, 104], [[237, 515, 32, 31], [267, 513, 35, 34], [298, 513, 35, 34]]],
];

const levelNode = ([shield, stars], i) => {
  const [x, y, w, h] = shield;
  return group(`Level${i + 1}`, [
    sprite('ShieldGrey', GREY, shield),
    sprite('ShieldGold', GOLD, shield, { bind: ['shieldGold', 'Node'], note: '已解锁显示金盾，否则露出灰盾' }),
    label('Number', null, [x + 0.16 * w, y + 0.2 * h, 0.68 * w, 0.63 * h], { ...NUMBER, size: Math.round(43 * w / 117) }, { text: String(i + 1), bind: 'numberLabel' }),
    label('Challenge', 'block.84d00cb6c99a.text.6791f5354445', [x - 6, y - 30, w + 12, 34], { ...NUMBER, size: 25, outlineWidth: 1 }, { active: false, bind: ['challengeMark', 'Node'] }),
    ...stars.map((r, s) => group(`Star${s + 1}`, [
      sprite('Grey', STAR_GREY, r),
      sprite('Gold', STAR_GOLD, r, { bindArray: 'starsGold', note: '金星盖在灰星上，按星数显示' }),
    ])),
  ], { script: 'game/features/map/LevelNode', bindArray: 'levels', button: 'onTap' });
};

// Rails: [id, icon rect, caption layer (T09) or null, icon file or T09 icon layer]
const entry = (id, icon, rect, caption) => group(`Entry_${id}`, [
  icon,
  caption,
  sprite('RedDot', RED_DOT, [rect[0] + 87, rect[1] - 6, 35, 35], { active: false, bind: ['redDot', 'Node'] }),
], { script: 'game/features/map/MapEntry', bindArray: 'entries', button: 'onClick', data: id });

const icon = (file, rect) => sprite('Icon', file, rect);

export default {
  name: 'MapPage', bundle: 'puzzle', kind: 'page', script: 'game/features/map/MapPage', title: '主线地图（唯一主界面，12 页 × 8 关）',
  source: '微信图片_20261019173444_81_187',
  doc: {
    args: '{ page?: number }（默认当前可玩关所在页）', sources: [T09], features: 'F007、F008、F013、F021、F029、F035、F041、F043、F045、F050、F057',
    dynamic: '8 个 LevelNode 固定槽，翻页只刷新数据（关号、金/灰盾、0–3 星、限步标记）；CurrentGlow/CurrentMarker 移到当前关；入口红点；花园总进度与填充；无尽最高分或解锁条件',
    states: 'LevelNode: ShieldGold（盖在灰盾上）、Star*/Gold（盖在灰星上）、Challenge；Entry: RedDot；Endless: Locked/Best 二选一；PagePrev/PageNext 首末页隐藏',
    fx: 'FX-12（翻页过渡）',
  },
  children: [
    layer('完整裸背景', { as: 'Background' }),
    layer('当前关卡高亮光晕', { as: 'CurrentGlow', bind: ['currentGlow', 'Node'], note: '移到当前关' }),
    group('Levels', LEVELS.map(levelNode)),
    layer('当前关卡头像标记', { as: 'CurrentMarker', bind: ['currentMarker', 'Node'], note: '移到当前关上方' }),
    layer('抱蜜罐蜜蜂', { as: 'DecorBee' }),
    group('LeftRail', [
      entry('signin', layer('七日礼物_图标', { from: T09, as: 'Icon' }), [18, 201, 125, 132], layer('七日礼物', { from: T09, as: 'Caption' })),
      entry('achievement', icon('PNG/补充/R-12_入口_成就.png', [18, 359, 125, 124]), [18, 359, 125, 124], layer('本机成就', { from: T09, as: 'Caption' })),
      entry('tasks', layer('每日任务_图标', { from: T09, as: 'Icon' }), [18, 507, 125, 137], layer('每日任务', { from: T09, as: 'Caption' })),
      entry('companions', icon('PNG/补充/R-12_入口_蜂友.png', [18, 664, 125, 130]), [18, 664, 125, 130], layer('蜂友', { from: T09, as: 'Caption' })),
    ]),
    group('RightRail', [
      entry('supply', icon('PNG/补充/R-11_礼盒_小.png', [711, 200, 125, 135]), [711, 200, 125, 135], layer('每日补给', { from: T09, as: 'Caption' })),
      entry('event', icon('PNG/补充/R-12_入口_活动.png', [711, 352, 125, 139]), [711, 352, 125, 139], layer('花园野餐', { from: T09, as: 'Caption' })),
      entry('album', icon('PNG/补充/R-12_入口_相册.png', [711, 509, 125, 132]), [711, 509, 125, 132], layer('旅行相册', { from: T09, as: 'Caption' })),
      entry('mail', icon('PNG/补充/R-12_入口_信箱.png', [711, 664, 125, 130]), [711, 664, 125, 130], label('Caption', 'hg.map.mailbox', [716, 748, 115, 62], CAPTION)),
    ]),
    group('Paging', [
      sprite('PageNext', 'PNG/公共UI/arrow_929d91e1d9.png', [383, 330, 88, 54], { button: 'onPageNext', bind: ['pageNext', 'Node'], note: '向上翻（更高关）' }),
      sprite('PagePrev', 'PNG/公共UI/arrow_929d91e1d9.png', [383, 1395, 88, 54], { button: 'onPagePrev', bind: ['pagePrev', 'Node'], flipY: true, note: '向下翻（更低关），箭头上下翻转' }),
      label('PageRange', 'hg.map.page_range', [276, 1448, 300, 36], { ...CAPTION, size: 26 }, { bind: 'pageRangeLabel' }),
    ]),
    group('Hud', [
      group('Avatar', [layer('蜂友头像', { from: T09, as: 'Frame' }), layer('玩家等级', { from: T09, as: 'Level', bind: 'levelLabel' })], { button: 'onAvatar' }),
      group('Honey', [layer('花蜜数量底条', { from: T09, as: 'Bar' }), layer('花蜜图标', { from: T09, as: 'Icon' }), layer('花蜜数量', { from: T09, as: 'Count', bind: 'honeyLabel' })]),
      group('Hints', [layer('提示数量底条', { from: T09, as: 'Bar' }), layer('提示灯泡', { from: T09, as: 'Icon' }), layer('提示库存', { from: T09, as: 'Count', bind: 'hintLabel' })]),
      layer('设置', { from: T09, as: 'Settings', button: 'onSettings' }),
    ], { script: 'game/features/common/TopHud', align: 'top' }),
    group('Bottom', [
      group('GardenEntry', [
        layer('建设入口', { from: T09, as: 'Button' }),
        layer('建设入口文案', { from: T09, as: 'Text' }),
        layer('花园入口进度底轨', { as: 'Bar' }),
        layer('花园入口进度填充', { as: 'Fill', bind: 'gardenFill', note: '脚本按进度设置宽度' }),
        layer('花园入口阶段奖励', { as: 'Gift' }),
        layer('花园总进度', { from: T09, as: 'Progress', bind: 'gardenProgressLabel' }),
      ], { button: 'onGarden' }),
      group('EndlessEntry', [
        layer('无尽入口', { from: T09, as: 'Button' }),
        layer('无尽入口文案', { from: T09, as: 'Text' }),
        group('Locked', [
          sprite('Lock', 'PNG/公共UI/模式锁_be4f044685.png', [735, 1500, 70, 80]),
          layer('无尽解锁条件', { from: T09, as: 'Condition', bind: 'endlessConditionLabel' }),
        ], { bind: ['endlessLocked', 'Node'] }),
        group('Best', [
          layer('我的排名底板', { as: 'Bar' }),
          label('Score', 'hg.map.endless_best', [501, 1674, 264, 43], { size: 24, color: [255, 248, 222], bold: true, outline: [82, 51, 120], outlineWidth: 1 }, { bind: 'endlessBestLabel' }),
        ], { active: false, bind: ['endlessBest', 'Node'] }),
      ], { button: 'onEndless' }),
    ], { align: 'bottom' }),
  ],
};
