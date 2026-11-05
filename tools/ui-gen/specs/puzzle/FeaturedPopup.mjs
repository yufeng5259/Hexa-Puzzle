import { layer, group, slot } from '../../lib/dsl.mjs';

// Rows: [row layer, preview rect (shadow/rim layers), level text layer, reward text layer, index of repeated layers]
const ROWS = [
  ['精选原生行0', [156, 562, 101, 103], '精选关号0', '复玩奖励0', 0],
  ['精选原生行1', [130, 795, 153, 96], '精选关号1', '复玩奖励1', 1],
  ['精选原生行2', [146, 1022, 121, 103], '精选关号2', '复玩奖励2', 2],
];
const row = ([bg, preview, level, reward, i]) => group(`Entry${i + 1}`, [
  layer(bg, { as: 'Bg' }),
  slot('PreviewRoot', preview, { bind: ['previewRoot', 'Node'], note: '题目缩略（程序生成）' }),
  layer(level, { as: 'Level', bind: 'levelLabel' }),
  layer('honey', { index: i, as: 'HoneyIcon' }),
  layer(reward, { as: 'Reward', bind: 'rewardLabel' }),
  group('BtnPlay', [layer('再拼一次_原生按钮', { index: i, as: 'Bg' }), layer('再拼一次_文案', { index: i, as: 'Text' })], { button: 'onPlay' }),
], { script: 'game/features/puzzle/FeaturedEntry', bindArray: 'entries' });

export default {
  name: 'FeaturedPopup', bundle: 'puzzle', kind: 'popup', script: 'game/features/puzzle/FeaturedPopup', title: '每日精选复玩（3 题）',
  source: 'T10-01_每日精选复玩',
  doc: {
    args: '无（按 dayKey 选出 3 个已通关普通关）', features: 'F021',
    dynamic: '3 个 FeaturedEntry 固定槽：关号、复玩奖励、题目缩略；今日复玩花蜜次数', states: '已通关不足 3 题时多余条目隐藏',
  },
  backdrop: [layer('完整裸背景', { as: 'Background' })],
  children: [
    group('Hud', [
      group('Avatar', [layer('蜂友头像', { as: 'Frame' }), layer('玩家主线进度', { as: 'Level', bind: 'levelLabel' })], { button: 'onAvatar' }),
      group('Honey', [layer('花蜜数量底条', { as: 'Bar' }), layer('花蜜图标', { as: 'Icon' }), layer('花蜜数量', { as: 'Count', bind: 'honeyLabel' })]),
      group('Hints', [layer('提示数量底条', { as: 'Bar' }), layer('提示灯泡', { as: 'Icon' }), layer('提示库存', { as: 'Count', bind: 'hintLabel' })]),
      layer('设置', { as: 'Settings', button: 'onSettings' }),
    ], { script: 'game/features/common/TopHud', align: 'top' }),
    layer('原生完整主框', { as: 'Panel' }),
    group('Title', [layer('左标题吊绳', { as: 'RopeL' }), layer('右标题吊绳', { as: 'RopeR' }), layer('好友系原生标题木牌', { as: 'Board' }), layer('页面标题', { as: 'Text' })]),
    layer('页面副标题', { as: 'Quota', bind: 'quotaLabel' }),
    group('Entries', ROWS.map(row)),
    layer('次数说明', { as: 'Note' }),
    group('BtnContinue', [layer('继续主线_原生按钮', { as: 'Bg' }), layer('继续主线_文案', { as: 'Text' })], { button: 'onContinue' }),
    group('Bottom', [layer('好友页底部蜜蜂', { as: 'Bee' }), layer('返回上一页', { as: 'BtnBack', button: 'onBack' })], { align: 'bottom' }),
  ],
};
