import { frameRef, group, label, layer, layers } from '../../lib/dsl.mjs';
import { backRow, hud } from './_shared.mjs';

const CELL = 'game/features/collection/PhotoCell';
const SLOTS = [[98, 531], [432, 531], [98, 844], [432, 844], [98, 1157], [432, 1157]];
const NAMES = ['树屋照片名称', '花园照片名称', '蜂蜜工坊照片名称', '小溪水车照片名称', '温室照片名称', '全园合影照片名称'];
const TABS = [['向阳花园原木相册页签', '向阳花园相册页签文案'], ['清风水湾原木相册页签', '清风水湾相册页签文案'], ['云上蜂谷原木相册页签', '云上蜂谷相册页签文案']];

/** Photo slot i. Every slot carries photo, done mark, pending lock and a new mark; the art shows the collected or pending variant. */
function slot(i) {
  const [x, y] = SLOTS[i];
  const collected = i < 2;
  return group(`Photo${i}`, [
    layer('无字面板_row', { index: i, as: 'Frame' }),
    layer('树屋已收录照片', { as: 'Photo', rect: [x + 15, y + 16, 292, 210], active: collected, bind: 'photo' }),
    layer('树屋已收录标记', { as: 'Done', rect: [x + 257, y + 25, 45, 39], active: collected, bind: ['doneNode', 'Node'] }),
    group('Pending', [
      layer('蜂蜜工坊待收录占位', { as: 'Lock', rect: [x + 136, y + 63, 50, 58] }),
      layer('蜂蜜工坊待记录', { as: 'Text', rect: [x + 30, y + 139, 262, 57] }),
    ], { active: !collected, bind: ['pendingNode', 'Node'] }),
    label('New', 'hg.collection.photo_new', [x + 18, y + 22, 80, 36], { size: 24, color: [255, 255, 255], bold: true, outline: [214, 84, 52], outlineWidth: 2 },
      { active: false, bind: ['newNode', 'Node'] }),
    layer(NAMES[i], { as: 'Name' }),
  ], { script: CELL, bindArray: 'photos', button: 'onSelect' });
}

export default {
  name: 'AlbumPage', group: 'meta', bundle: 'meta', kind: 'page', script: 'game/features/collection/AlbumPage',
  title: '旅行相册（3 册分页，每册 6 张）',
  source: 'T24-01_旅行相册',
  doc: {
    args: '{ book? }（默认当前园）', features: 'F039、F040',
    dynamic: '页签切换 3 册（选中/未选中底图由 tabOn/tabOff 换图）；6 个 PhotoCell（固定）按册加载照片（bundles/meta/photos/<园>_<建筑>，向阳花园用页面素材照片）',
    states: 'PhotoCell：已收录（Photo+Done）/ 待记录（Pending）/ 新获得（New）；未解锁的册页签置灰',
    fx: '—',
  },
  props: {
    tabOn: frameRef('PNG/公共UI/我的好友_选中页签_dc3ecbc337.png'),
    tabOff: frameRef('PNG/公共UI/添加好友_未选中页签_69a281099f.png'),
  },
  children: [
    layer('完整裸背景', { as: 'Background' }),
    hud('当前主线等级'),
    group('Title', [layers(['原好友左悬绳', '原好友右悬绳', '原好友无字标题木牌']), layer('页面标题', { as: 'Text' })], { align: 'top' }),
    layer('无字面板_wood', { as: 'Panel' }),
    group('Tabs', [
      layer('原好友页签木质背框', { as: 'Frame' }),
      ...TABS.map(([bg, text], i) => group(`Tab${i}`, [layer(bg, { as: 'Bg', bindArray: 'tabBgs' }), layer(text, { as: 'Text' })], { button: 'onTab', data: String(i) })),
    ]),
    layer('当前相册名称', { as: 'BookName', bind: 'bookNameLabel' }),
    slot(0), slot(1), slot(2), slot(3), slot(4), slot(5),
    layer('相册收集进度', { as: 'Progress', bind: 'progressLabel' }),
    backRow('返回'),
  ],
};
