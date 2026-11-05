import { layer, group, sprite } from '../../lib/dsl.mjs';
import { hudA } from './_hud.mjs';

const ROW = 'game/features/common/SettingRow';
const ICONS = ['音乐', '音效', '震动', '减少动效', '大字'];
const KEYS = ['music', 'sfx', 'vibrate', 'reduceMotion', 'largeText'];
const ROW_Y = [434, 566, 698, 830, 962];

/** One setting row: row board, R-09 icon, title text, R-08 switch (base on/off states + knob). */
const row = i => {
  const y = ROW_Y[i], cy = y + 70;
  return group(`Row${i}`, [
    layer(`设置原生行${i}`, { as: 'Board' }),
    sprite('Icon', `PNG/补充/R-09_图标_${ICONS[i]}.png`, [118, cy - 35, 70, 70]),
    layer(`设置${i}`, { as: 'Title', rect: [200, y + 38, 300, 70], style: { align: 'left' } }),
    sprite('BaseOn', 'PNG/补充/R-08_设置开关_底_开.png', [557, cy - 37, 150, 75], { bind: ['baseOn', 'Node'] }),
    sprite('BaseOff', 'PNG/补充/R-08_设置开关_底_关.png', [557, cy - 37, 150, 75], { active: false, bind: ['baseOff', 'Node'] }),
    sprite('Knob', 'PNG/补充/R-08_设置开关_滑块.png', [632, cy - 35, 70, 70], { bind: ['knob', 'Node'], note: '开 x=632 / 关 x=562，由脚本移动' }),
  ], { script: ROW, bindArray: 'rows', button: 'onToggle', data: KEYS[i] });
};

export default {
  name: 'SettingsPopup', bundle: 'common', kind: 'popup', script: 'game/features/common/SettingsPopup', title: '声音与易用设置',
  source: 'T39-01_声音与易用设置',
  doc: { args: '无；读写存档 settings', features: 'F047、F046、F051、F065',
    dynamic: '5 行开关状态（SettingRow：BaseOn/BaseOff 切换，Knob 左右位置）；行顺序 music、sfx、vibrate、reduceMotion、largeText',
    states: '每行 BaseOn / BaseOff', fx: 'FX-12' },
  backdrop: [layer('完整裸背景', { as: 'Background' })],
  children: [
    hudA(),
    layer('原生完整主框', { as: 'Panel' }),
    layer('左标题吊绳', { as: 'RopeL' }),
    layer('右标题吊绳', { as: 'RopeR' }),
    layer('好友系原生标题木牌', { as: 'Plank' }),
    layer('页面标题', { as: 'Title' }),
    ...[0, 1, 2, 3, 4].map(row),
    group('BtnHelp', [layer('看图帮助_原生按钮', { as: 'Bg' }), layer('看图帮助_文案', { as: 'Text' })], { button: 'onHelp' }),
    group('BtnLocalSave', [layer('本地存档_原生按钮', { as: 'Bg' }), layer('本地存档_文案', { as: 'Text' })], { button: 'onLocalSave' }),
    group('BtnPrivacy', [layer('隐私说明_原生按钮', { as: 'Bg' }), layer('隐私说明_文案', { as: 'Text' })], { button: 'onPrivacy' }),
    group('BtnReturn', [layer('返回游戏_原生按钮', { as: 'Bg' }), layer('返回游戏_文案', { as: 'Text' })], { button: 'onBack', align: 'bottom' }),
  ],
};
