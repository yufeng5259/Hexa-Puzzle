import { group, layer, layers } from '../../lib/dsl.mjs';
import { backRow, hud } from './_shared.mjs';

export default {
  name: 'PhotoDetailPopup', group: 'meta', bundle: 'meta', kind: 'popup', script: 'game/features/collection/PhotoDetailPopup',
  title: '照片详情',
  source: 'T25-01_照片详情',
  doc: {
    args: '{ book, photoId }', features: 'F039',
    dynamic: '照片图按 photoId 加载；建筑名、所属相册、获得来源为模板参数',
    fx: '—',
  },
  backdrop: [layer('完整裸背景', { as: 'Background' })],
  children: [
    hud('当前主线等级'),
    group('Title', [layers(['原好友左悬绳', '原好友右悬绳', '原好友无字标题木牌']), layer('页面标题', { as: 'Text' })], { align: 'top' }),
    layer('无字面板_wood', { as: 'Panel' }),
    layer('原建造图鉴阅读图标', { as: 'BookIcon' }),
    layer('照片建筑名称', { as: 'Name', bind: 'nameLabel' }),
    layer('照片所属相册', { as: 'Book', bind: 'bookLabel' }),
    group('Photo', [layer('无字面板_row', { as: 'Frame' }), layer('树屋原生场景纪念照片', { as: 'Image', bind: 'photo' })]),
    layer('照片收藏说明', { as: 'Note' }),
    layer('照片获得来源', { as: 'Source', bind: 'sourceLabel' }),
    group('BtnAlbum', [layer('回相册_无字按钮', { as: 'Bg' }), layer('回相册_文案', { as: 'Text' })], { button: 'onBack', note: '回相册 = 关闭' }),
    backRow('返回'),
  ],
};
