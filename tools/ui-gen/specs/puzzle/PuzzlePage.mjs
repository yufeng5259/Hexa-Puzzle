import { layer, group, slot, sprite } from '../../lib/dsl.mjs';
import { board } from '../_board.mjs';

// T02-01 is the normal 3-piece state; challenge (T05-01) only changes the remaining label key and value.
const T03 = 'T03-01_拼图提示轮廓';

const tool = (name, layers, handler, opts = {}) => group(name, layers, { button: handler, ...opts });

export default {
  name: 'PuzzlePage', bundle: 'puzzle', kind: 'page', script: 'game/features/puzzle/PuzzlePage', title: '拼图局（普通 / 限步共用）',
  source: 'T02-01_普通异形拼图_三块',
  doc: {
    args: '{ level: number, resume?: boolean }', sources: ['T02-02_普通异形拼图_六块托盘', T03, 'T05-01_限步异形拼图_局内', 'T05-02_限步拼图_七块托盘规格'],
    features: 'F010、F011、F012、F013、F016、F046',
    dynamic: 'BoardRoot 内由 BoardView 按题目生成木框（Graphics 一次）与 BoardCell（对象池）；TrayRoot 内按 3/6/7 块布局 PieceCell（对象池）；剩余数、目标进度、提示库存随局刷新',
    states: 'Remain 标题：普通「剩余拼块」/限步「剩余步数」（props 中两个 key）；HintUsed 使用提示后短暂显示；返回键与 Pause 按钮打开 PausePopup',
    fx: 'FX-09、FX-10',
  },
  props: {
    remainKeyPieces: 'block.5d8513851521.text.55a87ff8eb1b',
    remainKeyMoves: 'block.4cfc10f27941.text.55a87ff8eb1b',
  },
  children: [
    layer('完整裸背景', { as: 'Background' }),
    board([78, 518, 697, 644], '棋盘：木纹底与木边程序绘制一次 + BoardCell/PieceCell 池'),
    layer('提示使用前后', { from: T03, as: 'HintUsed', active: false, bind: 'hintUsedLabel' }),
    group('Top', [
      group('Hud', [
        group('Avatar', [layer('原生头像', { as: 'Frame' }), layer('头像进度等级', { as: 'Level', bind: 'levelLabel' })], { button: 'onAvatar' }),
        group('Hints', [layer('透明计数底条', { index: 0, as: 'Bar' }), layer('提示库存图标', { as: 'Icon' }), layer('提示库存值', { as: 'Count', bind: 'hintLabel' }), layer('提示库存标签', { as: 'Caption' })]),
        group('Honey', [layer('透明计数底条', { index: 1, as: 'Bar' }), layer('蜂蜜货币', { as: 'Icon' }), layer('花蜜余额', { as: 'Count', bind: 'honeyLabel' })]),
        layer('设置木质齿轮', { as: 'Settings', button: 'onSettings' }),
      ], { script: 'game/features/common/TopHud' }),
      sprite('Pause', 'PNG/补充/R-13_图标_暂停.png', [40, 180, 100, 100], { button: 'onPause', note: '设计稿无暂停按钮，用 R-13 补充图标' }),
      group('Sign', [layer('原生花叶木牌', { as: 'Board' }), layer('页面标题', { as: 'Title', bind: 'titleLabel' })]),
      group('Stats', [
        layer('统计编绳263', { as: 'RopeL' }),
        layer('统计编绳566', { as: 'RopeR' }),
        group('Remain', [layer('步数空底板', { as: 'Panel' }), layer('剩余标签', { as: 'Title', bind: 'remainTitleLabel' }), layer('剩余数量', { as: 'Value', bind: 'remainLabel' })]),
        group('Target', [layer('目标空底板', { as: 'Panel' }), layer('目标蜂蜜', { as: 'Icon' }), layer('轮廓填充进度', { as: 'Value', bind: 'targetLabel' })]),
        group('HintStock', [layer('提示空底板', { as: 'Panel' }), layer('提示灯泡', { as: 'Icon' }), layer('提示增加按钮', { as: 'Add' }), layer('本关提示库存', { as: 'Value', bind: 'hintStockLabel' })], { button: 'onHintAdd' }),
      ]),
    ], { align: 'top' }),
    group('Bottom', [
      layer('完整托盘_无字木托盘', { as: 'Tray' }),
      slot('TrayRoot', [17, 1251, 820, 314], { bind: ['trayRoot', 'Node'], note: '托盘：3/6/7 块，PieceCell 池' }),
      layer('原生花叶木平台', { as: 'Platform' }),
      tool('BtnHint', [layer('提示轮廓木圆按钮', { as: 'Bg' }), layer('提示轮廓图标', { as: 'Icon' }), layer('提示轮廓文案', { as: 'Text' })], 'onHint'),
      tool('BtnUndo', [layer('取回拼块木圆按钮', { as: 'Bg' }), layer('取回拼块图标', { as: 'Icon' }), layer('取回拼块文案', { as: 'Text' })], 'onUndo', { bind: ['undoButton', 'Button'] }),
      tool('BtnHelp', [layer('图示帮助木圆按钮', { as: 'Bg' }), layer('图示帮助符号', { as: 'Icon' }), layer('图示帮助文案', { as: 'Text' })], 'onHelp'),
    ], { align: 'bottom' }),
  ],
};
