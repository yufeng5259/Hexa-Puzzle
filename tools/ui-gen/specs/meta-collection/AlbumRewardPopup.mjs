import { frameRef, group, layer } from '../../lib/dsl.mjs';
import { backRow, hud, ribbonTitle } from './_shared.mjs';

export default {
  name: 'AlbumRewardPopup', group: 'meta', bundle: 'meta', kind: 'popup', script: 'game/features/collection/AlbumRewardPopup',
  title: '相册集齐奖励（三册共用，换图换文案）',
  source: 'T26-01_相册集齐_第一册',
  doc: {
    args: '{ book }（0/1/2）', sources: ['T26-02_相册集齐_第二册', 'T26-03_相册集齐_第三册'], features: 'F040',
    dynamic: '整园合影按册取 bookPhotos[book]；标题「第{n}册完成」、相册名、外观奖励（花朵帽/水湾丝带/云朵胸针）按册换 key 与图',
    states: '领取后关闭；重复打开只回看不再发奖（幂等键 album:{book}）',
    fx: 'FX-02、FX-03',
  },
  props: {
    bookPhotos: [
      frameRef('PNG/页面素材/T26-01_相册集齐_第一册/其他素材/真实整园合影_d9ef12d9d8.png'),
      frameRef('PNG/页面素材/T26-02_相册集齐_第二册/其他素材/真实整园合影_6de1ed2f1d.png'),
      frameRef('PNG/页面素材/T26-03_相册集齐_第三册/其他素材/真实整园合影_20dbd52c8c.png'),
    ],
  },
  backdrop: [layer('完整裸背景', { as: 'Background' })],
  children: [
    hud(),
    layer('相册完成等比原生结算框', { as: 'Panel' }),
    ribbonTitle('titleLabel'),
    layer('真实整园合影', { as: 'BookPhoto', bind: 'bookPhoto' }),
    layer('book', { as: 'BookIcon' }),
    layer('相册名称', { as: 'BookName', bind: 'bookNameLabel' }),
    layer('成册进度', { as: 'Count', bind: 'countLabel' }),
    group('Rewards', [
      group('Hint', [layer('bulb', { as: 'Icon' }), layer('提示奖励', { as: 'Amount', bind: 'hintRewardLabel' })]),
      group('Outfit', [layer('outfit_flower_hat', { as: 'Icon', bind: 'outfitIcon' }), layer('外观名', { as: 'Name', bind: 'outfitNameLabel' })]),
    ]),
    layer('唯一领取', { as: 'Once' }),
    group('BtnClaim', [layer('收下礼物_原生按钮', { as: 'Bg' }), layer('收下礼物_文案', { as: 'Text' })], { button: 'onClaim' }),
    layer('成册欢呼蜜蜂', { as: 'CheerBee' }),
    backRow(),
  ],
};
