import { group, layer } from '../../lib/dsl.mjs';
import { backRow, hud, ribbonTitle } from './_shared.mjs';

export default {
  name: 'WeeklyStampPopup', group: 'meta', bundle: 'meta', kind: 'popup', script: 'game/features/collection/WeeklyStampPopup',
  title: '每周纪念印记回看',
  source: 'T28-01_每周纪念回看',
  doc: {
    args: '{ weekKey }', features: 'F042',
    dynamic: '纪念日期（weekKey，数值文字）、达成条件（局数/活跃天数模板参数）',
    fx: 'FX-02',
  },
  backdrop: [layer('完整裸背景', { as: 'Background' })],
  children: [
    hud(),
    layer('纪念等比原生结算框', { as: 'Panel' }),
    ribbonTitle(),
    layer('stamp', { as: 'Stamp' }),
    layer('纪念编号', { as: 'Name' }),
    layer('纪念日期', { as: 'Date', bind: 'dateLabel' }),
    layer('纪念条件', { as: 'Condition', bind: 'conditionLabel' }),
    layer('已获得', { as: 'Owned' }),
    group('BtnTasks', [layer('回每日任务_原生按钮', { as: 'Bg' }), layer('回每日任务_文案', { as: 'Text' })], { button: 'onBack', note: '回每日任务 = 关闭' }),
    layer('纪念欢呼蜜蜂', { as: 'CheerBee' }),
    backRow(),
  ],
};
