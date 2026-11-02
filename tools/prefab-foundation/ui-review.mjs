import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {PROJECT,WORKSPACE} from './io.mjs';

const source=path.join(WORKSPACE,'tmp/prototype/ui-integration/native');
const ids=['mainline-map','garden','puzzle','pause','settings','confirmation','puzzle-result'];
const integrated=['loading',...ids,'puzzle-preview','help-index','help-detail'];
const titles={'mainline-map':'主线地图',garden:'家园',puzzle:'拼图',pause:'暂停',settings:'设置',confirmation:'退出确认','puzzle-result':'结算演示'};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Publish only native evidence from the current runtime assets, never a previous passing run. */
export function readUiEvidence(){
  const file=path.join(source,'report.json'),report=JSON.parse(fs.readFileSync(file));
  assert.equal(report.status,'PASS','UI native interaction acceptance must pass before publication');
  assert.equal(report.errors.length,0);assert.equal(report.failedResources.length,0);
  assert.equal(report.startup.route,'mainline-map');assert.equal(report.startup.explicitSceneActivation,false);
  assert.equal(report.startup.mapItems,8);assert.equal(report.resources.activeScopes,2);
  assert.deepEqual(report.resources.localStorageWrites,[]);
  const covered=new Set(report.variants.map(row=>row.id));
  assert(integrated.every(id=>covered.has(id)),'Integrated page variant evidence is incomplete');
  assert.equal(report.screenshots.length,14);
  assert.equal(report.variantScreenshots?.length,2,'Hint variant requires native visual evidence at both sizes');
  for(const id of ids)for(const width of [390,320]){
    const shot=report.screenshots.find(s=>s.id===id&&s.width===width);
    assert(shot&&path.basename(shot.file)===shot.file&&fs.existsSync(path.join(source,shot.file)),`Missing UI screenshot ${id}/${width}`);
  }
  for(const width of [390,320]){
    const shot=report.variantScreenshots.find(s=>s.id==='puzzle-hint'&&s.width===width);
    assert(shot&&path.basename(shot.file)===shot.file&&fs.existsSync(path.join(source,shot.file)),`Missing hint screenshot ${width}`);
  }
  const latest=fs.statSync(file).mtimeMs;
  const check=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const target=path.join(directory,entry.name);
    if(entry.isDirectory())check(target);
    else if(/\.(ts|prefab|scene)$/.test(target))assert(fs.statSync(target).mtimeMs<=latest,'UI native evidence is stale: '+target);
  }};
  check(path.join(PROJECT,'assets'));
  return report;
}

export function publishUiEvidence(destination,report){
  const output=path.join(destination,'ui-integration');fs.mkdirSync(path.join(output,'screenshots'),{recursive:true});
  for(const shot of [...report.screenshots,...report.variantScreenshots])fs.copyFileSync(path.join(source,shot.file),path.join(output,'screenshots',shot.file));
  fs.copyFileSync(path.join(source,'report.json'),path.join(output,'native-report.json'));
  const sections=[...ids,'puzzle-hint'].map(id=>`<section><h2>${titles[id]||'拼图提示版式'}</h2><div class="shots">${[...report.screenshots,...report.variantScreenshots].filter(s=>s.id===id).map(s=>`<figure><figcaption>${s.width} × ${s.height}</figcaption><a href="screenshots/${escape(s.file)}"><img src="screenshots/${escape(s.file)}" alt="${titles[id]||'拼图提示版式'} Cocos 实屏" loading="lazy"></a></figure>`).join('')}</div></section>`).join('');
  const html=`<!doctype html><html lang="zh-CN"><head><link rel="icon" href="data:,"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>界面链路验收</title><style>*{box-sizing:border-box}body{margin:0;background:#f3f1e9;color:#25372f;font:16px/1.7 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1100px;padding:24px;margin:auto}section{background:#fff;border:1px solid #d4ded4;border-radius:12px;padding:20px;margin:20px 0}.shots{display:flex;gap:24px;align-items:start}figure{margin:0;flex:1;max-width:390px}img{width:100%;height:auto}a{color:#21644f}.note{background:#fff4d7;padding:18px}h1{font-size:28px}h2{font-size:22px}@media(max-width:600px){main{padding:12px}.shots{gap:12px}section{padding:12px}}</style></head><body><main><p><a href="../index.html">返回 Prefab 对照画册</a> · <a href="native-report.json">完整交互报告</a></p><p><a href="../single-level-play/index.html">最新单关可玩验收</a></p><h1>界面链路验收 · Creator 3.8.8</h1><p>验证完成于 ${escape(report.finishedAt)}。默认 Main 从 Loading 自动进入地图，原生预览状态为 ${escape(report.status)}。11 个核心页面／弹窗的 ${report.variants.length} 个版式检查了当前状态的真实字段引用。</p><section><h2>已验证的界面操作</h2><p>地图与家园往返，点击关卡进入开局并打开拼图；暂停、设置、帮助详情、重开及退出确认；开发预览顶部按钮打开结算演示。按钮使用 Prefab 序列化事件，动态 item 显式向所属页面转发。地图 8 个关卡节点、家园 5 栋建筑及拼图格子／托盘使用独立 item Prefab。</p><p>快速切页只保留最新请求；模拟加载失败保留当前页面。共创建 ${report.resources.createdScopes} 个 scope，已释放 ${report.resources.releasedScopes} 个，由当前地图与启动关卡目录各保留 1 个；界面操作期间 localStorage 写入 0，脚本错误 0，资源请求失败 0。</p></section><div class="note"><strong>阶段边界</strong><p>本画册复验原稿夹具与导航；实际拖放、吸附和通关见单关可玩验收。花蜜经济、建设、解锁、存档、奖励和广告尚未接入；夹具结算演示不发奖、不记录通关。棋盘几何沿用原稿坐标，边缘高光、阴影、木纹接缝尚有差异，未作像素相似度结论。</p></div>${sections}</main></body></html>`;
  fs.writeFileSync(path.join(output,'index.html'),html);
}
