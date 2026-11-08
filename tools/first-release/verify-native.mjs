import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { WORKSPACE } from '../prefab-foundation/io.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output=path.join(WORKSPACE,'tmp/prototype/first-release/native');fs.mkdirSync(output,{recursive:true});
const report={createdAt:new Date().toISOString(),status:'RUNNING',checks:[],errors:[],failedResources:[],screenshots:[],limitations:['Browser context is isolated from user browser saves. Tutorial is played by real mouse drag/click. Late-level and map-completion fixtures are explicitly marked. No platform builds or SDK/device claims.']};
let browser,page;
function check(value,message){if(!value)throw Error(message);report.checks.push(message);console.log(message);}
async function shot(name){const file=path.join(output,name+'.png');await page.screenshot({path:file});report.screenshots.push(file);}
async function install(){
 await page.waitForFunction(async()=>{
  if(typeof System==='undefined')return false;
  const cc=await System.import('cc');const boot=cc.director.getScene()?.getComponentsInChildren(cc.Component).find(c=>cc.js.getClassName(c)==='FirstReleaseBoot'&&c.ready);
  if(!boot)return false;
  const point=(node,local={x:0,y:0})=>{const world=node.getComponent(cc.UITransform).convertToWorldSpaceAR(new cc.Vec3(local.x,local.y,0));const s=boot.node.getComponent(cc.Canvas).cameraComponent.worldToScreen(world);const canvas=document.querySelector('canvas'),r=canvas.getBoundingClientRect();return{x:r.left+s.x/canvas.width*r.width,y:r.bottom-s.y/canvas.height*r.height}};
  const frame=()=>new Promise(resolve=>cc.director.once(cc.Director.EVENT_AFTER_UPDATE,resolve));
  window.__first={cc,boot,point,frame,frames:async(n=4)=>{for(let i=0;i<n;i++)await frame()}};return true;
 },null,{timeout:60000});
}
const snapshot=()=>page.evaluate(()=>JSON.parse(JSON.stringify(window.__first.boot.services.state)));
async function frames(n=5){await page.evaluate(n=>window.__first.frames(n),n);}
async function untilRoute(route){await page.waitForFunction(route=>window.__first?.boot.currentRoute===route&&!window.__first.boot.navigating,route,{timeout:30000}).catch(async error=>{throw Error(error.message+' '+JSON.stringify(await snapshot()))});await frames();}
async function click(action){
 await page.waitForFunction(()=>{const b=window.__first?.boot;return b&&!b.navigating&&(!b.dialogKind||b.dialogView)},null,{timeout:15000});
 const location=await page.evaluate(action=>{
  const {cc,boot,point}=window.__first;
  const root=boot.dialogView?.node||(boot.currentRoute==='puzzle'?boot.puzzleView?.node:boot.homeView?.node);
  const buttons=root.getComponentsInChildren(cc.Button).filter(button=>button.interactable&&button.node.activeInHierarchy&&button.enabledInHierarchy&&button.clickEvents.some(e=>e.customEventData===action||e.handler===action));
  if(buttons.length!==1)throw Error('Expected one usable button '+action+', got '+buttons.length);
  return point(buttons[0].node);
 },action);
 await page.mouse.click(location.x,location.y);await frames(8);
 await page.waitForFunction(()=>{const b=window.__first?.boot;return b&&!b.navigating&&(!b.dialogKind||b.dialogView)},null,{timeout:15000});
}
async function drag(piece,commit=true){
 let locations=await dragLocations(piece.id);
 for(let n=0;!locations.visible&&n<4;n++){await click('nextTray');await page.waitForTimeout(250);locations=await dragLocations(piece.id);}
 if(!locations.visible)throw Error('Piece cannot be reached in tray '+piece.id);
 const before=await snapshot();
 await page.mouse.move(locations.from.x,locations.from.y);await page.mouse.down();await page.mouse.move(locations.to.x,locations.to.y,{steps:14});await frames(2);await page.mouse.up();await frames(8);
 const after=await snapshot();
 if(!commit){check(JSON.stringify(after)===JSON.stringify(before),'failed actual placement write preserves wallet attempt and guide state');return;}
 if(after.activeAttempt.snapshot?.moves!==(before.activeAttempt.snapshot?.moves||0)+1)console.log('drag diagnostic',JSON.stringify({locations,before:before.activeAttempt,after:after.activeAttempt,engine:await page.evaluate(()=>({drag:window.__first.boot.currentPuzzleController.draggingPieceId,guide:window.__first.boot.overlay.guard,notice:window.__first.boot.statusLabel.string}))}));
 check(after.activeAttempt.snapshot?.moves===(before.activeAttempt.snapshot?.moves||0)+1,'real pointer placement '+piece.id);
}
async function dragLocations(id){return page.evaluate(id=>{
 const {cc,boot,point}=window.__first,board=boot.puzzleView.board;
 const entry=board.pieceEntries().find(e=>e.item.pieceId===id);if(!entry)throw Error('Missing piece '+id);
 const item=entry.item,positions=item.cells.map(c=>({x:1.5*item.radius*c.q,y:Math.sqrt(3)*item.radius*(c.r+c.q/2)}));
 const center={x:(Math.min(...positions.map(p=>p.x))+Math.max(...positions.map(p=>p.x)))/2,y:(Math.min(...positions.map(p=>p.y))+Math.max(...positions.map(p=>p.y)))/2};
 const from=point(entry.node,{x:positions[0].x-center.x,y:positions[0].y-center.y});
 const piece=board.level.pieces.find(p=>p.id===id),to=point(board.boardMount,board.pointOfCell(piece.targetCells[0]));
 const viewport=board.trayViewport,t=viewport.getComponent(cc.UITransform),world=entry.node.getComponent(cc.UITransform).convertToWorldSpaceAR(new cc.Vec3(positions[0].x-center.x,positions[0].y-center.y,0)),local=t.convertToNodeSpaceAR(world);
 return{from,to,visible:local.x>=-t.width*t.anchorX&&local.x<=t.width*(1-t.anchorX)&&local.y>=-t.height*t.anchorY&&local.y<=t.height*(1-t.anchorY)};
},id);}
async function pieces(){return page.evaluate(()=>window.__first.boot.puzzleView.session.level.pieces.map(p=>({id:p.id})));}

try{
 const refresh=await fetch('http://127.0.0.1:7456/asset-db/refresh');if(!refresh.ok)throw Error('Creator refresh failed');
 browser=await chromium.launch({channel:'chrome',headless:true});
 page=await browser.newPage({viewport:{width:430,height:940},hasTouch:true});
 page.on('pageerror',e=>report.errors.push(String(e.stack||e)));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))report.failedResources.push({status:r.status(),url:r.url()})});
 await page.goto('http://127.0.0.1:7456/',{waitUntil:'networkidle'});await install();await frames(8);
 check(await page.evaluate(()=>window.__first.boot.currentRoute==='puzzle'),'fresh account enters tutorial puzzle');
 await shot('01-tutorial');
 await page.evaluate(()=>{const port=window.__first.boot.services.store.storage,save=port.setItem.bind(port);let fail=true;port.setItem=(key,value)=>{if(fail&&key==='honey-garden.first-release.v1'){fail=false;throw Error('test storage write failure')}save(key,value)}});
 await drag((await pieces())[0],false);
 await page.evaluate(()=>{const o=window.__first.boot.overlay;o.presentStep({...o.step,timeoutSeconds:.1});o.update(1)});
 check(await page.evaluate(()=>window.__first.boot.overlay.guard.enabled&&!window.__first.boot.overlay.acceptsPointerStart(0,0)),'forced guide timeout cannot unlock unrelated input');
 const teachingAttempt=(await snapshot()).activeAttempt.attemptId;
 await click('puzzle:restart');await click('settings');
 check((await snapshot()).activeAttempt.attemptId===teachingAttempt&&(await snapshot()).energy===5&&await page.evaluate(()=>!window.__first.boot.dialogView),'forced drag rejects actual restart and settings clicks');
 await drag((await pieces())[0]);
 check(await page.evaluate(()=>window.__first.boot.guide.activeStep?.id==='ftue-drag-2'),'first placement advances to mandatory second-piece lesson');
 await shot('01-second-piece');
 for(const [index,stepId] of [[1,'ftue-drag-2'],[2,'ftue-drag-3']]){
  await page.reload({waitUntil:'networkidle'});await install();await frames();
  check(await page.evaluate(({index,stepId})=>{const b=window.__first.boot;return b.guide.activeStep?.id===stepId&&b.puzzleView.session.snapshot.moves===index;},{index,stepId}),'reload restores '+stepId+' with committed earlier pieces');
  check(await page.evaluate(()=>{const b=window.__first.boot,s=b.guide.activeStep;return b.puzzleView.session.level.pieces.filter(p=>p.id!==s.params.pieceId).every(p=>!b.puzzleView.controller.allowPieceStart(p.id));}),'only the configured piece accepts a start during '+stepId);
  const forcedState=await snapshot();
  await page.evaluate(()=>{const b=window.__first.boot;for(const actionId of ['settings','puzzle:restart','puzzle:back','puzzle:hint','puzzle:undo'])b.onViewAction({actionId});});await frames();
  check(JSON.stringify(await snapshot())===JSON.stringify(forcedState)&&await page.evaluate(()=>!window.__first.boot.dialogView),'all unrelated actions remain blocked during '+stepId);
  await drag((await pieces())[index]);await shot('01-guided-piece-'+(index+1));
 }
 await page.waitForFunction(()=>window.__first.boot.dialogView&&window.__first.boot.dialogKind==='result',null,{timeout:15000});
 let state=await snapshot();check(state.coins===100&&!state.guide.completed&&state.activeAttempt.snapshot.moves===3,'three forced placements win once in three moves and keep building tutorial pending');
 check(await page.evaluate(()=>window.__first.boot.guide.activeStep?.targetId==='result.home'),'durable first win advances to mandatory return-home lesson');
 await shot('02-first-win');await click('primary');await untilRoute('home');
 check(await page.evaluate(()=>window.__first.boot.guide.activeStep?.targetId==='home.build'),'home guide points to build button');
 const mapIdentity=await page.evaluate(()=>window.__first.boot.homeView.mapRoot.uuid);
 await click('home:build');await untilRoute('build');
 check(await page.evaluate(()=>window.__first.boot.guide.activeStep?.targetId==='building.slot1.upgrade'),'building upgrade is a separate live guide step');
 await shot('03-build-guide');
 const beforeOtherBuilding=await snapshot();await click('building:upgrade:2');
 await page.evaluate(()=>window.__first.boot.onViewAction({actionId:'building:upgrade:3'}));await frames();
 check(JSON.stringify(await snapshot())===JSON.stringify(beforeOtherBuilding),'building lesson rejects other building anchors and action entry points');
 await page.evaluate(()=>{const port=window.__first.boot.services.store.storage,save=port.setItem.bind(port);let fail=true;port.setItem=(key,value)=>{if(fail&&key==='honey-garden.first-release.v1'){fail=false;throw Error('test upgrade write failure')}save(key,value)}});
 const unpaid=await snapshot();await click('building:upgrade:1');
 check(JSON.stringify(await snapshot())===JSON.stringify(unpaid)&&await page.evaluate(()=>window.__first.boot.guide.activeStep?.targetId==='building.slot1.upgrade'),'failed actual upgrade write preserves coins building and guide milestone');
 await click('building:upgrade:1');await frames(12);
 state=await snapshot();check(state.coins===60&&state.buildings['garden-1']['1']===1&&!state.guide.completed,'first upgrade spends once and leaves welcome reward pending');
 await page.waitForFunction(()=>window.__first.boot.dialogKind==='welcome'&&window.__first.boot.dialogView,null,{timeout:15000});
 check(await page.evaluate(()=>window.__first.boot.services.getGuidePhase()==='welcome'&&!window.__first.boot.dialogView.closeButton.node.activeInHierarchy),'welcome is a separate mandatory claim step without a close button');
 await shot('04-first-upgrade');
 check(await page.evaluate(id=>window.__first.boot.homeView.mapRoot.uuid===id,mapIdentity),'home and build retain identical map instance');
 await page.evaluate(()=>{const port=window.__first.boot.services.store.storage,save=port.setItem.bind(port);let fail=true;port.setItem=(key,value)=>{if(fail&&key==='honey-garden.first-release.v1'){fail=false;throw Error('test welcome write failure')}save(key,value)}});
 const unclaimed=await snapshot();await click('primary');
 check(JSON.stringify(await snapshot())===JSON.stringify(unclaimed)&&await page.evaluate(()=>window.__first.boot.dialogKind==='welcome'),'failed welcome claim preserves balances receipt and completion, allowing retry');
 await page.reload({waitUntil:'networkidle'});await install();await frames();
 await page.waitForFunction(()=>window.__first.boot.dialogKind==='welcome'&&window.__first.boot.dialogView,null,{timeout:15000});
 check((await snapshot()).coins===60&&(await snapshot()).buildings['garden-1']['1']===1&&!(await snapshot()).guide.completed,'reload resumes welcome without charging the completed upgrade again');
 await shot('04-welcome');await click('primary');await untilRoute('home');
 state=await snapshot();check(state.coins===160&&state.energy===5&&state.hints===6&&state.guide.completed&&state.receipts['welcome-reward:first-session'],'welcome adds exactly 100 coins and one hint, then completes tutorial');
 const claimed=await snapshot();check(await page.evaluate(()=>window.__first.boot.services.claimWelcome())===false&&JSON.stringify(await snapshot())===JSON.stringify(claimed),'repeated welcome claim cannot duplicate rewards');
 await page.reload({waitUntil:'networkidle'});await install();await frames();
 state=await snapshot();check(state.coins===160&&state.buildings['garden-1']['1']===1&&state.currentLevelNo===2&&state.guide.completed,'reload preserves claimed welcome progress wallet building and guide');
 await untilRoute('home');await shot('05-home');
 await click('settings');await shot('05-settings');await click('settings:music');await click('primary');
 check((await snapshot()).settings.music===false,'settings preference commits through actual button');
 await click('home:play');await untilRoute('puzzle');const first=(await pieces())[0];await drag(first);
 const active=(await snapshot()).activeAttempt;await click('puzzle:back');await click('primary');await untilRoute('home');
 await page.reload({waitUntil:'networkidle'});await install();await click('home:play');await untilRoute('puzzle');
 state=await snapshot();check(state.activeAttempt.attemptId===active.attemptId&&state.activeAttempt.snapshot.moves===1&&state.energy===5,'unfinished attempt resumes after application restart without life debit');
 await click('puzzle:restart');await click('primary');await untilRoute('puzzle');state=await snapshot();
 check(state.energy===4&&state.activeAttempt.attemptId!==active.attemptId,'confirmed restart consumes one life and creates new attempt');
 const hints=state.hints;await click('puzzle:hint');await click('puzzle:hint');state=await snapshot();
 check(state.hints===hints-1&&state.activeAttempt.snapshot.moves===0,'repeated hint activation charges once without consuming a move');
 await drag((await pieces())[0]);await click('puzzle:undo');state=await snapshot();
 check(state.activeAttempt.snapshot.moves===2&&Object.keys(state.activeAttempt.snapshot.placements).length===0,'actual undo returns the placed piece and counts one new move');
 const cancelAttempt=state.activeAttempt.attemptId;await click('puzzle:restart');await click('secondary');state=await snapshot();
 check(state.energy===4&&state.activeAttempt.attemptId===cancelAttempt,'cancelled restart preserves both life and attempt');
 const recovery=await page.evaluate(()=>{const s=window.__first.boot.services,deadline=s.state.nextEnergyAt;s.clock=()=>deadline-1000;s.refresh();const before=s.state.energy;s.clock=()=>deadline+1000;s.refresh();return{before,after:s.state.energy}});
 check(recovery.before===4&&recovery.after===5,'live services recover one life after configured 300 seconds');
 await click('puzzle:back');await click('primary');await untilRoute('home');await click('home:build');await untilRoute('build');
 await page.evaluate(()=>window.__first.boot.services.store.transact(null,s=>{s.coins=0}));
 await page.evaluate(()=>window.__first.boot.homeView.setData(window.__first.boot.meta,window.__first.boot.services.state));
 await click('building:upgrade:2');check(await page.evaluate(()=>window.__first.boot.dialogView.titleLabel.string==='蜜蜂币不足'),'insufficient currency uses live popup');await shot('06-insufficient-coins');
 await click('primary');await untilRoute('puzzle');check((await snapshot()).coins===0,'insufficient currency returns to current puzzle without charging');

 // Late-level fixture selects an existing seven-piece question. Pieces are still dragged through actual native input.
 await page.evaluate(async()=>{const {boot}=window.__first;boot.services.store.transact(null,s=>{s.activeAttempt=null;const line=boot.meta.getMainlines().find(row=>boot.catalog.getById(row.puzzleId).pieces.length===7);s.currentLevelNo=line.levelNo});await boot.showHome('home')});
 await click('home:play');await untilRoute('puzzle');
 const late=await pieces();check(late.length===7,'late-level fixture loads original seven-piece geometry');
 for(const piece of late)await drag(piece);
 check((await snapshot()).activeAttempt.status==='completed','all seven pieces can be reached and placed across tray pages');await shot('07-seven-piece-win');
 await click('primary');await untilRoute('home');await click('home:build');await untilRoute('build');
 // Explicit wallet fixture funds remaining levels. All five anchors must receive real clicks.
 await page.evaluate(()=>window.__first.boot.services.store.transact(null,d=>{d.coins=100000}));
 await page.evaluate(()=>window.__first.boot.homeView.setData(window.__first.boot.meta,window.__first.boot.services.state));await frames();
 for(let slot=1;slot<=5;slot++){
  let level=(await snapshot()).buildings['garden-1'][String(slot)];
  while(level<5){await click('building:upgrade:'+slot);const next=(await snapshot()).buildings['garden-1'][String(slot)];check(next===level+1,'actual building anchor '+slot+' advances to stage '+next);level=next;}
 }
 await click('map:claim');state=await snapshot();check(state.receipts['map-reward:garden-1']&&state.currentMapId==='garden-1','map reward commits once and final map remains available');
 const wallet=state.coins;check(await page.evaluate(()=>window.__first.boot.services.claimMap())===false&&(await snapshot()).coins===wallet,'repeated map reward cannot duplicate payment');await click('primary');await shot('08-map-complete');
 for(const size of [{width:375,height:667},{width:390,height:844}]){await page.setViewportSize(size);await frames(8);await shot('09-layout-'+size.width+'x'+size.height)}
 // Isolated energy/content fixtures exercise real entry gates without waiting 5 minutes per life.
 await page.evaluate(async()=>{const {boot}=window.__first;boot.services.store.transact(null,s=>{s.activeAttempt=null;s.energy=0;s.nextEnergyAt=Math.max(Date.now(),s.lastSeenAt)+300000});await boot.showHome('home')});
 await click('home:play');await page.waitForFunction(()=>window.__first.boot.dialogKind==='energy'&&window.__first.boot.dialogView,null,{timeout:10000});
 check((await snapshot()).energy===0&&await page.evaluate(()=>window.__first.boot.dialogView.bodyLabel.string.includes('5分钟')),'zero energy blocks a new ordinary attempt with configured recovery popup');await shot('10-energy-empty');await click('primary');
 await page.evaluate(()=>window.__first.boot.services.store.transact(null,s=>{s.energy=1}));await click('home:play');await untilRoute('puzzle');
 const resumable=(await snapshot()).activeAttempt.attemptId;await click('puzzle:back');await click('primary');await untilRoute('home');
 await page.evaluate(()=>window.__first.boot.services.store.transact(null,s=>{s.energy=0}));await click('home:play');await untilRoute('puzzle');
 check((await snapshot()).energy===0&&(await snapshot()).activeAttempt.attemptId===resumable,'zero energy still resumes an existing attempt through actual Play');
 await page.evaluate(async()=>{const {boot}=window.__first;boot.services.store.transact(null,s=>{s.activeAttempt=null;s.currentLevelNo=boot.meta.getMainlineCount()+1});await boot.showHome('home')});
 check(await page.evaluate(()=>!window.__first.boot.homeView.playButton.interactable&&window.__first.boot.homeView.levelLabel.string==='✓'),'content-complete home has no out-of-range Play entry');await shot('11-content-complete');
 check(report.errors.length===0,'no browser script or console errors');check(report.failedResources.length===0,'all requested preview resources load');report.status='PASS';
}catch(error){report.status='FAIL';report.failure=String(error.stack||error);console.error(report.failure);if(page)await shot('failure').catch(()=>{});process.exitCode=1;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,errors:report.errors.length,report:path.join(output,'report.json')}));}
