import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { WORKSPACE } from '../prefab-foundation/io.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output=path.join(WORKSPACE,'tmp/prototype/guide-motion');fs.mkdirSync(output,{recursive:true});
const report={at:new Date().toISOString(),status:'RUNNING',checks:[],errors:[],failedResources:[],screenshots:[],samples:[],limits:['Isolated browser storage; real pointer input. Background cancellation is an explicit Cocos lifecycle fixture. No platform builds.']};
let browser,page;
function check(value,label){if(!value)throw Error(label);report.checks.push(label);console.log(label);}
async function frames(n=4){await page.evaluate(async n=>{const {cc}=window.__motion;for(let i=0;i<n;i++)await new Promise(resolve=>cc.director.once(cc.Director.EVENT_AFTER_UPDATE,resolve));},n);}
async function shot(name){const file=path.join(output,name+'.png');await page.screenshot({path:file});report.screenshots.push(file);}
async function measure(){return page.evaluate(()=>{
 const {cc,boot}=window.__motion,o=boot.overlay;
 const params=boot.guide.activeStep.params,source=boot.targets.resolve(params.dragSourceTargetId),destination=boot.targets.resolve(params.dragDestinationTargetId);
 const hand=o.hand.worldPosition;
 const controller=boot.puzzleView.controller;
 return {hand:{x:hand.x,y:hand.y},visible:o.hand.activeInHierarchy&&o.handOpacity.opacity>10,handOpacity:o.handOpacity.opacity,pulse:controller.previewOpacity.opacity,
  source:source.point(),destination:destination.point(),sourceBounds:source.bounds(),bubble:{x:o.bubbleLabel.node.position.x,y:o.bubbleLabel.node.position.y},highlight:controller.previewRoot.activeInHierarchy,drag:controller.draggingPieceId,guardPointer:o.guard.pointer,guardEnabled:o.guard.enabled};
});}
async function location(which){return page.evaluate(which=>{const {boot,screen}=window.__motion,params=boot.guide.activeStep.params;return screen(boot.targets.resolve(which==='source'?params.dragSourceTargetId:params.dragDestinationTargetId).point());},which);}
async function click(action){await page.waitForFunction(()=>!window.__motion.boot.navigating);const p=await page.evaluate(action=>{
 const {cc,boot,screen}=window.__motion,root=boot.dialogView?.node||boot.homeView.node;
 const button=root.getComponentsInChildren(cc.Button).find(b=>b.enabledInHierarchy&&b.node.activeInHierarchy&&b.interactable&&b.clickEvents.some(e=>e.customEventData===action));
 if(!button)throw Error('Missing button '+action);return screen(button.node.worldPosition);
},action);await page.mouse.click(p.x,p.y);await frames(8);await page.waitForFunction(()=>!window.__motion.boot.navigating);}
try{
 await fetch('http://127.0.0.1:7456/asset-db/refresh');
 browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:430,height:940},hasTouch:true});
 page.on('pageerror',e=>report.errors.push(String(e.stack||e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))report.failedResources.push({status:r.status(),url:r.url()});});
 await page.goto('http://127.0.0.1:7456/',{waitUntil:'networkidle'});
 await page.waitForFunction(async()=>{
  if(typeof System==='undefined')return false;
  const cc=await System.import('cc'),boot=cc.director.getScene()?.getComponentsInChildren(cc.Component).find(c=>cc.js.getClassName(c)==='FirstReleaseBoot'&&c.ready);
  if(!boot)return false;
  const screen=p=>{const s=boot.node.getComponent(cc.Canvas).cameraComponent.worldToScreen(new cc.Vec3(p.x,p.y,0)),canvas=document.querySelector('canvas'),r=canvas.getBoundingClientRect();return{x:r.left+s.x/canvas.width*r.width,y:r.bottom-s.y/canvas.height*r.height};};
  window.__motion={cc,boot,screen};return true;
 },null,{timeout:60000});await frames();
 const geometry=await page.evaluate(()=>{const{cc,boot}=window.__motion,o=boot.overlay,s=boot.targets.resolve('puzzle.piece0'),d=boot.targets.resolve('puzzle.target0');return{
  cells:boot.puzzleView.session.level.pieces[0].cells.length,source:s.polygons().length,destination:d.polygons().length,
  handUuid:o.handSprite.spriteFrame?._uuid,tip:{x:o.handTipX,y:o.handTipY},timeout:boot.guide.activeStep.timeoutSeconds,
  sourceAllowed:o.acceptsPointerStart(s.point().x,s.point().y),destinationAllowed:o.acceptsPointerStart(d.point().x,d.point().y),
  otherAllowed:o.acceptsPointerStart(boot.puzzleView.pieceTarget(boot.puzzleView.session.level.pieces[1].id).worldPosition.x,boot.puzzleView.pieceTarget(boot.puzzleView.session.level.pieces[1].id).worldPosition.y),
  characterHand:o.hand.getComponentsInChildren(cc.Label).some(l=>l.string.includes('☝'))};});
 report.geometry=geometry;
 check(geometry.source===geometry.cells&&geometry.destination===geometry.cells&&geometry.cells>1,'source and destination cover every hex in the taught piece');
 check(geometry.handUuid?.startsWith('97c988c4-95fb-5fb1-ac97-de541d30fb4b')&&!geometry.characterHand,'actual transparent white glove Sprite replaces the character hand');
 check(Math.abs(geometry.tip.x-.2375)<.00001&&Math.abs(geometry.tip.y-.948125)<.00001,'fingertip is calibrated to the real PNG anchor');
 check(geometry.sourceAllowed&&!geometry.destinationAllowed&&!geometry.otherAllowed,'only the correct source polygon accepts a teaching drag start');
 check(geometry.timeout===0,'teaching demonstration stays available until the real action succeeds');
 check(await page.evaluate(()=>{const{boot}=window.__motion,c=boot.puzzleView.controller;return !boot.overlay.targetHighlight.node.active&&c.previewRoot.parent===boot.puzzleView.board.boardMount&&c.previewRoot!==c.dragRoot;}),'teaching reuses the board placement preview below the dragged piece without overlay paint');
 const lockedState=await page.evaluate(()=>JSON.stringify(window.__motion.boot.services.state));
 await page.evaluate(()=>{const b=window.__motion.boot;b.onViewAction({actionId:'settings'});b.onViewAction({actionId:'puzzle:restart'});});await frames();
 check(await page.evaluate(()=>!window.__motion.boot.dialogView)&&await page.evaluate(()=>JSON.stringify(window.__motion.boot.services.state))===lockedState,'forced drag blocks unrelated settings and restart actions');
 const retryPoint=await page.evaluate(()=>{
  const{boot,screen}=window.__motion;window.__motion.originalRetry=boot.onRetry;window.__motion.retryCalls=0;
  boot.onRetry=()=>{window.__motion.retryCalls++;};boot.overlay.fail('explicit recovery-handler fixture');
  return screen(boot.statusLabel.node.worldPosition);
 });
 await page.mouse.click(retryPoint.x,retryPoint.y);await frames(3);
 check(await page.evaluate(()=>{const{boot,retryCalls}=window.__motion;return retryCalls===1&&!boot.overlay.acceptsPointerStart(0,0)&&!boot.puzzleView.controller.allowPointerStart(0,0,9);}),'explicit recovery-handler fixture allows a real retry-label click while gameplay remains blocked');
 await page.evaluate(()=>{const{boot,originalRetry}=window.__motion;boot.onRetry=originalRetry;boot.guide.retry();});await frames(3);
 check(await page.evaluate(()=>!window.__motion.boot.statusLabel.node.activeInHierarchy),'recovered guide clears the sticky failure notice');
 for(let i=0;i<26;i++){report.samples.push(await measure());await shot('motion-'+String(i).padStart(2,'0'));await page.waitForTimeout(80);}
 const visible=report.samples.filter(s=>s.visible),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 check(Math.min(...visible.map(s=>distance(s.hand,s.source)))<5&&Math.min(...visible.map(s=>distance(s.hand,s.destination)))<5,'real engine Tween reaches both matching cell centers');
 check(Math.max(...report.samples.map(s=>s.pulse))-Math.min(...report.samples.map(s=>s.pulse))>70,'destination opacity visibly pulses while the hand repeats');
 check(report.samples.some(s=>s.handOpacity<50)&&report.samples.filter(s=>s.handOpacity>240).length>2,'the hand fades and restarts its loop');
 const missing=await page.evaluate(()=>{
  const {boot}=window.__motion,o=boot.overlay;boot.targets.clear();o.update(0);
  const locked=o.guard.enabled&&!o.acceptsPointerStart(0,0)&&!o.hand.active&&!boot.puzzleView.controller.allowPlacement(boot.puzzleView.session.level.pieces[0].id,{q:99,r:99});
  boot.bindGuideTargets();o.update(0);
  return locked&&o.isDragStepVisible&&o.hand.active;
 });
 check(missing,'missing targets keep forced input blocked and restore the loop after rebinding');
 const lostStart=await location('source');
 await page.mouse.move(lostStart.x,lostStart.y);await page.mouse.down();await page.mouse.move(lostStart.x+25,lostStart.y-30,{steps:4});await frames(2);
 check(await page.evaluate(()=>!!window.__motion.boot.puzzleView.controller.draggingPieceId),'target-loss fixture begins a real owned drag');
 await page.evaluate(()=>window.__motion.boot.guide.retry());
 check(await page.evaluate(()=>!!window.__motion.boot.puzzleView.controller.draggingPieceId),'explicit guide redraw fixture preserves controller ownership before target loss');
 await page.evaluate(()=>{const b=window.__motion.boot;b.targets.clear();b.overlay.update(0);});await page.mouse.up();await frames(2);
 const targetLoss=await page.evaluate(()=>{const b=window.__motion.boot;return {drag:b.puzzleView.controller.draggingPieceId,scroll:b.puzzleView.board.trayScroll.enabled,guard:b.overlay.guard.enabled,moves:b.puzzleView.session.snapshot.moves};});report.targetLoss=targetLoss;
 check(!targetLoss.drag&&targetLoss.scroll&&targetLoss.guard&&targetLoss.moves===0,'targets lost during an active drag cancel ownership, restore tray scrolling and keep input blocked');
 await page.evaluate(()=>{const b=window.__motion.boot;b.bindGuideTargets();b.overlay.update(0);});await frames(3);
 check(await page.evaluate(()=>window.__motion.boot.overlay.hand.active&&window.__motion.boot.puzzleView.controller.previewRoot.activeInHierarchy),'rebinding after target loss restores the hand and native destination preview');
 const before=await measure(),from=await location('source'),to=await location('destination');
 await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move((from.x+to.x)/2,(from.y+to.y)/2,{steps:8});await frames(3);
 const held=await measure();report.held=held;
 check(!held.visible&&held.highlight,'real drag hides the demonstration hand and keeps destination highlight');
 check(JSON.stringify(held.sourceBounds)===JSON.stringify(before.sourceBounds)&&JSON.stringify(held.bubble)===JSON.stringify(before.bubble),'drag enlargement never moves the source spotlight or the instruction');await shot('drag-held');
 const wrong=await page.evaluate(()=>{const{boot,screen}=window.__motion,s=boot.puzzleView.session,p=s.level.pieces[0];
  const target=boot.guide.activeStep.params.targetCell;
  for(let q=-12;q<=12;q++)for(let r=-12;r<=12;r++)if((q!==target.q||r!==target.r)&&s.canPlace(p.id,{q,r}))return{legal:true,point:screen(boot.puzzleView.board.pointOfCell({q,r}))};
  return{legal:false,point:{x:5,y:5}};
 });
 // Board-local to world conversion is needed for an alternate legal placement.
 if(wrong.legal)wrong.point=await page.evaluate(()=>{const{cc,boot,screen}=window.__motion,s=boot.puzzleView.session,p=s.level.pieces[0],target=boot.guide.activeStep.params.targetCell;
  for(let q=-12;q<=12;q++)for(let r=-12;r<=12;r++)if((q!==target.q||r!==target.r)&&s.canPlace(p.id,{q,r})){
   const local=boot.puzzleView.board.pointOfCell({q,r});return screen(boot.puzzleView.board.boardMount.getComponent(cc.UITransform).convertToWorldSpaceAR(new cc.Vec3(local.x,local.y,0)));}
 });
 await page.mouse.move(wrong.point.x,wrong.point.y,{steps:8});await page.mouse.up();await frames(8);
 check(await page.evaluate(()=>{const b=window.__motion.boot;return b.puzzleView.session.snapshot.moves===0&&Object.keys(b.puzzleView.session.snapshot.placements).length===0&&b.guide.activeStep.id==='ftue-drag'&&b.overlay.hand.active;}),'wrong drop returns to the tray and resumes teaching without consuming a move');await shot('wrong-drop-recovered');
 const start=await location('source');await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+35,start.y-45,{steps:5});
 await page.evaluate(()=>{const{cc}=window.__motion;cc.game.emit(cc.Game.EVENT_HIDE);});await page.mouse.up();await page.evaluate(()=>{const{cc}=window.__motion;cc.game.emit(cc.Game.EVENT_SHOW);});await frames(8);
 check(await page.evaluate(()=>window.__motion.boot.puzzleView.session.snapshot.moves===0&&window.__motion.boot.overlay.hand.active),'background cancellation restores the loop without committing a placement');
 const source=await location('source'),destination=await location('destination');await page.mouse.move(source.x,source.y);await page.mouse.down();await page.mouse.move(destination.x,destination.y,{steps:18});await page.mouse.up();await frames(10);
 check(await page.evaluate(()=>{const b=window.__motion.boot;return b.puzzleView.session.snapshot.moves===1&&b.guide.activeStep.id==='ftue-drag-2'&&b.overlay.hand.active&&!b.overlay.targetHighlight.node.active;}),'first saved placement transfers the forced hand and native highlight to the second piece');await shot('first-placement-complete');
 for(const [stepId,nextId,moves] of [['ftue-drag-2','ftue-drag-3',2],['ftue-drag-3',null,3]]){
  check(await page.evaluate(id=>{const b=window.__motion.boot,s=b.guide.activeStep;if(s?.id!==id)return false;return b.puzzleView.session.level.pieces.filter(p=>p.id!==s.params.pieceId).every(p=>!b.puzzleView.controller.allowPieceStart(p.id));},stepId),'only the configured piece starts during '+stepId);
  const blockedBefore=await page.evaluate(()=>JSON.stringify(window.__motion.boot.services.state));
  await page.evaluate(()=>{const b=window.__motion.boot;for(const actionId of ['puzzle:undo','puzzle:restart','settings'])b.onViewAction({actionId});});await frames();
  check(await page.evaluate(()=>JSON.stringify(window.__motion.boot.services.state))===blockedBefore,'undo restart and settings stay blocked during '+stepId);
  const s=await location('source'),d=await location('destination');await page.mouse.move(s.x,s.y);await page.mouse.down();await page.mouse.move(d.x,d.y,{steps:18});await page.mouse.up();await frames(12);
  check(await page.evaluate(({nextId,moves})=>{const b=window.__motion.boot;return b.puzzleView.session.snapshot.moves===moves&&(nextId?b.guide.activeStep?.id===nextId:b.services.state.coins===100&&b.services.state.activeAttempt.status==='completed');},{nextId,moves}),'configured placement commits during '+stepId);
 }
 await shot('three-guided-placements-complete');
 for(const viewport of [{width:375,height:667},{width:390,height:844}]){
  await page.setViewportSize(viewport);await frames(8);
  await page.evaluate(()=>{const{boot}=window.__motion;boot.services.store.transact(null,s=>{s.activeAttempt=null;s.currentLevelNo=1;s.receipts={};s.guide.completed=false;s.guide.stepId=null});});
  await page.evaluate(()=>window.__motion.boot.showPuzzle());await frames(8);await shot('layout-'+viewport.width+'x'+viewport.height);
  const s=await measure();check(s.highlight&&s.bubble.y===-195,'short portrait '+viewport.width+' keeps a fixed readable teaching layout');
 }
 check(report.errors.length===0,'no script or console errors in guide motion preview');check(report.failedResources.length===0,'all guide assets load successfully');report.status='PASS';
}catch(error){report.status='FAIL';report.failure=String(error.stack||error);console.error(report.failure);if(page)await shot('failure').catch(()=>{});process.exitCode=1;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,report:path.join(output,'report.json')}));}
