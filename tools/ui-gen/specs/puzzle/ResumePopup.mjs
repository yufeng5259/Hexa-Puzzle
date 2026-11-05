import { layer, group, slot } from '../../lib/dsl.mjs';

export default {
  name: 'ResumePopup', bundle: 'puzzle', kind: 'popup', script: 'game/features/puzzle/ResumePopup', title: '未完成拼图续玩卡（地图之上）',
  source: 'T09-01_未完成拼图续玩',
  doc: {
    args: '{ level: number, placed: number, total: number }', features: 'F013',
    dynamic: '原局布局快照（BoardView 缩略，SnapshotRoot）；已放块数', states: '重新开始先打开 ConfirmPopup（T38-01）；Backdrop 透明，仅拦截点击',
  },
  backdrop: [],
  children: [
    group('Card', [
      layer('续玩原生木边面板', { as: 'Panel' }),
      layer('续玩悬挂木牌', { as: 'Board' }),
      layer('原局卡标题', { as: 'Title', bind: 'titleLabel' }),
      slot('SnapshotRoot', [211, 515, 166, 157], { bind: ['snapshotRoot', 'Node'], note: '原局棋盘缩略（程序生成）' }),
      layer('原局进度', { as: 'Progress', bind: 'progressLabel' }),
      group('BtnResume', [layer('继续拼图_无字按钮', { as: 'Bg' }), layer('继续拼图_文案', { as: 'Text' })], { button: 'onResume' }),
      layer('原局重开', { as: 'BtnRestart', button: 'onRestart' }),
    ]),
  ],
};
