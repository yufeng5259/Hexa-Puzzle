import { layer, group, sprite } from '../../lib/dsl.mjs';
import { hud, woodTitle, back } from './_shared.mjs';

const NODE = 'game/features/daily/MilestoneNode';

/** Four picnic milestones (5/10/15/20 points). Only the first carries a check in the art. */
export const milestones = () => group('Milestones', [0, 1, 2, 3].map(i => {
  const n = group(`Milestone${i + 1}`, [
    layer(`野餐节点底${i}`, { as: 'Base' }),
    layer(`活动节点${i}`, { as: 'Value', bind: 'valueLabel' }),
  ], { script: NODE, bindArray: 'milestones' });
  return n;
}));

/** Adds the check to each milestone group: art layer for the first, hidden copy for the others. */
export const withChecks = (ms, baseY) => {
  ms.children.forEach((g, i) => g.children.push(i === 0
    ? layer('check', { as: 'Check', bind: ['check', 'Node'] })
    : sprite('Check', 'PNG/公共UI/完成勾_4503fe8356.png', [221 + 139 * i, baseY + 70, 44, 38], { active: false, bind: ['check', 'Node'] })));
  return ms;
};

export const progress = () => [
  layer('准备标题', { as: 'ProgressTitle' }),
  layer('实际准备进度', { as: 'Progress', bind: 'progressLabel' }),
  group('Bar', [layer('进度空轨', { as: 'Track' }), layer('进度填充', { as: 'Fill', bind: 'progressFill', fill: true })]),
];

export default {
  name: 'EventPage', group: 'meta', bundle: 'meta', kind: 'page', script: 'game/features/daily/EventPage', title: '主题活动总览（花园野餐）',
  source: 'T33-01_主题活动总览',
  doc: {
    args: '无', features: 'F045',
    dynamic: '活动进度文字参数、进度条填充、4 个 MilestoneNode（数值、完成勾）',
    states: 'MilestoneNode.check：已达成显示',
  },
  children: [
    layer('完整裸背景', { as: 'Background' }),
    hud(),
    layer('原生完整主框', { as: 'Panel' }),
    woodTitle(),
    layer('页面副标题', { as: 'Subtitle' }),
    layer('picnic', { as: 'Picnic' }),
    layer('bee_huahua', { as: 'Bee' }),
    ...progress(),
    withChecks(milestones(), 1202),
    layer('活动奖励说明', { as: 'RewardNote' }),
    group('BtnDetail', [layer('去看看_原生按钮', { as: 'Bg' }), layer('去看看_文案', { as: 'Text' })], { button: 'onDetail' }),
    back(),
  ],
};
