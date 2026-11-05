// Shared TopHud groups for garden/endless specs (plain DSL objects; .cjs so the spec walker skips it).
const L = (name, opts = {}) => ({ t: 'layer', name, ...opts });
const G = (name, children, opts = {}) => ({ t: 'group', name, children, ...opts });
const TOP_HUD = 'game/features/common/TopHud';

/** Standard HUD (蜂友头像 / 花蜜数量底条 / 提示数量底条 / 设置); `level` is the page's level text layer name. */
function standardHud(level, from) {
  const f = from ? { from } : {};
  return G('Hud', [
    G('Avatar', [L('蜂友头像', { as: 'Frame', ...f }), L(level, { as: 'Level', bind: 'levelLabel', ...f })], { button: 'onAvatar' }),
    G('Honey', [L('花蜜数量底条', { as: 'Bar', ...f }), L('花蜜图标', { as: 'Icon', ...f }), L('花蜜数量', { as: 'Count', bind: 'honeyLabel', ...f })]),
    G('Hints', [L('提示数量底条', { as: 'Bar', ...f }), L('提示灯泡', { as: 'Icon', ...f }), L('提示库存', { as: 'Count', bind: 'hintLabel', ...f })]),
    L('设置', { as: 'Settings', button: 'onSettings', ...f }),
  ], { script: TOP_HUD, align: 'top' });
}

/** Endless HUD variant (原生头像 / hints first / honey; the honey "+" shop button is a removed feature). */
function endlessHud(from) {
  const f = from ? { from } : {};
  return G('Hud', [
    G('Avatar', [L('原生头像', { as: 'Frame', ...f }), L('头像进度等级', { as: 'Level', bind: 'levelLabel', ...f })], { button: 'onAvatar' }),
    G('Hints', [L('透明计数底条', { as: 'Bar', index: 0, ...f }), L('提示库存图标', { as: 'Icon', ...f }), L('提示库存值', { as: 'Count', bind: 'hintLabel', ...f }), L('提示库存标签', { as: 'Caption', ...f })]),
    G('Honey', [L('透明计数底条', { as: 'Bar', index: 1, ...f }), L('蜂蜜货币', { as: 'Icon', ...f }), L('花蜜余额', { as: 'Count', bind: 'honeyLabel', ...f })]),
    L('设置木质齿轮', { as: 'Settings', button: 'onSettings', ...f }),
  ], { script: TOP_HUD, align: 'top' });
}

module.exports = { standardHud, endlessHud };
