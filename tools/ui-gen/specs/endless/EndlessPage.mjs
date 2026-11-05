import { layer, group, sprite, label, slot } from '../../lib/dsl.mjs';
import { board } from '../_board.mjs';
import hud from '../garden/_hud.cjs';

const R19 = name => `PNG/补充/R-19_评语_${name}.png`;
const CENTER = { size: 30, color: [255, 249, 217], bold: true, align: 'center', outline: [101, 61, 32], outlineWidth: 2 };

export default {
  name: 'EndlessPage', bundle: 'endless', kind: 'page', script: 'game/features/endless/EndlessPage', title: '无尽模式局内：37 格三轴消除',
  source: 'T13-01_无尽主动收获确认',
  doc: {
    args: '{ resume: boolean }', sources: ['无尽模式'], features: 'F030、F031、F032、F033、F034',
    dynamic: 'BoardRoot：运行时按 37 格坐标从对象池生成 BoardCell（木框/凹槽按 block_hex_runtime 生成一次）；TraySlots：3 个候选块挂点，块由 PieceCell 池拼成；分数、最高分',
    states: 'Undo（每局 1 次，用完置灰：UndoCount=0）、Combo 评语 4 张（不错/太棒了/完美/超级连击，按连击档显示一张）；收获确认用 ConfirmPopup（T13-01 遮罩层），无位置用 EndlessRevivePopup',
    fx: 'FX-09、FX-10、FX-03',
  },
  children: [
    layer('完整裸背景', { as: 'Background' }),
    hud.endlessHud(),
    group('Header', [
      group('Title', [layer('原生完整吊牌', { as: 'Sign' }), layer('无尽标题', { as: 'Text' })]),
      group('Score', [
        layer('原生木框玻璃计分板', { as: 'Panel' }),
        layer('当前得分标签', { as: 'ScoreCaption' }),
        layer('本局得分', { as: 'Score', bind: 'scoreLabel' }),
        layer('最高记录标签', { as: 'BestCaption' }),
        layer('最高记录值', { as: 'Best', bind: 'bestLabel' }),
      ]),
      layer('原生陪伴蜜蜂', { as: 'Bee' }),
      group('BtnRecords', [layer('排行榜按钮', { as: 'Icon' }), layer('本机纪录', { as: 'Text' })], { button: 'onRecords', note: '本机纪录（成就页），非排行榜' }),
      group('BtnSupply', [layer('每日奖励按钮', { as: 'Icon' }), layer('每日奖励', { as: 'Text' })], { button: 'onSupply', note: '每日补给 F057' }),
    ], { align: 'top' }),
    board([90, 565, 673, 745], '37 格棋盘（BoardCell 对象池）'),
    group('Combo', [
      sprite('Good', R19('不错'), [276, 820, 300, 120], { bindArray: 'comboWords', active: false }),
      sprite('Great', R19('太棒了'), [276, 820, 300, 120], { bindArray: 'comboWords', active: false }),
      sprite('Perfect', R19('完美'), [276, 820, 300, 120], { bindArray: 'comboWords', active: false }),
      sprite('Super', R19('超级连击'), [276, 820, 300, 120], { bindArray: 'comboWords', active: false }),
      label('Gain', null, [276, 940, 300, 60], { ...CENTER, size: 40 }, { text: '+120', bind: 'gainLabel', active: false }),
    ], { rect: [276, 820, 300, 180], bind: ['comboRoot', 'Node'], note: '连击评语与加分飘字，按档位显示一张' }),
    group('Undo', [
      sprite('Bg', 'PNG/公共UI/道具空按钮_cc8488e766.png', [40, 1190, 110, 110]),
      sprite('Icon', 'PNG/公共UI/撤销道具图标_ed2773ab95.png', [58, 1205, 74, 74]),
      label('Count', null, [104, 1262, 50, 40], CENTER, { text: '1', bind: 'undoCountLabel' }),
    ], { button: 'onUndo', bind: ['undoButton', 'Node'], note: '设计稿无此按钮，按道具按钮样式补位' }),
    group('BtnPause', [sprite('Icon', 'PNG/补充/R-13_图标_暂停.png', [723, 1200, 90, 90])], { button: 'onPause', note: '设计稿无此按钮，补位' }),
    group('Tray', [
      layer('无尽三候选_无字木托盘', { as: 'Board' }),
      slot('Slot1', [56, 1340, 240, 240], { bindArray: 'traySlots' }),
      slot('Slot2', [306, 1340, 240, 240], { bindArray: 'traySlots' }),
      slot('Slot3', [556, 1340, 240, 240], { bindArray: 'traySlots' }),
    ], { align: 'bottom' }),
    group('Bottom', [
      layer('原生玩法提示木条', { as: 'RuleBar' }),
      layer('无尽规则', { as: 'Rule' }),
      group('BtnHelp', [layer('玩法帮助_无字按钮', { as: 'Bg' }), layer('玩法帮助_文案', { as: 'Text' })], { button: 'onHelp' }),
      group('BtnHarvest', [layer('收获花蜜_无字按钮', { as: 'Bg' }), layer('收获花蜜_文案', { as: 'Text' })], { button: 'onHarvest' }),
    ], { align: 'bottom' }),
  ],
};
