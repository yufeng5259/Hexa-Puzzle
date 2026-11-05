import { layer, group } from '../../lib/dsl.mjs';
import hud from './_hud.cjs';

export default {
  name: 'ChapterCompletePopup', bundle: 'garden', kind: 'popup', script: 'game/features/garden/ChapterCompletePopup', title: '整园完工奖励（每园唯一一次）',
  source: 'T16-01_整园完工奖励',
  doc: {
    args: '{ chapter, honey, hints, claimed }', features: 'F026',
    dynamic: 'Photo 按园换图（向阳取本页合影，清风水湾/云上蜂谷取 meta/photos/<theme>_group）；ChapterName 参数 {name,value_1,value_2}；奖励数值',
    states: 'BtnClaim（已领取后隐藏，仅保留回家园）',
    fx: 'FX-01、FX-02、FX-03',
  },
  backdrop: [layer('完整裸背景', { as: 'Background' })],
  children: [
    hud.standardHud('当前主线等级'),
    group('Title', [
      layer('原好友左悬绳', { as: 'RopeL' }), layer('原好友右悬绳', { as: 'RopeR' }), layer('原好友无字标题木牌', { as: 'Sign' }),
      layer('页面标题', { as: 'Text' }),
    ]),
    layer('无字面板_cream', { as: 'Panel' }),
    layer('完工章节名称', { as: 'ChapterName', bind: 'chapterNameLabel', key: 'hg.garden.chapter_completion' }),
    layer('向阳花园本次整园合影', { as: 'Photo', bind: 'photo' }),
    group('Rewards', [
      layer('完工花蜜奖励图标', { as: 'HoneyIcon' }), layer('完工花蜜实奖', { as: 'Honey', bind: 'honeyLabel' }),
      layer('完工提示奖励图标', { as: 'HintIcon' }), layer('完工提示实奖', { as: 'Hints', bind: 'hintLabel' }),
    ]),
    layer('完工照片奖励说明', { as: 'PhotoNote' }),
    group('BtnClaim', [layer('收下完工礼物_无字按钮', { as: 'Bg' }), layer('收下完工礼物_文案', { as: 'Text' })], { button: 'onClaim', bind: ['claimButton', 'Node'] }),
    group('BtnHome', [layer('回家园_无字按钮', { as: 'Bg' }), layer('回家园_文案', { as: 'Text' })], { button: 'onHome' }),
    group('Bottom', [layer('返回', { as: 'BtnBack', button: 'onBack' })], { align: 'bottom' }),
  ],
};
