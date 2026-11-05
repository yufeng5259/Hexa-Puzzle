import { layer, group, sprite, label, frameRef } from '../../lib/dsl.mjs';
import hud from './_hud.cjs';

const NODE = 'game/features/garden/WorldMapNode';
const STATE = { size: 23, color: [101, 61, 32], bold: true, align: 'center' };
const LOCK_TEXT = { size: 25, color: [140, 116, 85], bold: true, align: 'center' };
const HOME_TEXT = { size: 26, color: [255, 249, 217], bold: true, align: 'center', outline: [54, 121, 42], outlineWidth: 1 };
const HOME_BG = 'PNG/公共UI/下一关按钮_95161f55c5.png';
const LOCK_ICON = 'PNG/公共UI/锁定道具图标_3af59e5b0a.png';
const K = 'block.000a71cd764f.text.';

/**
 * One garden node. All three share the same parts; the design only drew 回家园 on the unlocked node and
 * the lock on the locked ones, so the missing parts are placed at the same offsets relative to the row panel.
 * `row` = [x, y] of the row panel; parts below use offsets measured from the design.
 */
function node(as, row, prefix, parts) {
  const [x, y] = row;
  const r = (dx, dy, w, h) => [x + dx, y + dy, w, h];
  return group(as, [
    layer('无字面板_row', { as: 'Row', index: parts.rowIndex }),
    layer(`${prefix}实景地图缩略图`, { as: 'Thumb' }),
    layer(`${prefix}地图名称`, { as: 'Name' }),
    parts.progress,
    parts.locked,
    layer(`${prefix}原关卡地图节点`, { as: 'Shield', bind: 'shield' }),
    layer(`${prefix}节点章号`, { as: 'Index', bind: 'indexLabel' }),
    parts.home ?? group('BtnHome', [
      sprite('Bg', HOME_BG, r(210, 191, 185, 83)),
      label('Text', K + 'ed9dc3a4a562', r(234, 203, 137, 54), HOME_TEXT),
    ], { button: 'onHome', bind: ['homeButton', 'Node'], active: false }),
    parts.lock ?? group('Lock', [
      sprite('Icon', LOCK_ICON, r(275, 185, 50, 58)),
      label('Text', K + '1571bbd05b53', r(206, 247, 194, 43), LOCK_TEXT),
    ], { bind: ['lockGroup', 'Node'], active: false }),
  ], { script: NODE, bindArray: 'nodes' });
}

export default {
  name: 'WorldMapPage', bundle: 'garden', kind: 'page', script: 'game/features/garden/WorldMapPage', title: '三园世界地图',
  source: 'T27-01_三园世界地图',
  doc: {
    args: '无', features: 'F027',
    dynamic: '每个 WorldMapNode：Progress「x/25」（已开放园）、Shield 金/灰（shieldFrames[0]=金 已开放，[1]=灰 未开放）、Index 章号',
    states: 'WorldMapNode.BtnHome（当前园显示）、WorldMapNode.Lock 与 Locked 文案（未开放显示）、Progress（已开放显示）',
    fx: 'FX-12',
  },
  props: {
    shieldFrames: [frameRef('PNG/公共UI/金色关卡盾牌母件_747dc74440.png'), frameRef('PNG/公共UI/灰色关卡盾牌母件_bad4bb901e.png')],
  },
  children: [
    sprite('Background', 'PNG/补充/R-18_世界地图背景.png', [0, 0, 853, 1844], { note: 'R-18（原稿借用关卡选择背景）' }),
    hud.standardHud('玩家主线进度'),
    group('Title', [layer('标题无字木牌', { as: 'Sign' }), layer('页面标题', { as: 'Text' }), layer('地图引言', { as: 'Intro' })], { align: 'top' }),
    group('Nodes', [
      node('Sunny', [357, 420], '向阳花园', {
        rowIndex: 0,
        progress: layer('向阳花园解锁状态', { as: 'Progress', bind: 'progressLabel' }),
        locked: label('Locked', K + '756bc93a74e5', [558, 507, 201, 68], STATE, { bind: 'lockedLabel', active: false }),
        home: group('BtnHome', [layer('回家园_无字按钮', { as: 'Bg' }), layer('回家园_文案', { as: 'Text' })], { button: 'onHome', bind: ['homeButton', 'Node'] }),
      }),
      node('Water', [82, 806], '清风水湾', {
        rowIndex: 1,
        progress: label('Progress', null, [283, 893, 201, 68], STATE, { text: '0/25', bind: 'progressLabel', active: false }),
        locked: layer('清风水湾解锁状态', { as: 'Locked', bind: 'lockedLabel' }),
        lock: group('Lock', [layer('清风水湾未解锁锁头', { as: 'Icon' }), layer('清风水湾锁定按钮文案', { as: 'Text' })], { bind: ['lockGroup', 'Node'] }),
      }),
      node('Cloud', [357, 1192], '云上蜂谷', {
        rowIndex: 2,
        progress: label('Progress', null, [558, 1279, 201, 68], STATE, { text: '0/25', bind: 'progressLabel', active: false }),
        locked: layer('云上蜂谷解锁状态', { as: 'Locked', bind: 'lockedLabel' }),
        lock: group('Lock', [layer('云上蜂谷未解锁锁头', { as: 'Icon' }), layer('云上蜂谷锁定按钮文案', { as: 'Text' })], { bind: ['lockGroup', 'Node'] }),
      }),
    ]),
    group('Bottom', [layer('返回', { as: 'BtnBack', button: 'onBack' })], { align: 'bottom' }),
  ],
};
