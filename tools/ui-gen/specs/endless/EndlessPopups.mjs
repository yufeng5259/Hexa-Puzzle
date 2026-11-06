import { layer, group } from '../../lib/dsl.mjs';
import hud from '../garden/_hud.cjs';

export default [
  {
    name: 'EndlessIntroPopup', bundle: 'endless', kind: 'popup', script: 'game/features/endless/EndlessIntroPopup', title: '无尽入口：开始新局 / 继续未完成的一局',
    source: 'T11-01_无尽玩法入口',
    doc: {
      args: '{ hasActiveRun, score, best }', features: 'F029',
      dynamic: '分数（有保局时为该局分数，否则 0）、最高分',
      states: 'BtnStart 文案：有保局 key 原稿「继续这一局」，无保局 setKey(hg.endless.start)',
      fx: 'FX-12',
    },
    backdrop: [layer('完整裸背景', { as: 'Background' })],
    children: [
      hud.endlessHud(),
      group('Header', [
        group('Title', [layer('原生完整吊牌', { as: 'Sign' }), layer('无尽标题', { as: 'Text' })]),
        group('Score', [
          layer('原生木框玻璃计分板', { as: 'Panel' }),
          layer('当前得分标签', { as: 'ScoreCaption' }),
          layer('本局得分', { as: 'Score', bind: 'scoreLabel' }),
          layer('最高记录标签', { as: 'BestCaption' }),
          layer('最高记录值', { as: 'Best', bind: 'bestLabel' }),
        ]),
        layer('原生陪伴蜜蜂', { as: 'Bee' }),
        group('BtnRecords', [layer('排行榜按钮', { as: 'Icon' }), layer('本机纪录', { as: 'Text' })], { button: 'onRecords' }),
        group('BtnSupply', [layer('每日奖励按钮', { as: 'Icon' }), layer('每日奖励', { as: 'Text' })], { button: 'onSupply' }),
      ], { align: 'top' }),
      group('Bottom', [
        layer('原生玩法提示木条', { as: 'RuleBar' }),
        layer('无尽规则', { as: 'Rule' }),
        group('BtnStart', [layer('继续这一局_无字按钮', { as: 'Bg' }), layer('继续这一局_文案', { as: 'Text', bind: 'startLabel' })], { button: 'onStart' }),
      ], { align: 'bottom' }),
    ],
  },
  {
    name: 'EndlessRevivePopup', bundle: 'endless', kind: 'popup', script: 'game/features/endless/EndlessRevivePopup', title: '无尽无位置：收获结束或看视频清出空间续局',
    source: 'T12-01_无尽无位置续局',
    doc: {
      args: '{ honey, adAvailable }', features: 'F033、F055',
      dynamic: '本局可收花蜜',
      states: 'BtnClearAd（广告额度用完或本局已用过时隐藏）；本弹窗叠在 EndlessPage 上，只取 T12 遮罩以上的层',
      fx: 'FX-12',
    },
    backdrop: [layer('局内独立遮罩', { as: 'Mask' })],
    children: [
      layer('原生厚木边弹窗', { as: 'Panel' }),
      group('Title', [layer('弹窗左花叶', { as: 'LeafL' }), layer('弹窗右花叶', { as: 'LeafR' }), layer('原生弹窗木牌', { as: 'Sign' }), layer('弹窗标题', { as: 'Text' })]),
      layer('弹窗说明', { as: 'Desc' }),
      group('Reward', [
        layer('原生奖励卡', { as: 'Card' }), layer('实际收益图标', { as: 'Icon' }),
        layer('弹窗实际数值', { as: 'Amount', bind: 'honeyLabel' }), layer('弹窗数值说明', { as: 'Caption' }),
      ]),
      group('BtnHarvest', [layer('收获并结束_无字按钮', { as: 'Bg' }), layer('收获并结束_文案', { as: 'Text' })], { button: 'onHarvest' }),
      group('BtnClearAd', [layer('视频 · 清出空间_无字按钮', { as: 'Bg' }), layer('视频 · 清出空间_文案', { as: 'Text' })], { button: 'onClearAd', bind: ['clearAdButton', 'Node'] }),
    ],
  },
  {
    name: 'EndlessResultPopup', bundle: 'endless', kind: 'popup', script: 'game/features/endless/EndlessResultPopup', title: '无尽成绩结算',
    source: 'T14-01_无尽成绩结算',
    doc: {
      args: '{ score, best, newRecord, honey, bonusAd }', features: 'F031、F034、F056',
      dynamic: '本局分数（千分位）、本机最高 {count}、实际花蜜（受每日上限 240）',
      states: 'Trophy（刷新纪录时显示）；标题 newRecord 用原稿「刷新纪录」，否则 setKey(hg.endless.result_title)；BtnBonusAd（无额度或已领时隐藏）',
      fx: 'FX-01、FX-03',
    },
    backdrop: [layer('完整裸背景', { as: 'Background' })],
    children: [
      hud.standardHud('玩家主线进度'),
      layer('结算原尺寸主框', { as: 'Panel' }),
      layer('纪录奖杯', { as: 'Trophy', bind: ['trophy', 'Node'] }),
      group('Title', [layer('左花叶', { as: 'LeafL' }), layer('右花叶', { as: 'LeafR' }), layer('结算原生红飘带', { as: 'Ribbon' }), layer('页面标题', { as: 'Text', bind: 'titleLabel' })]),
      layer('本局得分标签', { as: 'ScoreCaption' }),
      layer('本局分数', { as: 'Score', bind: 'scoreLabel' }),
      layer('本机最高', { as: 'Best', bind: 'bestLabel' }),
      group('Reward', [layer('花蜜奖励卡', { as: 'Card' }), layer('honey', { as: 'Icon', bind: 'rewardIcon' }), layer('实际花蜜', { as: 'Amount', bind: 'rewardLabel' }), layer('已到账', { as: 'Claimed' })]),
      group('BtnAgain', [layer('再来一局_原生按钮', { as: 'Bg' }), layer('再来一局_文案', { as: 'Text' })], { button: 'onAgain' }),
      group('BtnBonusAd', [layer('视频加领 +60_原生按钮', { as: 'Bg' }), layer('视频加领 +60_文案', { as: 'Text', bind: 'bonusAdLabel' })], { button: 'onBonusAd', bind: ['bonusAdButton', 'Node'] }),
      layer('纪录庆祝小蜜', { as: 'CheerBee' }),
      group('Bottom', [layer('返回上一页', { as: 'BtnBack', button: 'onBack' })], { align: 'bottom' }),
    ],
  },
];
