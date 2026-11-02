import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {PROJECT,WORKSPACE} from './io.mjs';
const source=path.join(WORKSPACE,'tmp/prototype/level-prefabs/native');
const sizes=[[390,844],[375,667],[360,640],[320,568]];
export function readLevelEvidence(){
  const file=path.join(source,'report.json'),report=JSON.parse(fs.readFileSync(file));
  assert.equal(report.status,'PASS','Real level display must pass native acceptance');
  assert.equal(report.errors.length,0);assert.equal(report.failedResources.length,0);
  assert.equal(report.resources.activeScopes,2);assert.deepEqual(report.resources.localStorageWrites,[]);
  assert.equal(report.screenshots.length,16);
  assert.equal(report.mapScreenshots?.length,2);
  for(const [width,height]of sizes)for(const pieces of [3,4,6,7]){
    const shot=report.screenshots.find(s=>s.width===width&&s.height===height&&s.pieces===pieces);
    assert(shot&&path.basename(shot.file)===shot.file&&fs.existsSync(path.join(source,shot.file)),`Missing ${width}x${height}/${pieces} pieces`);
  }
  for(const shot of report.mapScreenshots)assert(path.basename(shot.file)===shot.file&&fs.existsSync(path.join(source,shot.file)),'Missing real map image');
  const latest=fs.statSync(file).mtimeMs;
  const walk=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name);if(entry.isDirectory())walk(file);
    else if(/\.(ts|prefab|scene|json)$/.test(file))assert(fs.statSync(file).mtimeMs<=latest,'Native level evidence is stale: '+file);
  }};walk(path.join(PROJECT,'assets'));
  return report;
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function publishLevelEvidence(destination,report){
  const output=path.join(destination,'level-data');fs.mkdirSync(path.join(output,'screenshots'),{recursive:true});
  for(const shot of [...report.screenshots,...report.mapScreenshots])fs.copyFileSync(path.join(source,shot.file),path.join(output,'screenshots',shot.file));
  fs.copyFileSync(path.join(source,'report.json'),path.join(output,'native-report.json'));
  const cards=[3,4,6,7].map(count=>`<section><h2>${count} 块托盘</h2><div class="shots">${report.screenshots.filter(s=>s.pieces===count).map(s=>`<figure><figcaption>${s.width}×${s.height} · ${escape(s.id)}${s.mainlineNumber===null?' · 储备题开发预览':''}</figcaption><a href="screenshots/${escape(s.file)}"><img loading="lazy" src="screenshots/${escape(s.file)}" alt="${count}块 ${s.width}宽 Creator 实屏"></a></figure>`).join('')}</div></section>`).join('');
  const maps=`<section><h2>真实地图分页</h2><div class="shots">${report.mapScreenshots.map(s=>`<figure><figcaption>${s.id==='map-1'?'第1段 · 1～8':'第12段 · 89～96'}</figcaption><a href="screenshots/${s.file}"><img loading="lazy" src="screenshots/${s.file}" alt="${s.id} Creator地图"></a></figure>`).join('')}</div></section>`;
  fs.writeFileSync(path.join(output,'index.html'),`<!doctype html><html lang="zh-CN"><head><link rel="icon" href="data:,"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>真实关卡数据与整块 Prefab</title><style>*{box-sizing:border-box}body{margin:0;background:#f3f1e9;color:#25372f;font:16px/1.65 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1600px;margin:auto;padding:24px}section{background:#fff;padding:20px;border:1px solid #d4ded4;border-radius:12px;margin:20px 0}.shots{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;align-items:start}figure{margin:0}img{width:100%;height:auto}figcaption{font-size:13px;padding:8px 0}a{color:#21644f}.note{background:#fff4d7;padding:16px}@media(max-width:800px){.shots{grid-template-columns:repeat(2,minmax(0,1fr))}main{padding:12px}}</style></head><body><main><p><a href="../index.html">返回全部 Prefab 画册</a> · <a href="native-report.json">本轮原生报告</a></p><p><a href="../single-level-play/index.html">最新单关可玩验收</a></p><h1>真实关卡数据与整块 Prefab</h1><p>Creator 3.8.8；验证完成于 ${escape(report.finishedAt)}。正式目录含110道原题，96关主线由80普通题＋16限步题组成；其余14道仅保留开发预览。地图8个槽位分页至89～96，点击选择的题目身份贯穿开局和局内。</p><section><h2>验证范围</h2><p>默认地图、翻页与实际关卡按钮，主线6／12／96对应的原题身份，未知关卡拒绝、失败保留、快速切题与迟到结果，均以原生报告为准。每个整块为独立 Prefab 实例，子格使用 HexCellItem；棋盘外形、障碍、总格数和限步数来自所选原题。四尺寸共16张实屏，逐块检查边界与格子归属，原稿样例节点与真实数据互斥。</p><p>当前资源所有者为地图与启动关卡目录，共2个scope；操作阶段存储写入0，运行错误${report.errors.length}、资源失败${report.failedResources.length}。本画册检查初始题目显示；实际拖放另见单关可玩验收。</p></section><div class="note"><strong>本阶段边界</strong><p>本画册限定数据与展示组件验收。实际拖拽、吸附、占用和通关见单关可玩画册；真实解锁、奖励与玩家存档尚未接入；所有主线编号可供只读检查，不代表已解锁。7块示例来自储备题，开发入口不会出现在产品地图。木纹、高光和阴影仍需后续美术验收，不宣称像素一致。</p></div>${maps}${cards}</main></body></html>`);
}
