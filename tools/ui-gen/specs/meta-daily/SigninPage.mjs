import { layer, group, label, sprite } from '../../lib/dsl.mjs';
import { hud, ribbonTitle, back, btn } from './_shared.mjs';

const CELL = 'game/features/daily/SigninCell';
const R11 = state => `PNG/补充/R-11_签到格_${state}.png`;
const STATE_KEYS = 'hg.daily.signin_claimable / signin_claimed / signin_waiting';

/**
 * Days 1–6: grid cells. States are the R-11 cell backgrounds (states[] = 可领, 已领, 未到).
 * Only day 3 carries a hint bonus in the art; the others get a hidden copy at the same offset.
 */
const cell = i => {
  const x = 111 + 215 * (i % 3), y = 520 + 282 * Math.floor(i / 3);
  const rect = [x, y, 201, 198];
  const hasHint = i === 2;
  return group(`Day${i + 1}`, [
    sprite('BgClaimable', R11('可领'), rect, { bindArray: 'states', active: false }),
    sprite('BgClaimed', R11('已领'), rect, { bindArray: 'states', active: false }),
    sprite('BgLocked', R11('未到'), rect, { bindArray: 'states' }),
    layer(`签到天${i}`, { as: 'Day', bind: 'dayLabel' }),
    layer('honey', { index: i, as: 'HoneyIcon' }),
    layer(`签到花蜜${i}`, { as: 'Honey', bind: 'honeyLabel' }),
    hasHint
      ? group('Hint', [layer('bulb', { index: 0, as: 'Icon' }), layer('签到提示2', { as: 'Count', bind: 'hintLabel' })], { bind: ['hint', 'Node'] })
      : group('Hint', [
        sprite('Icon', 'PNG/公共素材/灯泡道具_6e6583c917.png', [x + 27, y + 144, 36, 46]),
        label('Count', null, [x + 67, y + 147, 72, 44], { size: 24, bold: true }, { text: '+1', bind: 'hintLabel' }),
      ], { active: false, bind: ['hint', 'Node'] }),
    i < 2
      ? layer('check', { index: i, as: 'Check', bind: ['check', 'Node'] })
      : sprite('Check', 'PNG/公共UI/完成勾_4503fe8356.png', [x + 138, y + 160, 55, 48], { active: false, bind: ['check', 'Node'] }),
    layer(`签到状态${i}`, { as: 'State', bind: 'stateLabel', note: STATE_KEYS }),
  ], { script: CELL, bindArray: 'days' });
};

/** Day 7: wide row. states[] = 可领 (big gift), 已领 (picnic hat revealed), 未到 (big gift). */
const day7 = group('Day7', [
  layer('第7天原生任务行', { as: 'Bg' }),
  sprite('GiftClaimable', 'PNG/补充/R-11_第7天大礼盒.png', [554, 1110, 116, 116], { bindArray: 'states', active: false }),
  layer('outfit_picnic_hat', { as: 'Outfit', bindArray: 'states', active: false }),
  sprite('GiftLocked', 'PNG/补充/R-11_第7天大礼盒.png', [554, 1110, 116, 116], { bindArray: 'states' }),
  layer('签到天6', { as: 'Day', bind: 'dayLabel' }),
  layer('honey', { index: 6, as: 'HoneyIcon' }),
  layer('签到花蜜6', { as: 'Honey', bind: 'honeyLabel' }),
  group('Hint', [layer('bulb', { index: 1, as: 'Icon' }), layer('签到提示6', { as: 'Count', bind: 'hintLabel' })], { bind: ['hint', 'Node'] }),
  sprite('Check', 'PNG/公共UI/完成勾_4503fe8356.png', [684, 1110, 44, 38], { active: false, bind: ['check', 'Node'] }),
  label('State', 'hg.daily.signin_waiting', [500, 1212, 230, 36], { size: 24, bold: true, color: [101, 61, 32] }, { bind: 'stateLabel', note: STATE_KEYS }),
], { script: CELL, bindArray: 'days' });

export default {
  name: 'SigninPage', group: 'meta', bundle: 'meta', kind: 'page', script: 'game/features/daily/SigninPage', title: '七日礼物：累计签到',
  source: 'T32-01_七日礼物',
  doc: {
    args: '无', features: 'F043',
    dynamic: '7 个 SigninCell（days[0..6]）：天数、花蜜、提示加成、状态文字随签到进度刷新',
    states: 'SigninCell.states[可领, 已领, 未到] 三选一；Check 已领；Hint 仅有提示奖励的天显示；第 7 天已领时显示野餐帽，否则显示 R-11 大礼盒',
    fx: 'FX-04（签到领取）、FX-03',
  },
  children: [
    layer('完整裸背景', { as: 'Background' }),
    hud(),
    layer('原生完整主框', { as: 'Panel' }),
    ribbonTitle(),
    layer('页面副标题', { as: 'Subtitle' }),
    group('Days', [0, 1, 2, 3, 4, 5].map(cell)),
    day7,
    layer('签到尾注', { as: 'Note' }),
    btn('BtnClaim', '收下今日礼物_原生按钮', '收下今日礼物_文案', 'onClaim', { bind: ['claimButton', 'Node'] }),
    back([layer('原每日奖励抱罐蜂', { as: 'Bee' })]),
  ],
};
