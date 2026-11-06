import { sprite, label, group } from '../../lib/dsl.mjs';

export default {
  name: 'Toast', bundle: 'common', kind: 'popup', script: 'game/features/common/Toast', title: '飘字提示',
  layer: 'Toast', queue: 'None', transition: 'none',
  doc: { args: '{ textKey, params? }（显示后自动关闭）', features: 'F002',
    dynamic: '文案 hg.common.toast 的 {text} 由调用方填入已本地化文本',
    states: '飘字不拦截输入',
    fx: 'FX-12' },
  backdropBlocks: false,
  backdrop: [],
  children: [
    group('Bar', [
      sprite('Bg', 'PNG/公共UI/玩法提示条_5183e546c4.png', [118, 880, 618, 84]),
      label('Text', 'hg.common.toast', [145, 890, 563, 64], { size: 29, color: [255, 248, 219], bold: true, outline: [64, 34, 14], outlineWidth: 2 }, { bind: 'textLabel' }),
    ], { bind: ['bar', 'Node'] }),
  ],
};
