// Shared TopHud group builders (no prefab here: default export is empty).
import { layer, group } from '../../lib/dsl.mjs';

const HUD = 'game/features/common/TopHud';

/** Pages whose HUD layers are 蜂友头像 / 玩家主线进度 / 花蜜数量底条 … (T06, T39, T42 family). */
export const hudA = from => group('Hud', [
  group('Avatar', [layer('蜂友头像', { from, as: 'Frame' }), layer('玩家主线进度', { from, as: 'Level', bind: 'levelLabel' })], { button: 'onAvatar' }),
  group('Honey', [layer('花蜜数量底条', { from, as: 'Bar' }), layer('花蜜图标', { from, as: 'Icon' }), layer('花蜜数量', { from, as: 'Count', bind: 'honeyLabel' })]),
  group('Hints', [layer('提示数量底条', { from, as: 'Bar' }), layer('提示灯泡', { from, as: 'Icon' }), layer('提示库存', { from, as: 'Count', bind: 'hintLabel' })]),
  layer('设置', { from, as: 'Settings', button: 'onSettings' }),
], { script: HUD, align: 'top' });

/** Pages whose HUD layers are 原生头像 / 头像进度等级 / 透明计数底条×2 … (T37, T40, T13 family). The removed 添加按钮 (shop) is left out. */
export const hudB = from => group('Hud', [
  group('Avatar', [layer('原生头像', { from, as: 'Frame' }), layer('头像进度等级', { from, as: 'Level', bind: 'levelLabel' })], { button: 'onAvatar' }),
  group('Hints', [layer('透明计数底条', { from, index: 0, as: 'Bar' }), layer('提示库存图标', { from, as: 'Icon' }),
    layer('提示库存值', { from, as: 'Count', bind: 'hintLabel' }), layer('提示库存标签', { from, as: 'Caption' })]),
  group('Honey', [layer('透明计数底条', { from, index: 1, as: 'Bar' }), layer('蜂蜜货币', { from, as: 'Icon' }), layer('花蜜余额', { from, as: 'Count', bind: 'honeyLabel' })]),
  layer('设置木质齿轮', { from, as: 'Settings', button: 'onSettings' }),
], { script: HUD, align: 'top' });

export default [];
