import { layer, group, label, sprite, frameRef } from '../../lib/dsl.mjs';
import { hud, woodTitle, back } from './_shared.mjs';

const ROW = 'game/features/daily/AchievementRow';
const BADGES = ['拼图达人', '无尽高手', '花园旅人'];

/** Rows are 247px apart. Badge art is replaced by R-10 (set by the page from badgeFrames). */
const row = i => {
  const y = 549 + 247 * i;
  const [bg, text] = i === 0 ? ['收藏徽章_原生按钮', '收藏徽章_文案'] : ['去挑战_原生按钮', '去挑战_文案'];
  const idx = i === 0 ? undefined : i - 1;
  return group(`Achievement${i + 1}`, [
    layer(`成就原生木行${i}`, { as: 'Bg' }),
    sprite('Badge', `PNG/补充/R-10_成就_${BADGES[i]}_未达成.png`, [113, y + 2, 127, 127], { bind: 'badge' }),
    layer(`成就名${i}`, { as: 'Name', bind: 'nameLabel' }),
    layer(`成就进度${i}`, { as: 'Progress', bind: 'progressLabel' }),
    group('BtnAction', [layer(bg, { index: idx, as: 'Bg' }), layer(text, { index: idx, as: 'Text', bind: 'actionLabel', note: '收藏徽章 / 去挑战 / 已收藏' })],
      { button: 'onAction', bind: ['actionButton', 'Node'] }),
  ], { script: ROW, bindArray: 'rows' });
};

export default {
  name: 'AchievementPage', group: 'meta', bundle: 'meta', kind: 'page', script: 'game/features/daily/AchievementPage', title: '成就与本机纪录',
  source: 'T31-01_成就与本机纪录',
  doc: {
    args: '无', features: 'F044',
    dynamic: '3 行 AchievementRow：徽章（R-10 达成/未达成）、名称、进度、按钮文案；本机纪录行（无尽最高分、已通关数）',
    states: '徽章 badgeFrames[行×2：未达成, 达成]；BtnAction 可收藏/去挑战/已收藏（按钮文案 key 切换）',
    fx: 'FX-02（收藏徽章光效）',
  },
  props: {
    badgeFrames: BADGES.flatMap(n => [frameRef(`PNG/补充/R-10_成就_${n}_未达成.png`), frameRef(`PNG/补充/R-10_成就_${n}_达成.png`)]),
  },
  children: [
    layer('完整裸背景', { as: 'Background' }),
    hud(),
    layer('原生完整主框', { as: 'Panel' }),
    woodTitle(),
    layer('页面副标题', { as: 'Subtitle' }),
    group('Rows', [row(0), row(1), row(2)]),
    label('Records', 'hg.daily.local_records', [115, 1296, 623, 56], { size: 24, bold: true, color: [101, 61, 32] },
      { bind: 'recordsLabel', note: '参数{score,levels}' }),
    group('BtnHome', [layer('回主界面_原生按钮', { as: 'Bg' }), layer('回主界面_文案', { as: 'Text' })], { button: 'onHome' }),
    back(),
  ],
};
