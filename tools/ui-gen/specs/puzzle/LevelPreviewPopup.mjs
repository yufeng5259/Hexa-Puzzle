import { layer, group, slot } from '../../lib/dsl.mjs';
import { board } from '../_board.mjs';

// T01-01 normal; T04-01 challenge differs only in label keys (props) and values.
export default {
  name: 'LevelPreviewPopup', bundle: 'puzzle', kind: 'popup', script: 'game/features/puzzle/LevelPreviewPopup', title: '开局预览（普通 / 限步共用）',
  source: 'T01-01_普通拼图开局',
  doc: {
    args: '{ level: number }', sources: ['T04-01_限步关开局'], features: 'F009、F021',
    dynamic: 'BoardRoot/TrayRoot 用与拼图局相同的 BoardView 只读预览；剩余数（拼块数或步数）、目标格数、提示库存、本次可得花蜜',
    states: 'Remain 标题与 Reward 文案按普通/限步、首通/复玩切换 key（props）',
  },
  props: {
    remainKeyPieces: 'block.fb14446e7454.text.55a87ff8eb1b',
    remainKeyMoves: 'block.92709cf7dc5a.text.55a87ff8eb1b',
    rewardKeyFirst: 'block.92709cf7dc5a.text.594272093dde',
    rewardKeyReplay: 'block.fb14446e7454.text.594272093dde',
  },
  backdrop: [layer('完整裸背景', { as: 'Background' })],
  children: [
    board([78, 518, 697, 644], '只读棋盘预览'),
    group('Top', [
      group('Hud', [
        group('Avatar', [layer('原生头像', { as: 'Frame' }), layer('头像进度等级', { as: 'Level', bind: 'levelLabel' })], { button: 'onAvatar' }),
        group('Hints', [layer('透明计数底条', { index: 0, as: 'Bar' }), layer('提示库存图标', { as: 'Icon' }), layer('提示库存值', { as: 'Count', bind: 'hintLabel' }), layer('提示库存标签', { as: 'Caption' })]),
        group('Honey', [layer('透明计数底条', { index: 1, as: 'Bar' }), layer('蜂蜜货币', { as: 'Icon' }), layer('花蜜余额', { as: 'Count', bind: 'honeyLabel' })]),
        layer('设置木质齿轮', { as: 'Settings', button: 'onSettings' }),
      ], { script: 'game/features/common/TopHud' }),
      group('Sign', [layer('原生花叶木牌', { as: 'Board' }), layer('页面标题', { as: 'Title', bind: 'titleLabel' })]),
      group('Stats', [
        layer('统计编绳263', { as: 'RopeL' }),
        layer('统计编绳566', { as: 'RopeR' }),
        group('Remain', [layer('步数空底板', { as: 'Panel' }), layer('剩余标签', { as: 'Title', bind: 'remainTitleLabel' }), layer('剩余数量', { as: 'Value', bind: 'remainLabel' })]),
        group('Target', [layer('目标空底板', { as: 'Panel' }), layer('目标蜂蜜', { as: 'Icon' }), layer('轮廓填充进度', { as: 'Value', bind: 'targetLabel' })]),
        group('HintStock', [layer('提示空底板', { as: 'Panel' }), layer('提示灯泡', { as: 'Icon' }), layer('提示增加按钮', { as: 'Add' }), layer('本关提示库存', { as: 'Value', bind: 'hintStockLabel' })]),
      ]),
    ], { align: 'top' }),
    group('Bottom', [
      layer('完整托盘_无字木托盘', { as: 'Tray' }),
      slot('TrayRoot', [17, 1251, 820, 314], { bind: ['trayRoot', 'Node'], note: '只读托盘预览' }),
      layer('原生花叶木平台', { as: 'Platform' }),
      layer('收益说明', { as: 'Reward', bind: 'rewardLabel' }),
      group('BtnStart', [layer('免费开始_无字按钮', { as: 'Bg' }), layer('免费开始_文案', { as: 'Text' })], { button: 'onStart' }),
      layer('返回地图', { as: 'BtnBack', button: 'onBack' }),
    ], { align: 'bottom' }),
  ],
};
