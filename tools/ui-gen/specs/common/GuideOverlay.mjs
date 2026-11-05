import { layer, layers, group } from '../../lib/dsl.mjs';

const STEPS = ['T51-01_引导_01主界面进入建设', 'T51-02_引导_02首次建造', 'T51-03_引导_03返回地图闯关', 'T51-04_引导_04整块拖放',
  'T51-05_引导_05成功收获回家', 'T51-06_引导_06再次升级', 'T51-07_引导_07自由探索', 'T51-08_引导_08无尽首次消除'];
const S1 = STEPS[0];

export default {
  name: 'GuideOverlay', bundle: 'common', kind: 'popup', script: 'game/features/common/GuideOverlay', title: '事件式新手引导层（8 步数据驱动）',
  layer: 'Guide', queue: 'None', transition: 'none',
  source: S1,
  doc: { args: '{ step: 1..8, tipKey, tipY, fingerPos, arrow?, dragGhost? }（引导步骤数据放配置）', sources: STEPS.slice(1), features: 'F048、F049',
    dynamic: 'Tip 位置与文案、Finger/Arrow 位置按步骤数据设置；Step 用 key 参数 {value_1}/{value_2} 显示「当前 / 8」',
    states: 'masks[0..7] 每步一张烘焙聚光遮罩（原稿逐步出图），只显示当前步；Arrow、DragGhost 仅第 4/8 步显示。待确认：Backdrop 的 BlockInputEvents 会拦截高亮目标的点击，脚本需关闭它并自行做挖孔命中透传',
    fx: 'FX-07' },
  backdrop: [],
  children: [
    group('Masks', STEPS.map((from, i) => layer('引导聚光遮罩', { from, as: `Mask${i + 1}`, active: i === 0, bindArray: 'masks' }))),
    group('DragGhost', [layers(/^整块拖影_格/, { from: STEPS[3] })], { active: false, bind: ['dragGhost', 'Node'] }),
    group('Tip', [
      layer('引导原生木纹提示框', { as: 'Frame' }),
      layer('引导原生奶油内衬', { as: 'Lining' }),
      layer('引导短句', { as: 'Text', bind: 'tipLabel' }),
    ], { bind: ['tip', 'Node'] }),
    layer('整块拖放方向', { from: STEPS[3], as: 'Arrow', active: false, bind: ['arrow', 'Node'] }),
    layer('引导手指', { as: 'Finger', bind: ['finger', 'Node'] }),
    group('Bottom', [
      layer('引导步骤', { as: 'Step', bind: 'stepLabel' }),
      layer('跳过引导', { as: 'Skip', button: 'onSkip' }),
    ], { align: 'bottom' }),
  ],
};
