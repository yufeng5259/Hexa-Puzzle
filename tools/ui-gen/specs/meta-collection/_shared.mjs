// Shared helpers for the meta collection specs. Default export is empty so gen.mjs loads no spec from this file.
import { group, label, layer, layers } from '../../lib/dsl.mjs';

export default [];

/**
 * Inline TopHud from the page's own HUD layers. `level` is the page's level text layer name,
 * or null when the page has none (an explicit block.common.level label is added at the standard spot).
 */
export function hud(level = '玩家主线进度') {
  const levelNode = level
    ? layer(level, { as: 'Level', bind: 'levelLabel' })
    : label('Level', 'block.common.level', [40, 121, 76, 24], { size: 18, color: [255, 248, 216], bold: true, outline: [68, 131, 41], outlineWidth: 1 }, { bind: 'levelLabel' });
  return group('Hud', [
    group('Avatar', [layer('蜂友头像', { as: 'Frame' }), levelNode], { button: 'onAvatar' }),
    group('Honey', [layer('花蜜数量底条', { as: 'Bar' }), layer('花蜜图标', { as: 'Icon' }), layer('花蜜数量', { as: 'Count', bind: 'honeyLabel' })]),
    group('Hints', [layer('提示数量底条', { as: 'Bar' }), layer('提示灯泡', { as: 'Icon' }), layer('提示库存', { as: 'Count', bind: 'hintLabel' })]),
    layer('设置', { as: 'Settings', button: 'onSettings' }),
  ], { script: 'game/features/common/TopHud', align: 'top' });
}

/** Wooden hanging title board used by the 好友 family pages (T19–T23). */
export function woodTitle(bind) {
  return group('Title', [
    layers(['左标题吊绳', '右标题吊绳', '好友系原生标题木牌']),
    layer('页面标题', { as: 'Text', ...(bind ? { bind } : {}) }),
  ], { align: 'top' });
}

/** Back button pinned to the bottom edge. */
export function backRow(name = '返回上一页') {
  return group('Bottom', [layer(name, { as: 'BtnBack', button: 'onBack' })], { align: 'bottom' });
}

/** Ribbon title used by the 结算-style popups (T26, T28). */
export function ribbonTitle(bind) {
  return group('Title', [
    layer('左花叶', { as: 'LeafL' }), layer('右花叶', { as: 'LeafR' }), layer('结算原生红飘带', { as: 'Ribbon' }),
    layer('页面标题', { as: 'Text', ...(bind ? { bind } : {}) }),
  ]);
}
