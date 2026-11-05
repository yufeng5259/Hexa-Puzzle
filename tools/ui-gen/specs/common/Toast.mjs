import { sprite, label, group } from '../../lib/dsl.mjs';

export default {
  name: 'Toast', bundle: 'common', kind: 'popup', script: 'game/features/common/Toast', title: '飘字提示',
  layer: 'Toast', queue: 'None', transition: 'none',
  doc: { args: '{ textKey, params? }（显示后自动关闭）', features: 'F002',
    dynamic: '文案 hg.common.toast 的 {text} 由调用方填入已本地化文本',
    states: '待确认：Backdrop 带 BlockInputEvents，飘字不应拦截输入，脚本需在 onLoad 关闭 backdrop',
    fx: 'FX-12' },
  backdrop: [],
  children: [
    group('Bar', [
      sprite('Bg', 'PNG/公共UI/玩法提示条_5183e546c4.png', [118, 880, 618, 84]),
      label('Text', 'hg.common.toast', [145, 890, 563, 64], { size: 28, color: [101, 61, 32], bold: true }, { bind: 'textLabel' }),
    ], { bind: ['bar', 'Node'] }),
  ],
};
