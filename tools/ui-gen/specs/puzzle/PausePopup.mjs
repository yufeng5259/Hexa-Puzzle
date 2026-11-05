import { layer, group } from '../../lib/dsl.mjs';

export default {
  name: 'PausePopup', bundle: 'puzzle', kind: 'popup', script: 'game/features/puzzle/PausePopup', title: '局内暂停（拼图局之上）',
  source: 'T36-01_局内暂停',
  doc: {
    args: '无', features: 'F013、F046、F047',
    dynamic: '无', states: '重新开始/保存回主界面先打开 ConfirmPopup（T38-01 / T37-01）',
  },
  backdrop: [layer('局内独立遮罩', { as: 'Dim' })],
  children: [
    layer('原生厚木边弹窗', { as: 'Panel' }),
    layer('弹窗左花叶', { as: 'LeafL' }),
    layer('弹窗右花叶', { as: 'LeafR' }),
    group('Title', [layer('原生弹窗木牌', { as: 'Board' }), layer('弹窗标题', { as: 'Text' })]),
    layer('弹窗说明', { as: 'Message' }),
    group('BtnResume', [layer('继续玩_无字按钮', { as: 'Bg' }), layer('继续玩_文案', { as: 'Text' })], { button: 'onResume' }),
    group('BtnSettings', [layer('设置_无字按钮', { as: 'Bg' }), layer('设置_文案', { as: 'Text' })], { button: 'onSettings' }),
    group('BtnRestart', [layer('重新开始_无字按钮', { as: 'Bg' }), layer('重新开始_文案', { as: 'Text' })], { button: 'onRestart' }),
    group('BtnExit', [layer('保存回主界面_无字按钮', { as: 'Bg' }), layer('保存回主界面_文案', { as: 'Text' })], { button: 'onExit' }),
  ],
};
