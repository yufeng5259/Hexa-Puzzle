import { layer, group } from '../../lib/dsl.mjs';

export default {
  name: 'ChallengeFailPopup', bundle: 'puzzle', kind: 'popup', script: 'game/features/puzzle/ChallengeFailPopup', title: '限步失败救局（拼图局之上）',
  source: 'T08-01_限步失败救局',
  doc: {
    args: '{ level: number, remainingPieces: number, adSteps: number, adAvailable: boolean }', features: 'F011、F054',
    dynamic: '待完成块数；视频续步数（参数 {count}）', states: 'BtnContinueAd：无广告额度时隐藏',
  },
  backdrop: [layer('局内独立遮罩', { as: 'Dim' })],
  children: [
    layer('原生厚木边弹窗', { as: 'Panel' }),
    layer('弹窗左花叶', { as: 'LeafL' }),
    layer('弹窗右花叶', { as: 'LeafR' }),
    group('Title', [layer('原生弹窗木牌', { as: 'Board' }), layer('弹窗标题', { as: 'Text' })]),
    layer('弹窗说明', { as: 'Message' }),
    group('Card', [layer('原生奖励卡', { as: 'Bg' }), layer('剩余拼块图标', { as: 'Icon' }), layer('弹窗实际数值', { as: 'Value', bind: 'remainLabel' }), layer('弹窗数值说明', { as: 'Caption' })]),
    group('BtnRetry', [layer('免费重试_无字按钮', { as: 'Bg' }), layer('免费重试_文案', { as: 'Text' })], { button: 'onRetry' }),
    group('BtnContinueAd', [layer('视频 · 继续 +3 步_无字按钮', { as: 'Bg' }), layer('视频 · 继续 +3 步_文案', { as: 'Text', bind: 'adLabel' })], { button: 'onContinueAd', bind: ['adButton', 'Node'] }),
    group('BtnMap', [layer('返回地图_无字按钮', { as: 'Bg' }), layer('返回地图_文案', { as: 'Text' })], { button: 'onMap' }),
  ],
};
