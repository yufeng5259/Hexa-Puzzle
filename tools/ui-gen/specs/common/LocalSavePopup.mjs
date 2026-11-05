import { layer, group, sprite } from '../../lib/dsl.mjs';
import { hudA } from './_hud.mjs';

export default {
  name: 'LocalSavePopup', bundle: 'common', kind: 'popup', script: 'game/features/common/LocalSavePopup', title: '本地存档摘要',
  source: 'T46-01_本地存档',
  doc: { args: '无；读取存档摘要', features: 'F065、F017、F013',
    dynamic: '关卡与园（参数见 key）、存档状态、建设进度、花蜜数',
    states: 'BtnContinue（无未完成拼图局时隐藏）' },
  backdrop: [layer('完整裸背景', { as: 'Background' })],
  children: [
    hudA(),
    layer('原生完整主框', { as: 'Panel' }),
    layer('左标题吊绳', { as: 'RopeL' }),
    layer('右标题吊绳', { as: 'RopeR' }),
    layer('好友系原生标题木牌', { as: 'Plank' }),
    layer('页面标题', { as: 'Title' }),
    layer('页面副标题', { as: 'Subtitle' }),
    sprite('SaveIcon', 'PNG/补充/R-13_图标_存档.png', [346, 563, 160, 160], { note: '原稿为主页按钮占位，按 R-13 换存档图标' }),
    layer('存档关园', { as: 'Progress', bind: 'progressLabel' }),
    layer('存档状态', { as: 'Status', bind: 'statusLabel' }),
    group('Record', [layer('存档原生记录行', { as: 'Board' }), layer('建设进度', { as: 'Build', bind: 'buildLabel' }),
      layer('honey', { as: 'HoneyIcon' }), layer('存档花蜜', { as: 'Honey', bind: 'honeyLabel' })]),
    layer('本地说明', { as: 'Note' }),
    group('BtnSave', [layer('保存当前进度_原生按钮', { as: 'Bg' }), layer('保存当前进度_文案', { as: 'Text' })], { button: 'onSave' }),
    group('BtnContinue', [layer('继续上次一局_原生按钮', { as: 'Bg' }), layer('继续上次一局_文案', { as: 'Text' })], { button: 'onContinue', bind: ['continueButton', 'Node'] }),
    layer('返回上一页', { as: 'BtnBack', button: 'onBack', align: 'bottom' }),
  ],
};
