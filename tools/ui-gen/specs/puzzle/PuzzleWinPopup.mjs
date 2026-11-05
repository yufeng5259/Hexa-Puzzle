import { layer, group, frameRef } from '../../lib/dsl.mjs';

const T07 = 'T07-01_限步星级结算';

export default {
  name: 'PuzzleWinPopup', bundle: 'puzzle', kind: 'popup', script: 'game/features/puzzle/PuzzleWinPopup', title: '拼图胜利结算（普通/限步星级）',
  source: 'T06-01_普通拼图成功',
  doc: { args: '{ level, mode, reward, stars, bestStars, bonusAd }', sources: [T07], features: 'F014、F015、F056',
    states: 'Stars/StarLight（限步关显示）、Best（限步关显示历史最佳）、BtnBonusAd（无额度或已领时隐藏）；标题 key 普通「闯关成功」/限步「挑战完成」', fx: 'FX-01、FX-03、FX-11' },
  props: { emptyStar: frameRef('PNG/补充/R-05_结算空星.png'), challengeTitleKey: 'block.5a183ef06031.text.5ce2d4cc8539' },
  backdrop: [layer('完整裸背景', { as: 'Background' })],
  children: [
    group('Hud', [
      group('Avatar', [layer('蜂友头像', { as: 'Frame' }), layer('玩家主线进度', { as: 'Level', bind: 'levelLabel' })], { button: 'onAvatar' }),
      group('Honey', [layer('花蜜数量底条', { as: 'Bar' }), layer('花蜜图标', { as: 'Icon' }), layer('花蜜数量', { as: 'Count', bind: 'honeyLabel' })]),
      group('Hints', [layer('提示数量底条', { as: 'Bar' }), layer('提示灯泡', { as: 'Icon' }), layer('提示库存', { as: 'Count', bind: 'hintLabel' })]),
      layer('设置', { as: 'Settings', button: 'onSettings' }),
    ], { script: 'game/features/common/TopHud', align: 'top' }),
    layer('结算原尺寸完整主框', { as: 'Panel' }),
    layer('挑战星光', { from: T07, as: 'StarLight', active: false, bind: ['starLight', 'Node'] }),
    group('Stars', [
      layer('成绩星1', { from: T07, as: 'Star1', bindArray: 'stars' }),
      layer('成绩星2', { from: T07, as: 'Star2', bindArray: 'stars' }),
      layer('成绩星3', { from: T07, as: 'Star3', bindArray: 'stars' }),
    ], { active: false, bind: ['starsRow', 'Node'], note: '空星由脚本换 R-05' }),
    layer('不同姿态原主图飞行员蜜蜂', { as: 'PilotBee', bind: ['pilotBee', 'Node'] }),
    group('Title', [layer('左花叶', { as: 'LeafL' }), layer('右花叶', { as: 'LeafR' }), layer('结算原生红飘带', { as: 'Ribbon' }), layer('页面标题', { as: 'Text', bind: 'titleLabel' })]),
    layer('关号', { as: 'Level', bind: 'levelLabel' }),
    group('Reward', [layer('原尺寸奖励卡', { as: 'Card' }), layer('本次花蜜', { as: 'Icon' }), layer('本次实际奖励', { as: 'Amount', bind: 'rewardLabel' })]),
    layer('历史最佳', { from: T07, as: 'Best', active: false, bind: 'bestLabel' }),
    layer('已到账', { as: 'Claimed' }),
    group('BtnNext', [layer('下一关_原生按钮', { as: 'Bg' }), layer('下一关_文案', { as: 'Text' })], { button: 'onNext' }),
    group('BtnBonusAd', [layer('视频加领 +40_原生按钮', { as: 'Bg' }), layer('视频加领 +40_文案', { as: 'Text', bind: 'bonusAdLabel' })], { button: 'onBonusAd', bind: ['bonusAdButton', 'Node'] }),
    layer('原结算欢呼蜜蜂', { as: 'CheerBee' }),
    group('Bottom', [layer('返回上一页', { as: 'BtnBack', button: 'onBack' }), layer('回家园', { as: 'BtnHome', button: 'onHome' })], { align: 'bottom' }),
  ],
};
