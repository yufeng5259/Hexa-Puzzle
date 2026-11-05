import { layer, group } from '../../lib/dsl.mjs';

export default {
  name: 'HintEmptyPopup', bundle: 'puzzle', kind: 'popup', script: 'game/features/puzzle/HintEmptyPopup', title: '提示不足（拼图局之上）',
  source: 'T41-01_提示不足',
  doc: {
    args: '{ adAvailable: boolean, freeAvailable: boolean }', features: 'F016、F053、F057',
    dynamic: '当前提示库存', states: 'BtnHintAd：无广告额度时隐藏；BtnFree：今日免费已领时隐藏',
  },
  backdrop: [layer('局内独立遮罩', { as: 'Dim' })],
  children: [
    layer('原生厚木边弹窗', { as: 'Panel' }),
    layer('弹窗左花叶', { as: 'LeafL' }),
    layer('弹窗右花叶', { as: 'LeafR' }),
    group('Title', [layer('原生弹窗木牌', { as: 'Board' }), layer('弹窗标题', { as: 'Text' })]),
    layer('弹窗说明', { as: 'Message' }),
    group('Card', [layer('原生奖励卡', { as: 'Bg' }), layer('实际收益图标', { as: 'Icon' }), layer('弹窗实际数值', { as: 'Value', bind: 'stockLabel' }), layer('弹窗数值说明', { as: 'Caption' })]),
    group('BtnResume', [layer('继续自己拼_无字按钮', { as: 'Bg' }), layer('继续自己拼_文案', { as: 'Text' })], { button: 'onResume' }),
    group('BtnHintAd', [layer('视频 +1 提示_无字按钮', { as: 'Bg' }), layer('视频 +1 提示_文案', { as: 'Text' })], { button: 'onHintAd', bind: ['adButton', 'Node'] }),
    group('BtnFree', [layer('每日免费 +1_无字按钮', { as: 'Bg' }), layer('每日免费 +1_文案', { as: 'Text' })], { button: 'onFreeHint', bind: ['freeButton', 'Node'] }),
  ],
};
