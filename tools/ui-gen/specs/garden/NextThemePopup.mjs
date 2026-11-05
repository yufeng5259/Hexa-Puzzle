import { layer, group, frameRef } from '../../lib/dsl.mjs';
import hud from './_hud.cjs';

const T17B = 'T17-02_下一主题_云上蜂谷';

export default {
  name: 'NextThemePopup', bundle: 'garden', kind: 'popup', script: 'game/features/garden/NextThemePopup', title: '下一主题：前往清风水湾 / 云上蜂谷',
  source: 'T17-01_下一主题_清风水湾',
  doc: {
    args: '{ nextChapter }（1=清风水湾，2=云上蜂谷）', sources: [T17B], features: 'F027、F037',
    dynamic: 'Preview 按下一园换 previewFrames[nextChapter-1]；ThemeName setKey(hg.garden.theme.<theme>)',
    states: '无；出发成功（存档 chapter+1）后打开 StoryPopup 章节剧情',
    fx: 'FX-12',
  },
  props: {
    previewFrames: [
      frameRef('PNG/页面素材/T17-01_下一主题_清风水湾/其他素材/清风水湾真实主题预览_ce45805647.png'),
      frameRef('PNG/页面素材/T17-02_下一主题_云上蜂谷/其他素材/云上蜂谷真实主题预览_194f3ef029.png'),
    ],
  },
  backdrop: [layer('完整裸背景', { as: 'Background' })],
  children: [
    hud.standardHud('当前主线等级'),
    group('Title', [
      layer('原好友左悬绳', { as: 'RopeL' }), layer('原好友右悬绳', { as: 'RopeR' }), layer('原好友无字标题木牌', { as: 'Sign' }),
      layer('页面标题', { as: 'Text' }),
    ]),
    layer('无字面板_wood', { as: 'Panel' }),
    layer('下一园名称', { as: 'ThemeName', bind: 'themeNameLabel', key: 'hg.garden.theme.water' }),
    layer('清风水湾真实主题预览', { as: 'Preview', bind: 'preview' }),
    layer('下一园说明', { as: 'Desc' }),
    group('BtnGo', [layer('前往下一园_无字按钮', { as: 'Bg' }), layer('前往下一园_文案', { as: 'Text' })], { button: 'onGo' }),
    group('BtnHome', [layer('先回家园_无字按钮', { as: 'Bg' }), layer('先回家园_文案', { as: 'Text' })], { button: 'onHome' }),
    group('Bottom', [layer('返回', { as: 'BtnBack', button: 'onBack' })], { align: 'bottom' }),
  ],
};
