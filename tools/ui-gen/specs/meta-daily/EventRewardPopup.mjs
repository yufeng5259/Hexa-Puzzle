import { layer, group } from '../../lib/dsl.mjs';
import { hud, back } from './_shared.mjs';

export default {
  name: 'EventRewardPopup', group: 'meta', bundle: 'meta', kind: 'popup', script: 'game/features/daily/EventRewardPopup', title: '花园野餐活动奖励',
  source: 'T35-01_活动奖励',
  doc: {
    args: '{ honey }', features: 'F045',
    dynamic: '奖励花蜜数',
    fx: 'FX-02（奖励光效）、FX-03',
  },
  backdrop: [layer('完整裸背景', { as: 'Background' })],
  children: [
    hud(),
    layer('野餐奖励原生结算框', { as: 'Panel' }),
    group('Title', [layer('左花叶', { as: 'LeafL' }), layer('右花叶', { as: 'LeafR' }), layer('结算原生红飘带', { as: 'Ribbon' }), layer('页面标题', { as: 'Text' })]),
    layer('picnic', { as: 'Picnic' }),
    group('Reward', [layer('原生野餐礼卡', { as: 'Card' }), layer('honey', { as: 'Icon' }), layer('野餐花蜜', { as: 'Amount', bind: 'rewardLabel' })]),
    layer('只领一次', { as: 'Note', bind: 'noteLabel' }),
    group('BtnClaim', [layer('收下野餐礼_原生按钮', { as: 'Bg' }), layer('收下野餐礼_文案', { as: 'Text' })], { button: 'onClaim' }),
    back([layer('原生奖励欢呼蜂', { as: 'CheerBee' })]),
  ],
};
