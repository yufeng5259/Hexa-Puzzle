import { group, label, layer, layers } from '../../lib/dsl.mjs';
import { backRow, hud, woodTitle } from './_shared.mjs';

const CARD = 'game/features/collection/CompanionCard';
const ROW_Y = [549, 758, 967];
const PORTRAITS = ['bee_xiaomi', 'bee_huahua', 'bee_agong'];
const ROLES = ['蜂友身份0', '蜂友身份1', '蜂友身份2'];
const NAMES = ['蜂友名0', '蜂友名1', '蜂友名2'];

/**
 * One companion row. All three cards carry the same nodes (grow button, affinity, lock state);
 * layers present only on some rows of the art are reused at the row's offset.
 */
function card(i) {
  const y = ROW_Y[i];
  return group(`Card${i}`, [
    layer(`伙伴原生行${i}`, { as: 'Row' }),
    layer(PORTRAITS[i], { as: 'Portrait', bind: 'portrait' }),
    layer(NAMES[i], { as: 'Name', bind: 'nameLabel' }),
    layer(ROLES[i], { as: 'Role', bind: 'roleLabel' }),
    group('Unlocked', [
      layer('蜂友成长0', { as: 'Affinity', rect: [523, y + 3, 206, 49], bind: 'affinityLabel' }),
      group('BtnGrow', [
        layer('成长_原生按钮', { index: 0, as: 'Bg', rect: [538, y + 64, 185, 55] }),
        layer('成长_文案', { index: 0, as: 'Text', rect: [547, y + 69, 167, 42] }),
      ], { button: 'onSelect' }),
      label('Following', 'hg.collection.following', [264, y + 102, 227, 34], { size: 22, color: [92, 140, 52], bold: true }, { active: false, bind: ['followingTag', 'Node'] }),
    ], { bind: ['unlockedNode', 'Node'], active: i < 2 }),
    group('Locked', [
      layer('阿工认识条件锁', { as: 'Lock', rect: [529, y + 7, 51, 58] }),
      layer('蜂友成长2', { as: 'Condition', rect: [506, y + 63, 230, 63], bind: 'conditionLabel' }),
    ], { bind: ['lockedNode', 'Node'], active: i === 2 }),
  ], { script: CARD, bindArray: 'cards' });
}

export default {
  name: 'CompanionListPage', group: 'meta', bundle: 'meta', kind: 'page', script: 'game/features/collection/CompanionListPage',
  title: '三位蜂友列表（家园伙伴）',
  source: 'T20-01_三位蜂友列表',
  doc: {
    args: '无', features: 'F035、F036',
    dynamic: '3 张 CompanionCard（固定数量，非滚动列表）：头像、名字、身份、亲密 x/30、成长按钮；未认识时显示锁与条件；总亲密进度条宽度按 total/90',
    states: 'Card.Unlocked / Card.Locked（未开放蜂友）、Card.Following（当前跟随）；小蜜外观挂件 XiaomiOutfit 随衣柜更换',
    fx: '—',
  },
  children: [
    layer('完整裸背景', { as: 'Background' }),
    hud(),
    woodTitle(),
    layer('原生完整主框', { as: 'Panel' }),
    layer('页面副标题', { as: 'Subtitle', bind: 'subtitleLabel' }),
    card(0), card(1), card(2),
    layer('bee_xiaomi_独立晴天围巾', { as: 'XiaomiOutfit', bind: 'xiaomiOutfit', note: '小蜜当前外观' }),
    group('Total', [
      layer('伙伴进度标签', { as: 'Label', bind: 'totalLabel' }),
      layer('进度空轨', { as: 'Track' }),
      layer('进度填充', { as: 'Fill', bind: 'totalFill' }),
    ]),
    group('BtnGrowth', [layer('伙伴成长_原生按钮', { as: 'Bg' }), layer('伙伴成长_文案', { as: 'Text' })], { button: 'onGrowth' }),
    group('BtnAlbum', [layer('旅行相册_原生按钮', { as: 'Bg' }), layer('旅行相册_文案', { as: 'Text' })], { button: 'onAlbum' }),
    backRow(),
  ],
};
