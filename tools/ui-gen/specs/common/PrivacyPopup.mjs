import { layer, group, sprite } from '../../lib/dsl.mjs';
import { hudA } from './_hud.mjs';

export default {
  name: 'PrivacyPopup', bundle: 'common', kind: 'popup', script: 'game/features/common/PrivacyPopup', title: '隐私与本机数据说明',
  source: 'T50-01_隐私与数据说明',
  doc: { args: '无', features: 'F051', dynamic: '无（静态说明文案）' },
  backdrop: [layer('完整裸背景', { as: 'Background' })],
  children: [
    hudA(),
    layer('原生完整主框', { as: 'Panel' }),
    layer('左标题吊绳', { as: 'RopeL' }),
    layer('右标题吊绳', { as: 'RopeR' }),
    layer('好友系原生标题木牌', { as: 'Plank' }),
    layer('页面标题', { as: 'Title' }),
    layer('页面副标题', { as: 'Subtitle' }),
    sprite('Shield', 'PNG/补充/R-13_图标_隐私.png', [354, 504, 145, 145], { note: '原稿占位为齿轮，按 R-13 换隐私图标' }),
    ...[0, 1, 2].map(i => group(`Section${i}`, [layer(`隐私分段标题${i}`, { as: 'Head' }), layer(`隐私正文${i}`, { as: 'Body' })])),
    group('BtnReturn', [layer('返回设置_原生按钮', { as: 'Bg' }), layer('返回设置_文案', { as: 'Text' })], { button: 'onBack' }),
    layer('返回上一页', { as: 'BtnBack', button: 'onBack', align: 'bottom' }),
  ],
};
