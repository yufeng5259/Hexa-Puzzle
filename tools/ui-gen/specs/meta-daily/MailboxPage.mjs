import { layer, group, list, sprite } from '../../lib/dsl.mjs';
import { hud, woodTitle, back } from './_shared.mjs';

export default [
  {
    name: 'MailboxPage', group: 'meta', bundle: 'meta', kind: 'page', script: 'game/features/daily/MailboxPage', title: '小蜜的信箱（本地信件）',
    source: 'T48-01_本地信箱',
    doc: {
      args: '无', features: 'F050',
      dynamic: 'Mails：信件列表（MailRow，数量随本地信件变化，ScrollableItemGrid）',
      states: 'Empty：无信件时显示大信封插画与说明',
    },
    children: [
      layer('完整裸背景', { as: 'Background' }),
      hud(),
      layer('原生完整主框', { as: 'Panel' }),
      woodTitle(),
      layer('页面副标题', { as: 'Subtitle' }),
      layer('envelope', { index: 0, as: 'Envelope', bind: ['envelope', 'Node'] }),
      list('Mails', [99, 880, 656, 290], 'MailRow', { spacingY: 12, bind: 'mails' }),
      layer('无附件', { as: 'NoAttachment' }),
      group('BtnRead', [layer('阅读信件_原生按钮', { as: 'Bg' }), layer('阅读信件_文案', { as: 'Text' })],
        { button: 'onReadLatest', bind: ['readButton', 'Node'], note: '打开最新未读信件' }),
      back([layer('角色主体', { as: 'Bee' }), layer('角色主体_独立晴天围巾', { as: 'Scarf' })]),
    ],
  },
  {
    name: 'MailRow', group: 'meta', bundle: 'meta', kind: 'cell', script: 'game/features/daily/MailRow', title: '信件行',
    source: 'T48-01_本地信箱', rect: [99, 957, 656, 141],
    doc: { args: 'onRefresh({ mailId, titleKey, read })', features: 'F050', states: 'Unread / Read 信封二选一（R-13）；状态文字 key 新信件/已读' },
    children: [
      layer('信箱原生消息行', { as: 'Bg', button: 'onOpen' }),
      group('Envelope', [
        sprite('Unread', 'PNG/补充/R-13_信封_未读.png', [114, 975, 116, 95], { bind: ['unreadIcon', 'Node'] }),
        sprite('Read', 'PNG/补充/R-13_信封_已读.png', [114, 975, 116, 95], { bind: ['readIcon', 'Node'], active: false }),
      ]),
      layer('信件标题', { as: 'Title', bind: 'titleLabel' }),
      layer('已读状态', { as: 'Status', bind: 'statusLabel', note: 'key hg.daily.mail_unread / mail_read' }),
    ],
  },
];
