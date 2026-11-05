import { group, layer } from '../../lib/dsl.mjs';
import { backRow, hud, woodTitle } from './_shared.mjs';

const CELL = 'game/features/collection/OutfitCell';
const ICONS = ['outfit_scarf', 'outfit_picnic_hat', 'outfit_flower_hat', 'outfit_water_ribbon', 'outfit_cloud_brooch'];
const POS = [[112, 819], [327, 819], [542, 819], [219, 1089], [434, 1089]];

/** Outfit cell i. Using-check and lock exist on every cell; the art shows one or the other. */
function cell(i) {
  const [x, y] = POS[i];
  return group(`Outfit${i}`, [
    layer(`衣柜原生物品格${i}`, { as: 'Frame' }),
    layer(ICONS[i], { as: 'Icon' }),
    layer(`外观名${i}`, { as: 'Name' }),
    layer('check', { as: 'Using', rect: [x + 151, y + 165, 48, 42], active: i === 0, bind: ['usingNode', 'Node'] }),
    layer('未拥有锁1', { as: 'Lock', rect: [x + 151, y + 165, 45, 51], active: i > 0, bind: ['lockNode', 'Node'] }),
    layer(`外观状态与来源${i}`, { as: 'Status', bind: 'statusLabel' }),
  ], { script: CELL, bindArray: 'outfits', button: 'onSelect' });
}

export default {
  name: 'WardrobePage', group: 'meta', bundle: 'meta', kind: 'page', script: 'game/features/collection/WardrobePage',
  title: '外观衣柜（小蜜 5 件外观）',
  source: 'T23-01_外观衣柜',
  doc: {
    args: '无', features: 'F038',
    dynamic: '5 个 OutfitCell（固定）；预览小蜜佩戴所选外观（R-24 组合图或挂件图）；当前装备格图标',
    states: 'OutfitCell.Using / Lock，状态文字「正在使用 / 已拥有 / 未拥有+来源」；BtnUse 文案「正在使用」/「换上」',
    fx: '—',
  },
  children: [
    layer('完整裸背景', { as: 'Background' }),
    hud(),
    woodTitle(),
    layer('原生完整主框', { as: 'Panel' }),
    layer('页面副标题', { as: 'Subtitle' }),
    group('Preview', [
      layer('角色主体', { as: 'Bee', bind: 'previewBee' }),
      layer('角色主体_独立晴天围巾', { as: 'Outfit', bind: 'previewOutfit' }),
    ]),
    group('Current', [layer('当前装备展示格', { as: 'Frame' }), layer('当前晴天围巾', { as: 'Icon', bind: 'currentIcon' }), layer('当前装备', { as: 'Text' })]),
    cell(0), cell(1), cell(2), cell(3), cell(4),
    group('BtnUse', [layer('正在使用_原生按钮', { as: 'Bg' }), layer('正在使用_文案', { as: 'Text', bind: 'useLabel' })], { button: 'onUse' }),
    backRow(),
  ],
};
