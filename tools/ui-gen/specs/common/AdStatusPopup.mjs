import { layer, group, sprite, label } from '../../lib/dsl.mjs';

const LOAD = 'T42-01_激励广告加载';
const NONE = 'T43-01_广告暂无可用';
const WAIT = 'T44-01_广告奖励确认中';
const COOL = 'T45-01_视频冷却倒计时';

const cancel = from => group('BtnContinue', [layer('继续游戏_原生按钮', { from, as: 'Bg' }), layer('继续游戏_文案', { from, as: 'Text' })], { button: 'onCancel' });

export default {
  name: 'AdStatusPopup', bundle: 'common', kind: 'popup', script: 'game/features/common/AdStatusPopup', title: '激励视频状态（加载 / 暂无 / 确认中 / 冷却）',
  source: LOAD,
  doc: { args: "{ state: 'loading' | 'unavailable' | 'confirming' | 'cooldown', rewardKey?, amount?, cooldownSeconds? }", sources: [NONE, WAIT, COOL],
    features: 'F052、F053–F057',
    dynamic: '奖励文字（参数见 key）、冷却倒计时 mm:ss',
    states: 'states[0..3] = Loading、Unavailable、Confirming、Cooldown 互斥显示。Cooldown 由小窗母版组合（T45 原稿为每日补给页按钮冷却态，页面本身归 SupplyPopup）',
    fx: 'FX-08' },
  backdrop: [layer('局内独立遮罩', { as: 'Mask' })],
  children: [
    layer('小结算提示窗', { as: 'Panel' }),
    group('Loading', [
      layer('弹窗标题', { from: LOAD, as: 'Title' }),
      layer('clock', { from: LOAD, as: 'Clock' }),
      layer('bulb', { from: LOAD, as: 'Bulb' }),
      layer('广告请求奖励', { from: LOAD, as: 'Reward', bind: 'loadingRewardLabel' }),
      layer('广告说明', { from: LOAD, as: 'Desc' }),
      cancel(LOAD),
    ], { active: false, bindArray: 'states' }),
    group('Unavailable', [
      layer('弹窗标题', { from: NONE, as: 'Title' }),
      layer('角色主体', { from: NONE, as: 'Bee' }),
      layer('广告说明', { from: NONE, as: 'Desc' }),
      cancel(NONE),
      group('BtnRetry', [layer('稍后再试_原生按钮', { from: NONE, as: 'Bg' }), layer('稍后再试_文案', { from: NONE, as: 'Text' })], { button: 'onRetry' }),
    ], { active: false, bindArray: 'states' }),
    group('Confirming', [
      layer('弹窗标题', { from: WAIT, as: 'Title' }),
      layer('clock', { from: WAIT, as: 'Clock' }),
      layer('bulb', { from: WAIT, as: 'Bulb' }),
      layer('广告请求奖励', { from: WAIT, as: 'Reward', bind: 'confirmRewardLabel' }),
      layer('广告说明', { from: WAIT, as: 'Desc' }),
      cancel(WAIT),
    ], { active: false, bindArray: 'states' }),
    group('Cooldown', [
      label('Title', 'hg.common.ad_cooldown_title', [174, 542, 505, 106], { size: 43, color: [101, 61, 32], bold: true }),
      sprite('Clock', 'PNG/公共UI/clock_f640cf5adc.png', [337, 671, 178, 183]),
      label('Countdown', null, [174, 880, 505, 90], { size: 56, color: [101, 61, 32], bold: true }, { text: '2:00', bind: 'cooldownLabel' }),
      label('Desc', 'hg.common.ad_cooldown_desc', [178, 987, 497, 90], { size: 27, color: [101, 61, 32] }),
      cancel(LOAD),
    ], { active: false, bindArray: 'states', note: '组合态：无独立原稿' }),
  ],
};
