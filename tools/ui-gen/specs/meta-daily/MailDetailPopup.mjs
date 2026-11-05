import { layer, group } from '../../lib/dsl.mjs';
import { hud, woodTitle, back } from './_shared.mjs';

export default {
  name: 'MailDetailPopup', group: 'meta', bundle: 'meta', kind: 'popup', script: 'game/features/daily/MailDetailPopup', title: '信件详情',
  source: 'T49-01_信件详情',
  doc: {
    args: '{ mailId }', features: 'F050',
    dynamic: '标题、两段正文、署名按信件配置的 key 设置（LocalizedLabel.setKey）',
    states: '无附件；点「我知道啦」记已读并关闭',
  },
  backdrop: [layer('完整裸背景', { as: 'Background' })],
  children: [
    hud(),
    layer('原生完整主框', { as: 'Panel' }),
    group('Title', [
      layer('左标题吊绳', { as: 'RopeL' }), layer('右标题吊绳', { as: 'RopeR' }),
      layer('好友系原生标题木牌', { as: 'Board' }), layer('页面标题', { as: 'Text', bind: 'titleLabel' }),
    ]),
    layer('家园图鉴信笺', { as: 'Stationery' }),
    layer('信件正文0', { as: 'Body1', bind: 'body1Label' }),
    layer('信件正文1', { as: 'Body2', bind: 'body2Label' }),
    layer('署名', { as: 'Signature', bind: 'signatureLabel' }),
    group('BtnOk', [layer('我知道啦_原生按钮', { as: 'Bg' }), layer('我知道啦_文案', { as: 'Text' })], { button: 'onOk' }),
    back([layer('角色主体', { as: 'Bee' }), layer('角色主体_独立晴天围巾', { as: 'Scarf' })]),
  ],
};
