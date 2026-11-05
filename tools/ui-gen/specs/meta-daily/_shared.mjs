// Shared node builders for meta-daily specs (no prefab of its own).
import { layer, group } from '../../lib/dsl.mjs';

export default [];

/** Standard TopHud on pages whose config carries the common HUD layers (蜂友头像 … 设置). */
export const hud = () => group('Hud', [
  group('Avatar', [layer('蜂友头像', { as: 'Frame' }), layer('玩家主线进度', { as: 'Level', bind: 'levelLabel' })], { button: 'onAvatar' }),
  group('Honey', [layer('花蜜数量底条', { as: 'Bar' }), layer('花蜜图标', { as: 'Icon' }), layer('花蜜数量', { as: 'Count', bind: 'honeyLabel' })]),
  group('Hints', [layer('提示数量底条', { as: 'Bar' }), layer('提示灯泡', { as: 'Icon' }), layer('提示库存', { as: 'Count', bind: 'hintLabel' })]),
  layer('设置', { as: 'Settings', button: 'onSettings' }),
], { script: 'game/features/common/TopHud', align: 'top' });

/** Wooden hanging title used by the 好友系 pages (T31/T33/T34/T48/T49). */
export const woodTitle = () => group('Title', [
  layer('左标题吊绳', { as: 'RopeL' }), layer('右标题吊绳', { as: 'RopeR' }),
  layer('好友系原生标题木牌', { as: 'Board' }), layer('页面标题', { as: 'Text' }),
]);

/** Ribbon illustration title used by the 每日奖励 pages (T29/T30/T32/T47). */
export const ribbonTitle = () => group('Title', [layer('红带花叶与小蜜完整标题插画', { as: 'Art' }), layer('页面标题', { as: 'Text' })]);

/** Bottom-left back button pinned to the screen bottom. */
export const back = (extra = []) => group('Bottom', [layer('返回上一页', { as: 'BtnBack', button: 'onBack' }), ...extra], { align: 'bottom' });

/** Native button: background layer + its caption layer. */
export const btn = (name, bg, text, handler, opts = {}) =>
  group(name, [layer(bg, { as: 'Bg', index: opts.index }), layer(text, { as: 'Text', index: opts.index, bind: opts.textBind })], { button: handler, bind: opts.bind, active: opts.active });
