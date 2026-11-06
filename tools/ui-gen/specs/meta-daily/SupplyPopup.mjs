import { layer, group, sprite } from '../../lib/dsl.mjs';
import { hud, ribbonTitle, back } from './_shared.mjs';

export default {
  name: 'SupplyPopup', group: 'meta', bundle: 'meta', kind: 'popup', script: 'game/features/daily/SupplyPopup', title: '每日补给：免费提示与视频花蜜',
  source: 'T47-01_每日补给',
  doc: {
    args: '无', features: 'F057、F052',
    dynamic: '视频补给剩余次数（补给条件1 参数）',
    states: 'FreeClaimed：今日免费提示已领（覆盖免费按钮）；BtnVideo 无额度或冷却中置灰，冷却时打开 AdStatusPopup',
    fx: 'FX-03',
  },
  backdrop: [layer('完整裸背景', { as: 'Background' })],
  children: [
    hud(),
    layer('原生完整主框', { as: 'Panel' }),
    ribbonTitle(),
    layer('页面副标题', { as: 'Subtitle' }),
    layer('角色主体', { as: 'Bee' }),
    layer('广告限制', { as: 'AdLimit', bind: 'adLimitLabel' }),
    group('FreeRow', [layer('补给原生奖励行0', { as: 'Bg' }), layer('bulb', { as: 'Icon' }), layer('补给项0', { as: 'Name' }),
      layer('补给数0', { as: 'Amount' }), layer('补给条件0', { as: 'Condition' })]),
    group('VideoRow', [layer('补给原生奖励行1', { as: 'Bg' }), layer('honey', { as: 'Icon' }), layer('补给项1', { as: 'Name' }),
      layer('补给数1', { as: 'Amount', bind: 'videoAmountLabel' }), layer('补给条件1', { as: 'Condition', bind: 'videoConditionLabel' })]),
    layer('自愿视频说明', { as: 'VoluntaryNote' }),
    group('BtnFree', [layer('免费领取1提示_原生按钮', { as: 'Bg' }), layer('免费领取1提示_文案', { as: 'Text', bind: 'freeLabel' })], { button: 'onFreeHint', bind: ['freeButton', 'Node'] }),
    sprite('FreeClaimed', 'PNG/公共UI/已领取按钮_c0fa067b27.png', [185, 1330, 483, 128], { active: false, bind: ['freeClaimed', 'Node'] }),
    group('BtnVideo', [layer('视频 +60花蜜_原生按钮', { as: 'Bg' }), layer('视频 +60花蜜_文案', { as: 'Text', bind: 'videoButtonLabel' })],
      { button: 'onVideo', bind: ['videoButton', 'Node'], align: 'bottom' }),
    back(),
  ],
};
