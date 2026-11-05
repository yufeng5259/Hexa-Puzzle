import { layer, group, label } from '../../lib/dsl.mjs';

export default {
  name: 'LoadingPage', bundle: 'resources', kind: 'page', script: 'game/features/boot/LoadingPage', title: '启动加载页（主图）',
  source: '主图',
  doc: { args: '无；App 推进进度 setProgress(0..1)', features: 'F001',
    dynamic: 'Progress/Fill 按进度改宽度（底槽内 0→100%），Status 显示百分比。待确认：所用贴图目前在 common 包，移入主包属于后续打包任务', fx: 'FX-12' },
  children: [
    layer('完整裸背景', { as: 'Background' }),
    layer('HoneyGarden标题插画', { as: 'Title', note: '游戏标题艺术字（设计要求，用图片）' }),
    group('Bees', [layer('右上飞行蜜蜂', { as: 'FlyingBee' }), layer('右下蜜蜂主体', { as: 'Bee' }), layer('右下雏菊', { as: 'Daisy' }), layer('右下蜂蜜浇水壶', { as: 'Pot' })]),
    group('Progress', [
      layer('加载进度底槽', { as: 'Track' }),
      layer('加载进度填充', { as: 'Fill', bind: 'fill', fill: true }),
      label('Status', 'hg.common.loading', [116, 1640, 620, 50], { size: 28, color: [255, 248, 216], bold: true, outline: [68, 131, 41], outlineWidth: 2 }, { bind: 'statusLabel' }),
    ], { align: 'bottom' }),
  ],
};
