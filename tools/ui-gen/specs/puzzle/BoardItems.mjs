import { sprite, frameRef } from '../../lib/dsl.mjs';

// Pooled board items (bundle common, shared by puzzle and endless). Rect = one groove cell from T02-01 (135×117).
const CELL = [0, 0, 135, 117];

const PIECE_FRAMES = ['金色', '蓝色', '粉色', '绿色', '紫色'].flatMap(color => ['无花', '落地'].map(kind => color + kind));
const FILES = {
  金色无花: 'PNG/公共素材/金色无花母件_fffc6eb821.png', 金色落地: 'PNG/公共素材/金色落地母件_cd24968629.png',
  蓝色无花: 'PNG/公共素材/蓝色无花母件_571c35df73.png', 蓝色落地: 'PNG/公共素材/蓝色落地母件_c9b53c8c1d.png',
  粉色无花: 'PNG/公共素材/粉色无花母件_81f23ace92.png', 粉色落地: 'PNG/公共素材/粉色落地母件_0a5de39746.png',
  绿色无花: 'PNG/公共素材/绿色无花母件_7bc3788324.png', 绿色落地: 'PNG/公共素材/绿色落地母件_3dc49c9fbf.png',
  紫色无花: 'PNG/公共素材/紫色无花母件_2e873cf200.png', 紫色落地: 'PNG/公共素材/紫色落地母件_320e46d3b1.png',
};

export default [
  {
    name: 'BoardCell', bundle: 'common', kind: 'item', script: 'game/features/board/BoardCell', title: '棋盘格（对象池）', group: 'puzzle',
    source: 'T02-01_普通异形拼图_三块', rect: CELL,
    doc: {
      args: 'setState(groove | hint | obstacle)；节点缩放到棋盘格半径', features: 'F010、F016、F030',
      states: 'Groove 常显；Hint（提示轮廓 / 可放预览）、Obstacle（固定障碍 ×）默认隐藏', fx: 'FX-10',
    },
    children: [
      sprite('Groove', 'PNG/公共素材/木边与内孔规范_凹槽_1_1_f714e5b86e.png', CELL, { bind: ['groove', 'Node'] }),
      sprite('Hint', 'PNG/补充/R-23_六角发光描边.png', [-8, -12, 151, 141], { active: false, bind: ['hint', 'Node'] }),
      sprite('Obstacle', 'PNG/公共UI/锁定道具图标_3af59e5b0a.png', [32, 24, 70, 70], { active: false, bind: ['obstacle', 'Node'], note: '障碍格标记（设计稿为程序生成 ×，见报告）' }),
    ],
  },
  {
    name: 'PieceCell', bundle: 'common', kind: 'item', script: 'game/features/board/PieceCell', title: '拼块单格（对象池）', group: 'puzzle',
    source: 'T02-01_普通异形拼图_三块', rect: CELL,
    doc: {
      args: 'setLook(colorIndex 0–4, landed: boolean)', features: 'F010、F030',
      dynamic: 'frames[color*2 + (landed?1:0)]：5 色 × 无花/落地', fx: 'FX-09、FX-10',
    },
    props: { frames: PIECE_FRAMES.map(k => frameRef(FILES[k])) },
    children: [
      sprite('Body', FILES['金色无花'], CELL, { bind: 'body' }),
    ],
  },
];
