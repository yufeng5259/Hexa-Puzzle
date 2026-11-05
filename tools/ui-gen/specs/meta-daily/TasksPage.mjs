import { layer, group, sprite } from '../../lib/dsl.mjs';
import { hud, ribbonTitle, back, btn } from './_shared.mjs';

const ROW = 'game/features/daily/TaskRow';

/** One task row; rows are 222px apart starting at y=542. */
const row = i => {
  const y = 542 + 222 * i;
  return group(`Task${i + 1}`, [
    layer(`每日任务原生行${i}`, { as: 'Bg' }),
    group('Done', [layer(`完成厚底${i}`, { as: 'Base' }), layer('check', { index: i, as: 'Check', bind: ['doneMark', 'Node'] })]),
    layer(`任务${i}`, { as: 'Title', bind: 'titleLabel', note: '任务 key 由脚本按当日任务设置' }),
    layer(`进度${i}`, { as: 'Progress', bind: 'progressLabel' }),
    layer('honey', { index: i, as: 'HoneyIcon' }),
    layer(`任务奖励${i}`, { as: 'Reward', bind: 'rewardLabel' }),
    group('BtnClaim', [layer('领取_原生按钮', { index: i, as: 'Bg' }), layer('领取_文案', { index: i, as: 'Text' })], { button: 'onClaim', bind: ['claimButton', 'Node'] }),
    sprite('Claimed', 'PNG/公共UI/已领取按钮_c0fa067b27.png', [516, y + 91, 198, 59], { active: false, bind: ['claimedMark', 'Node'] }),
    sprite('Locked', 'PNG/公共UI/模式锁_be4f044685.png', [594, y + 96, 43, 48], { active: false, bind: ['lockedMark', 'Node'] }),
  ], { script: ROW, bindArray: 'rows' });
};

export default {
  name: 'TasksPage', group: 'meta', bundle: 'meta', kind: 'page', script: 'game/features/daily/TasksPage', title: '每日奖励：三任务与周目标、七日礼物入口',
  source: 'T29-01_三任务与周签到入口',
  doc: {
    args: '无', features: 'F041、F042、F043',
    dynamic: '3 行任务（TaskRow 组件）：标题 key、进度、奖励随当日任务刷新',
    states: 'TaskRow：Done/Check 完成勾、BtnClaim 可领、Claimed 已领、Locked 未解锁（四选一）；设计无进度条，进度用文字',
    fx: 'FX-03（领取花蜜飞向 HUD）',
  },
  children: [
    layer('完整裸背景', { as: 'Background' }),
    hud(),
    layer('原生完整主框', { as: 'Panel' }),
    ribbonTitle(),
    group('Tasks', [row(0), row(1), row(2)]),
    btn('BtnWeekly', '每周目标_原生按钮', '每周目标_文案', 'onWeekly'),
    btn('BtnSignin', '七日礼物_原生按钮', '七日礼物_文案', 'onSignin'),
    btn('BtnMap', '回到地图_原生按钮', '回到地图_文案', 'onMap'),
    back([layer('原每日任务抱罐蜂', { as: 'Bee' })]),
  ],
};
