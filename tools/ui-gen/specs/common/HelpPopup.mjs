import { layer, layers, group } from '../../lib/dsl.mjs';
import { hudB } from './_hud.mjs';

const CAT = 'T40-01_图示帮助_目录';
const PUZ = 'T40-02_图示帮助_拖放拼图';
const END = 'T40-03_图示帮助_三轴消除';
const BLD = 'T40-04_图示帮助_五级建设';

const entry = (i, title, thumb, data) => group(`Entry${i}`, [
  layer('无字面板_cream', { from: CAT, index: i, as: 'Panel' }),
  thumb,
  layer(title, { from: CAT, as: 'Title' }),
  group('BtnLearn', [layer('看图学习_无字按钮', { from: CAT, index: i, as: 'Bg' }), layer('看图学习_文案', { from: CAT, index: i, as: 'Text' })], { button: 'onOpenArticle', data }),
]);
const head = from => [layer('完整裸背景', { from, as: 'Background' }), layer('原生花叶木牌', { from, as: 'Plank' }), layer('页面标题', { from, as: 'Title' })];
const tryBack = from => group('Bottom', [
  group('BtnTry', [layer('我来试试_无字按钮', { from, as: 'Bg' }), layer('我来试试_文案', { from, as: 'Text' })], { button: 'onTry' }),
  group('BtnReturn', [layer('返回_无字按钮', { from, as: 'Bg' }), layer('返回_文案', { from, as: 'Text' })], { button: 'onCatalog' }),
], { align: 'bottom' });

export default {
  name: 'HelpPopup', bundle: 'common', kind: 'popup', script: 'game/features/common/HelpPopup', title: '图示帮助（目录 + 拖放拼图 / 满线消除 / 五级建设）',
  source: CAT,
  doc: { args: "{ article?: 'puzzle' | 'endless' | 'build' }（无参数显示目录）", sources: [PUZ, END, BLD], features: 'F046',
    dynamic: '无；图示为静态示意（缩略棋盘取页面配置中的格子图层，木框投影为程序生成层，未出图）',
    states: 'Catalog 与 articles[0..2]（puzzle、endless、build）互斥显示；各状态自带背景、木牌与标题', fx: 'FX-07（示意动画）' },
  children: [
    group('Catalog', [
      ...head(CAT),
      layer('帮助目录说明', { from: CAT, as: 'Intro' }),
      entry(0, '拼图拖放_目录标题', group('Thumb', [layers(/^帮助缩略0_(凹槽|障碍标记)/, { from: CAT })]), 'puzzle'),
      entry(1, '满线消除_目录标题', group('Thumb', [layers(/^帮助缩略1_(凹槽|落地)/, { from: CAT })]), 'endless'),
      entry(2, '家园建设_目录标题', layer('建设蜂友引导', { from: CAT, as: 'Thumb' }), 'build'),
      group('BtnReturn', [layer('返回设置_无字按钮', { from: CAT, as: 'Bg' }), layer('返回设置_文案', { from: CAT, as: 'Text' })], { button: 'onBack', align: 'bottom' }),
    ], { bind: ['catalog', 'Node'] }),
    group('Puzzle', [
      ...head(PUZ),
      layer('无字面板_cream', { from: PUZ, as: 'Panel' }),
      layer('第一步', { from: PUZ, as: 'Step1' }),
      group('Source', [layers(/^教学整块源_/, { from: PUZ })]),
      layer('第二步', { from: PUZ, as: 'Step2' }),
      group('Target', [layers(/^教学真实目标_(凹槽|障碍标记)/, { from: PUZ })]),
      layer('整块拖放方向', { from: PUZ, as: 'Arrow' }),
      layer('操作限制', { from: PUZ, as: 'Rule' }),
      tryBack(PUZ),
    ], { active: false, bindArray: 'articles' }),
    group('Endless', [
      ...head(END),
      layer('无尽教学动作', { from: END, as: 'Steps' }),
      layer('无字面板_cream', { from: END, as: 'Panel' }),
      group('Axes', [layers(/^三轴方向_/, { from: END })]),
      group('Board', [layers(/^三轴真实37格演示_(凹槽|落地)/, { from: END })]),
      layer('最后一格拖影', { from: END, as: 'Ghost' }),
      layer('补齐最后一格', { from: END, as: 'Arrow' }),
      layer('三方向说明', { from: END, as: 'Rule' }),
      layer('整线加分', { from: END, as: 'Score' }),
      tryBack(END),
    ], { active: false, bindArray: 'articles' }),
    group('Build', [
      ...head(BLD),
      layer('无字面板_cream', { from: BLD, as: 'Panel' }),
      layer('树屋真实第一阶', { from: BLD, as: 'Stage1' }),
      layer('树屋真实第二阶', { from: BLD, as: 'Stage2' }),
      layer('真实阶段提升', { from: BLD, as: 'StageArrow' }),
      layer('建设当前等级', { from: BLD, as: 'Lv1' }),
      layer('建设下一等级', { from: BLD, as: 'Lv2' }),
      group('BtnDemo', [layer('升级  40 花蜜_无字按钮', { from: BLD, as: 'Bg' }), layer('升级  40 花蜜_文案', { from: BLD, as: 'Text' })], { note: '示意按钮，无事件' }),
      layer('升级一级', { from: BLD, as: 'Arrow' }),
      layer('建设结果', { from: BLD, as: 'Result' }),
      group('Progress', [layer('原生五级进度容器', { from: BLD, as: 'Frame' }), layer('五级进度底轨', { from: BLD, as: 'Track' }),
        layer('真实2/5进度', { from: BLD, as: 'Fill' }), layer('五级进度数量', { from: BLD, as: 'Count' })]),
      layer('建设等级上限', { from: BLD, as: 'Rule' }),
      group('BtnOk', [layer('知道了_无字按钮', { from: BLD, as: 'Bg' }), layer('知道了_文案', { from: BLD, as: 'Text' })], { button: 'onCatalog', align: 'bottom' }),
    ], { active: false, bindArray: 'articles' }),
    hudB(CAT),
  ],
};
