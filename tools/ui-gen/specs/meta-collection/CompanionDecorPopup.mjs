import { group, layer } from '../../lib/dsl.mjs';
import { backRow, hud, woodTitle } from './_shared.mjs';

export default {
  name: 'CompanionDecorPopup', group: 'meta', bundle: 'meta', kind: 'popup', script: 'game/features/collection/CompanionDecorPopup',
  title: '蜂友专属装饰（亲密 30）',
  source: 'T22-01_蜂友专属装饰',
  doc: {
    args: '{ beeId }', features: 'F038',
    dynamic: '标题/说明按蜂友换 key；未佩戴/已佩戴两张立绘与饰物图按蜂友换图（R-16 专属饰物）',
    states: 'BtnToggle 文案「取下」/「佩戴」；佩戴状态标签随之切换',
    fx: '—',
  },
  backdrop: [layer('完整裸背景', { as: 'Background' })],
  children: [
    hud(),
    woodTitle('titleLabel'),
    layer('原生完整主框', { as: 'Panel' }),
    layer('页面副标题', { as: 'Subtitle', bind: 'subtitleLabel' }),
    group('Before', [layer('花花_未佩戴', { as: 'Portrait', bind: 'portraitBefore' }), layer('饰物状态托板0', { as: 'Plate' }), layer('佩戴状态0', { as: 'State' })]),
    layer('arrow', { as: 'Arrow' }),
    group('After', [
      layer('花花_已佩戴', { as: 'Portrait', bind: 'portraitAfter' }),
      layer('花花独立专属胸花', { as: 'Decor', bind: 'decor' }),
      layer('饰物状态托板1', { as: 'Plate' }),
      layer('佩戴状态1', { as: 'State', bind: 'wornLabel' }),
    ]),
    layer('饰物说明', { as: 'Desc', bind: 'descLabel' }),
    group('BtnToggle', [layer('取下_原生按钮', { as: 'Bg' }), layer('取下_文案', { as: 'Text', bind: 'toggleLabel' })], { button: 'onToggleWear' }),
    group('BtnDetail', [layer('回蜂友成长_原生按钮', { as: 'Bg' }), layer('回蜂友成长_文案', { as: 'Text' })], { button: 'onBack', note: '回蜂友成长 = 关闭' }),
    backRow(),
  ],
};
