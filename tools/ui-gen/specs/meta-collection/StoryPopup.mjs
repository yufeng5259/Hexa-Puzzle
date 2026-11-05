import { group, layer } from '../../lib/dsl.mjs';
import { backRow, hud, woodTitle } from './_shared.mjs';

const STEP_X = [112, 327, 542];
const STEP_ICONS = ['故事_种下花籽_完整原生苗圃', 'block_建造界面_温室蜜蜂与浇水壶', 'block_结算_标题左花叶'];

export default {
  name: 'StoryPopup', group: 'meta', bundle: 'meta', kind: 'popup', script: 'game/features/collection/StoryPopup',
  title: '章节剧情 / 蜂友故事（三步，可回看）',
  source: 'T19-01_蜂友章节剧情与回看',
  doc: {
    args: '{ storyId }（story.json 中的 chapter.* 或 bee.*）', features: 'F037',
    dynamic: '主图（章节 R-17 剧情图 / 蜂友立绘）、标题、副标题、三步文字全部来自 bundles/meta/config/story.json + 语言表 story.*；三步配图 StepIcon 可在 story.json 中按步配置',
    states: '章节剧情：主按钮「继续」(onContinue) 回新园，返回=稍后；蜂友故事：主按钮「回蜂友成长」。主按钮文案 key 由脚本切换',
    fx: '—',
  },
  backdrop: [layer('完整裸背景', { as: 'Background' })],
  children: [
    hud(),
    woodTitle('titleLabel'),
    layer('原生完整主框', { as: 'Panel' }),
    layer('页面副标题', { as: 'Subtitle', bind: 'subtitleLabel' }),
    layer('角色主体', { as: 'Image', bind: 'image' }),
    ...[0, 1, 2].map(i => group(`Step${i}`, [
      layer(`故事原生画格${i}`, { as: 'Frame' }),
      layer(STEP_ICONS[i], { as: 'Icon', bindArray: 'stepIcons' }),
      layer(`故事步骤${i + 1}`, { as: 'Text', bindArray: 'stepLabels' }),
    ], { rect: [STEP_X[i], 971, 201, 290] })),
    layer('可回看说明', { as: 'Note' }),
    group('BtnContinue', [layer('回蜂友成长_原生按钮', { as: 'Bg' }), layer('回蜂友成长_文案', { as: 'Text', bind: 'continueLabel' })], { button: 'onContinue' }),
    backRow(),
  ],
};
