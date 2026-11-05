import { group, layer } from '../../lib/dsl.mjs';
import { backRow, hud, woodTitle } from './_shared.mjs';

const NODE = 'game/features/collection/AffinityNode';
const ICONS = ['style_hand', 'book', 'gift'];

/** Milestone card i (亲密 5 / 15 / 30). Check and lock exist on every card; the art shows one or the other. */
function milestone(i) {
  const x = 112 + 215 * i;
  return group(`Milestone${i}`, [
    layer(`成长节点原生卡${i}`, { as: 'Card' }),
    layer(ICONS[i], { as: 'Icon' }),
    layer(`节点${i}`, { as: 'Name' }),
    layer('check', { as: 'Done', rect: [x + 146, 1127, 52, 46], active: i === 0, bind: ['doneNode', 'Node'] }),
    layer('节点锁1', { as: 'Lock', rect: [x + 154, 1132, 42, 48], active: i > 0, bind: ['lockNode', 'Node'] }),
    layer(`节点条件${i}`, { as: 'Condition', bind: 'conditionLabel' }),
  ], { script: NODE, bindArray: 'milestones', button: 'onSelect', note: ['亲密5 招手', '亲密15 故事 → StoryPopup', '亲密30 装饰 → CompanionDecorPopup'][i] });
}

export default {
  name: 'CompanionDetailPage', group: 'meta', bundle: 'meta', kind: 'page', script: 'game/features/collection/CompanionDetailPage',
  title: '蜂友成长（亲密度与 5/15/30 里程碑）',
  source: 'T21-01_蜂友成长',
  doc: {
    args: '{ beeId }', features: 'F036、F037、F038、F035（跟随）',
    dynamic: '立绘按蜂友换图；亲密 x/30 与进度条；3 个 AffinityNode（固定）',
    states: 'AffinityNode.Done / Lock；BtnFollow 文案「正在跟随」/「设为跟随」',
    fx: '—',
  },
  children: [
    layer('完整裸背景', { as: 'Background' }),
    hud(),
    woodTitle(),
    layer('原生完整主框', { as: 'Panel' }),
    layer('页面副标题', { as: 'Subtitle', bind: 'subtitleLabel' }),
    layer('角色主体', { as: 'Portrait', bind: 'portrait' }),
    layer('蜂友名', { as: 'Name', bind: 'nameLabel' }),
    group('Affinity', [
      layer('亲密度', { as: 'Value', bind: 'affinityLabel' }),
      layer('进度空轨', { as: 'Track' }),
      layer('进度填充', { as: 'Fill', bind: 'affinityFill' }),
    ]),
    milestone(0), milestone(1), milestone(2),
    group('BtnFollow', [layer('正在跟随_原生按钮', { as: 'Bg' }), layer('正在跟随_文案', { as: 'Text', bind: 'followLabel' })], { button: 'onFollow' }),
    group('BtnTasks', [layer('去做任务_原生按钮', { as: 'Bg' }), layer('去做任务_文案', { as: 'Text' })], { button: 'onTasks' }),
    backRow(),
  ],
};
