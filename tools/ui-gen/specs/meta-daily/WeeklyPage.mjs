import { layer, group, label, sprite } from '../../lib/dsl.mjs';
import { hud, ribbonTitle, back, btn } from './_shared.mjs';

/** Seven active-day marks: base, check (claimed day) and day number. Days 0–3 carry a check, 4–6 a number in the art. */
const day = i => {
  const x = 118 + 88 * i;
  return group(`Day${i + 1}`, [
    layer(`本周活跃日底${i}`, { as: 'Base' }),
    i < 4
      ? layer('check', { index: i, as: 'Check', bindArray: 'dayChecks' })
      : sprite('Check', 'PNG/公共UI/完成勾_4503fe8356.png', [x + 13, 790, 51, 45], { active: false, bindArray: 'dayChecks' }),
    i >= 4
      ? layer(`周日${i}`, { as: 'Num', bindArray: 'dayLabels' })
      : label('Num', null, [x + 6, 787, 65, 52], { size: 27, bold: true, color: [101, 61, 32] }, { text: String(i + 1), active: false, bindArray: 'dayLabels' }),
  ]);
};

export default {
  name: 'WeeklyPage', group: 'meta', bundle: 'meta', kind: 'page', script: 'game/features/daily/WeeklyPage', title: '每周目标：活跃日、局数进度与周礼',
  source: 'T30-01_每周目标',
  doc: {
    args: '无', features: 'F042',
    dynamic: '7 个活跃日（dayChecks/dayLabels 按序号）、本周进度文字参数、进度条填充宽度、周礼花蜜',
    states: '每天 Check（已活跃）与 Num（未活跃）互斥；BtnClaim 未达成时置灰、已领取时隐藏并显示 Claimed',
    fx: 'FX-03、FX-02（纪念印记）',
  },
  children: [
    layer('完整裸背景', { as: 'Background' }),
    hud(),
    layer('原生完整主框', { as: 'Panel' }),
    ribbonTitle(),
    layer('页面副标题', { as: 'Subtitle' }),
    layer('本周日历', { as: 'Calendar' }),
    group('Days', [0, 1, 2, 3, 4, 5, 6].map(day)),
    layer('本周进度', { as: 'Progress', bind: 'progressLabel' }),
    group('Bar', [layer('进度空轨', { as: 'Track' }), layer('进度填充', { as: 'Fill', bind: 'progressFill', fill: true })]),
    group('Reward', [
      layer('每周奖励原生行', { as: 'Bg' }), layer('honey', { as: 'HoneyIcon' }), layer('本周花蜜', { as: 'Honey', bind: 'rewardLabel' }),
      layer('stamp', { as: 'Stamp', bind: ['stamp', 'Node'] }), layer('印记奖励', { as: 'StampText' }),
    ]),
    btn('BtnClaim', '收下周礼_原生按钮', '收下周礼_文案', 'onClaim', { bind: ['claimButton', 'Node'] }),
    sprite('Claimed', 'PNG/公共UI/已领取按钮_c0fa067b27.png', [185, 1375, 483, 128], { active: false, bind: ['claimedMark', 'Node'] }),
    back([layer('原每日奖励抱罐蜂', { as: 'Bee' })]),
  ],
};
