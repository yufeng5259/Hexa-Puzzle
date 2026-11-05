import { layer, group } from '../../lib/dsl.mjs';
import hud from './_hud.cjs';

export default {
  name: 'JourneyCompletePopup', bundle: 'garden', kind: 'popup', script: 'game/features/garden/JourneyCompletePopup', title: '当前内容完成：三园全部建成后的回流入口',
  source: 'T18-01_当前内容完成',
  doc: { args: '无', features: 'F028', dynamic: '无（三园纪念照为静态图）', fx: 'FX-01' },
  backdrop: [layer('完整裸背景', { as: 'Background' })],
  children: [
    hud.standardHud('当前主线等级'),
    group('Title', [
      layer('原好友左悬绳', { as: 'RopeL' }), layer('原好友右悬绳', { as: 'RopeR' }), layer('原好友无字标题木牌', { as: 'Sign' }),
      layer('页面标题', { as: 'Text' }),
    ]),
    layer('无字面板_wood', { as: 'Panel' }),
    layer('三园完工说明', { as: 'Desc' }),
    group('Memories', [
      group('Sunny', [layer('向阳花园完成纪念', { as: 'Photo' }), layer('向阳花园纪念标题', { as: 'Name' })]),
      group('Water', [layer('清风水湾完成纪念', { as: 'Photo' }), layer('清风水湾纪念标题', { as: 'Name' })]),
      group('Cloud', [layer('云上蜂谷完成纪念', { as: 'Photo' }), layer('云上蜂谷纪念标题', { as: 'Name' })]),
    ]),
    layer('完成后回流说明', { as: 'Next' }),
    group('BtnFeatured', [layer('每日精选_无字按钮', { as: 'Bg' }), layer('每日精选_文案', { as: 'Text' })], { button: 'onFeatured' }),
    group('BtnEndless', [layer('挑战无尽纪录_无字按钮', { as: 'Bg' }), layer('挑战无尽纪录_文案', { as: 'Text' })], { button: 'onEndless' }),
    group('BtnAlbum', [layer('旅行相册_无字按钮', { as: 'Bg' }), layer('旅行相册_文案', { as: 'Text' })], { button: 'onAlbum' }),
    group('Bottom', [layer('返回', { as: 'BtnBack', button: 'onBack' })], { align: 'bottom' }),
  ],
};
