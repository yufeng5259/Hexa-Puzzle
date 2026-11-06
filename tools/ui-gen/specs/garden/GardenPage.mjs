import { layer, group, sprite, label } from '../../lib/dsl.mjs';
import hud from './_hud.cjs';

const T02 = 'T15-02_家园_单栋满级';
const T03 = 'T15-03_家园_升级动画关键帧';
const T05 = 'T15-05_家园_第三园全部完成';
const SLOT = 'game/features/garden/BuildingSlot';
const SCAFFOLD = 'PNG/补充/R-22_施工脚手架.png';

/**
 * One building: body stage sprite + its tag (plate, 5-step track, fill, price/state text, level text,
 * direct-upgrade button, max-level check) + a hidden scaffold over the body.
 * `max` is the 满级确认 layer name (T15-02 for 树屋, T15-05 for the rest).
 */
function building(as, name, body, maxFrom) {
  return group(as, [
    layer(body, { as: 'Body', bind: 'body', button: 'onUpgrade', note: '点建筑本体与点价签执行同一升级命令（F023）' }),
    group('Tag', [
      layer(`${name}空白进度牌`, { as: 'Plate' }),
      layer(`${name}五级进度底轨`, { as: 'Track' }),
      layer(`${name}独立五级进度填充`, { as: 'Fill', bind: 'fill', fill: true, note: 'fillRange = 等级/5' }),
      layer(`${name}动态价格与状态`, { as: 'Price', bind: 'priceLabel', key: 'hg.garden.price', note: '参数 {name,count}；满级时 setKey(hg.garden.max, {name})' }),
      layer(`${name}等级`, { as: 'Level', bind: 'levelLabel' }),
      layer(`${name}直接升级按钮`, { as: 'BtnUpgrade', button: 'onUpgrade', bind: ['upgradeButton', 'Node'] }),
      layer(`${name}满级确认`, { from: maxFrom, as: 'MaxMark', active: false, bind: ['maxMark', 'Node'] }),
    ], { bind: ['tag', 'Node'], note: '按 layout.json 随建筑移动（authored 位置对应向阳花园）' }),
  ], { script: SLOT, bindArray: 'slots' });
}

export default {
  name: 'GardenPage', bundle: 'garden', kind: 'page', script: 'game/features/garden/GardenPage', title: '家园：三园共用，5 栋建筑直接升级',
  source: 'T15-01_家园_五级建设基础',
  doc: {
    args: '{ chapter }（当前园 0/1/2，默认取存档）', sources: [T02, T03, 'T15-04_家园_花蜜不足回流', T05], features: 'F023、F024、F025、F026、F028',
    dynamic: 'Terrain 换 garden/terrain/<theme>；每个 BuildingSlot.body 换 garden/buildings/<theme>/<building>_<lv>（换图后按图片原尺寸显示）；'
      + '向阳的落位取本页坐标，清风水湾/云上蜂谷由运行时落位配置（PNG/补充/R-01_清风水湾建筑落位.json 及云上蜂谷对应数据，转为 garden 包配置）重设 Body 位置与宽度；'
      + 'WaterRotor 仅水车 1–5 级显示并换 _rotor 图；价格/等级/总进度文字与填充宽度按存档刷新',
    states: 'BuildingSlot.MaxMark（满级，T15-02/T15-05）、Scaffolds[i]（升级中，与 slots 同序）、UpgradeFx（T15-03 升级反馈，挂到被升级建筑上方）；'
      + 'Summary 文案 key：建设中 hg.garden.summary.building / 花蜜不足 hg.garden.summary.shortage(T15-04) / 全部完成 hg.garden.summary.done(T15-05)；'
      + 'ChapterReward 礼物在 25/25 时可领',
    fx: 'FX-05、FX-06、FX-03',
  },
  children: [
    layer('向阳花园完整无建筑裸地形', { as: 'Terrain', bind: 'terrain' }),
    group('Buildings', [
      building('Treehouse', '树屋', '向阳花园_树屋_2级', T02),
      building('Garden', '花园', '向阳花园_花园_1级', T05),
      building('Workshop', '蜂蜜工坊', '向阳花园_蜂蜜工坊_1级', T05),
      building('Watermill', '小溪水车', '向阳花园_小溪水车_1级_无轮静态本体', T05),
      building('Greenhouse', '温室', '向阳花园_温室_1级', T05),
    ], { rect: [0, 0, 853, 1844] }),
    layer('向阳花园_小溪水车_1级_独立水轮转子', { as: 'WaterRotor', bind: 'waterRotor', note: '水车 0 级隐藏' }),
    group('Scaffolds', [
      sprite('Treehouse', SCAFFOLD, [43, 269, 367, 351], { bindArray: 'scaffolds', active: false }),
      sprite('Garden', SCAFFOLD, [520, 450, 280, 220], { bindArray: 'scaffolds', active: false }),
      sprite('Workshop', SCAFFOLD, [73, 737, 305, 195], { bindArray: 'scaffolds', active: false }),
      sprite('Watermill', SCAFFOLD, [577, 914, 242, 160], { bindArray: 'scaffolds', active: false }),
      sprite('Greenhouse', SCAFFOLD, [70, 1124, 392, 298], { bindArray: 'scaffolds', active: false }),
    ], { rect: [0, 0, 853, 1844], note: '与 slots 同序；施工期间显示' }),
    group('SceneBees', [
      layer('原稿场景角色_树屋飞行蜜蜂', { as: 'TreehouseBee' }),
      layer('原稿场景角色_花园蜜蜂', { as: 'GardenBee' }),
      layer('原稿场景角色_工坊蜜蜂', { as: 'WorkshopBee' }),
      layer('原稿场景角色_水车蜜蜂', { as: 'WatermillBee' }),
      layer('原稿场景角色_温室蜜蜂与浇水壶', { as: 'GreenhouseBee' }),
      layer('原稿场景角色_河中白鸭', { as: 'Duck' }),
    ], { bind: ['sceneBees', 'Node'], note: '装饰；向阳专属位置，其他园隐藏' }),
    group('UpgradeFx', [
      layer('树屋升级独立金光', { from: T03, as: 'Glow' }),
      layer('树屋升级等级反馈', { from: T03, as: 'LevelUp', bind: 'upgradeLevelLabel' }),
      layer('本次升级已扣花蜜', { from: T03, as: 'Spent', bind: 'spentLabel' }),
    ], { active: false, bind: ['upgradeFx', 'Node'] }),
    hud.standardHud('当前主线等级'),
    group('Title', [
      layer('花园标题无字木牌', { as: 'Sign' }),
      layer('当前花园名称', { as: 'Name', bind: 'themeNameLabel', key: 'hg.garden.theme.sunny', note: 'setKey(hg.garden.theme.<theme>)' }),
      group('BtnHelp', [layer('建造帮助', { as: 'Bg' }), layer('帮助符号', { as: 'Mark' })], { button: 'onHelp' }),
    ], { align: 'top' }),
    group('SideEntries', [
      group('BtnAlbum', [layer('旅行相册入口', { as: 'Icon' }), layer('相册入口文案', { as: 'Text' })], { button: 'onAlbum' }),
      group('BtnTasks', [layer('任务入口', { as: 'Icon' }), layer('任务入口文案', { as: 'Text' })], { button: 'onTasks' }),
      group('BtnWorldMap', [
        sprite('Icon', 'PNG/公共UI/金色关卡盾牌母件_747dc74440.png', [745, 486, 80, 76]),
        label('Text', 'block.000a71cd764f.text.5ce2d4cc8539', [735, 566, 102, 38], { size: 23, color: [101, 61, 32], bold: true, align: 'center', outline: [255, 248, 223], outlineWidth: 2 }),
      ], { button: 'onWorldMap', note: '设计稿无此入口，按相册/任务样式补位' }),
    ], { align: 'top' }),
    group('Bottom', [
      layer('花园总进度无字面板', { as: 'Panel' }),
      layer('花园25阶总进度底轨', { as: 'Track' }),
      layer('花园25阶总进度填充', { as: 'Fill', bind: 'totalFill', fill: true, note: 'fillRange = 总等级/25' }),
      layer('花园总状态文案', { as: 'Summary', bind: 'summaryLabel', key: 'hg.garden.summary.building' }),
      layer('花园总等级', { as: 'Total', bind: 'totalLabel' }),
      layer('返回综合地图', { as: 'BtnBack', button: 'onBack' }),
      layer('整园完工礼物', { as: 'ChapterReward', button: 'onChapterReward', bind: ['chapterReward', 'Node'] }),
    ], { align: 'bottom' }),
  ],
};
