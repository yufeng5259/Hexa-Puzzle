import { layer, group } from '../../lib/dsl.mjs';
import { hud, woodTitle, back } from './_shared.mjs';
import { milestones, withChecks, progress } from './EventPage.mjs';

export default {
  name: 'EventDetailPage', group: 'meta', bundle: 'meta', kind: 'page', script: 'game/features/daily/EventDetailPage', title: '花园野餐进度',
  source: 'T34-01_花园野餐进度',
  doc: {
    args: '无', features: 'F045',
    dynamic: '活动进度文字参数、进度条填充、4 个 MilestoneNode（数值、完成勾）',
    states: 'MilestoneNode.check：已达成显示；满 20 点且未领时自动打开 EventRewardPopup',
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
    withChecks(milestones(), 1120),
    layer('活动进度规则', { as: 'Rule', bind: 'ruleLabel' }),
    layer('活动奖励说明', { as: 'RewardNote', bind: 'rewardNoteLabel' }),
    group('BtnPlay', [layer('继续闯关_原生按钮', { as: 'Bg' }), layer('继续闯关_文案', { as: 'Text' })], { button: 'onPlay' }),
    back(),
  ],
};
