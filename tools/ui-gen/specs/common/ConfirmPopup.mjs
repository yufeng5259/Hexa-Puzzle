import { layer, group } from '../../lib/dsl.mjs';

const T13 = 'T13-01_无尽主动收获确认';

export default {
  name: 'ConfirmPopup', bundle: 'common', kind: 'popup', script: 'game/features/common/ConfirmPopup', title: '通用确认弹窗（退出本局 / 重新开始 / 无尽收获）',
  source: 'T37-01_退出本局确认',
  doc: { args: '{ titleKey, messageKey, confirmKey, cancelKey, value?, params? } → Promise<boolean>', sources: ['T38-01_重新开始确认', T13], features: 'F013、F034',
    dynamic: '标题、说明、两个按钮文字由参数 key 经 setKey 设置',
    states: 'ValueCard（仅无尽收获确认显示本局可收花蜜，同时隐藏 Bee）' },
  backdrop: [layer('局内独立遮罩', { as: 'Mask' })],
  children: [
    layer('原生厚木边弹窗', { as: 'Panel' }),
    layer('弹窗左花叶', { as: 'LeafL' }),
    layer('弹窗右花叶', { as: 'LeafR' }),
    layer('原生弹窗木牌', { as: 'Plank' }),
    layer('弹窗标题', { as: 'Title', bind: 'titleLabel' }),
    layer('弹窗说明', { as: 'Message', bind: 'messageLabel' }),
    layer('弹窗陪伴蜜蜂', { as: 'Bee', bind: ['bee', 'Node'] }),
    group('ValueCard', [
      layer('原生奖励卡', { from: T13, as: 'Card' }),
      layer('实际收益图标', { from: T13, as: 'Icon' }),
      layer('弹窗实际数值', { from: T13, as: 'Value', bind: 'valueLabel' }),
      layer('弹窗数值说明', { from: T13, as: 'Caption', bind: 'valueCaptionLabel' }),
    ], { active: false, bind: ['valueCard', 'Node'] }),
    group('BtnConfirm', [layer('保存并返回_无字按钮', { as: 'Bg' }), layer('保存并返回_文案', { as: 'Text', bind: 'confirmLabel' })], { button: 'onConfirm' }),
    group('BtnCancel', [layer('继续这一局_无字按钮', { as: 'Bg' }), layer('继续这一局_文案', { as: 'Text', bind: 'cancelLabel' })], { button: 'onCancel' }),
  ],
};
