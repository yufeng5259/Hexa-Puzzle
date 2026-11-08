import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { PROJECT } from '../../prefab-foundation/io.mjs';
const require=createRequire(import.meta.url);
const ts=require(process.env.TYPESCRIPT_PATH || 'G:/cocosCreator/Editor/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
function load(name) {
    const filename=path.join(PROJECT,'assets/scripts/features/guide',name+'.ts');
    const module={exports:{}};
    const js=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
    vm.runInNewContext(js,{module,exports:module.exports,require},{filename});return module.exports;
}
const {GuideManager}=load('GuideManager'),{GuideInput,contains}=load('GuideInput'),{GuideTargetRegistry}=load('GuideTargetRegistry');
const {pointInPolygon}=load('GuideInput'),{guidePresentation}=load('GuidePresentation');
const step=(id,extra={})=>({id,groupId:'first-session',nextStepId:null,triggerEvent:'page.ready',pageId:'home',targetId:'home.build',action:'click',completeEvent:'page.ready',params:{},shape:'rect',padding:8,offsetX:0,offsetY:0,width:null,height:null,radius:null,handOffsetX:0,handOffsetY:0,timeoutSeconds:15,skippable:false,...extra});
test('committed context matching protects guide from other attempt/map/slot events',()=>{
    let shown=null;const manager=new GuideManager([step('upgrade',{pageId:'build',targetId:'building.slot1.upgrade',completeEvent:'building.upgradeCommitted',params:{mapId:'garden-1',slotId:1,expectedStage:1}})],{present:s=>shown=s.id,clear:()=>shown=null});
    manager.resume({phase:'build',pageId:'home',mode:'build',mapId:'garden-1'});
    assert.equal(shown,'upgrade');
    assert.equal(manager.onEvent({type:'building.upgradeCommitted',mapId:'garden-2',slotId:1,stage:1}),false);
    assert.equal(manager.onEvent({type:'building.upgradeCommitted',mapId:'garden-1',slotId:2,stage:1}),false);
    assert.equal(manager.onEvent({type:'button.click',mapId:'garden-1',slotId:1,stage:1}),false);
    assert.equal(manager.onEvent({type:'building.upgradeCommitted',mapId:'garden-1',slotId:1,stage:1}),true);
    assert.equal(shown,null);
});
test('resume restores build action from actual business phase, never stale puzzle step',()=>{
    let shown;const rows=[step('drag',{pageId:'puzzle',targetId:'piece',action:'drag'}),step('build'),step('upgrade',{pageId:'build',targetId:'building.slot1.upgrade'})];
    const manager=new GuideManager(rows,{present:s=>shown=s.id,clear:()=>shown=null});
    manager.resume({phase:'build',pageId:'home',stepId:'drag'});assert.equal(shown,'build');
    manager.resume({phase:'build',pageId:'home',mode:'build'});assert.equal(shown,'upgrade');
    manager.resume({phase:'complete',pageId:'home'});assert.equal(shown,null);assert.equal(manager.activeStep,null);
});
test('step persistence failure keeps the old permission and retries the committed event',()=>{
    let writes=0,clears=0,error='';const manager=new GuideManager([step('a',{nextStepId:'b'}),step('b')],{present:()=>{},clear:()=>clears++,persistStep:()=>{if(++writes>1)throw Error('disk full')},onError:s=>error=s});
    manager.resume({phase:'build',pageId:'home'});assert.equal(manager.activeStep.id,'a');
    assert.equal(manager.onEvent({type:'page.ready'}),false);assert.equal(manager.activeStep.id,'a');assert.match(error,/disk full/);assert.ok(clears>0);
});

test('forced permission checks restrict pieces, target, actions and suspended pages',()=>{
    const rows=[step('drag',{pageId:'puzzle',action:'drag',nextStepId:'rest',completeEvent:'puzzle.placementCommitted',params:{pieceId:'p0',targetCell:{q:4,r:0},allowedActions:['puzzle:drag']}}),
        step('rest',{pageId:'puzzle',action:'wait',completeEvent:'puzzle.winCommitted',params:{allowedActions:['puzzle:drag','puzzle:undo']}})];
    const manager=new GuideManager(rows,{present:()=>{},clear:()=>{}});
    assert.equal(manager.allowsAction('settings'),false);
    manager.resume({phase:'puzzle',pageId:'puzzle'});
    assert.equal(manager.allowsPiece('p0'),true);assert.equal(manager.allowsPiece('p1'),false);
    assert.equal(manager.allowsPlacement('p0',{q:4,r:0}),true);assert.equal(manager.allowsPlacement('p0',{q:3,r:0}),false);
    for(const action of ['settings','puzzle:undo','puzzle:restart','puzzle:tray','result:next'])assert.equal(manager.allowsAction(action),false);
    manager.suspend();assert.equal(manager.allowsPiece('p0'),false);manager.retry();
    assert.equal(manager.onEvent({type:'puzzle.placementCommitted',pieceId:'p0',targetCell:{q:4,r:0}}),true);
    assert.equal(manager.allowsPiece('p1'),true);assert.equal(manager.allowsAction('puzzle:undo'),true);assert.equal(manager.allowsAction('settings'),false);
    manager.resume({phase:'complete',pageId:'home'});assert.equal(manager.allowsAction('settings'),true);
});

test('welcome resumes from its business phase and a failed step save can recover',()=>{
    let fail=false,shown=null;
    const rows=[step('build',{nextStepId:'welcome',completeEvent:'page.ready',params:{allowedActions:['home:build']}}),
        step('welcome',{pageId:'welcome',targetId:'welcome.claim',completeEvent:'welcome.rewardCommitted',params:{allowedActions:['welcome:claim']}})];
    const manager=new GuideManager(rows,{present:s=>shown=s.id,clear:()=>shown=null,persistStep:()=>{if(fail)throw Error('disk full');}});
    manager.resume({phase:'build',pageId:'home'});fail=true;
    assert.equal(manager.onEvent({type:'page.ready',pageId:'welcome'}),false);
    assert.equal(manager.activeStep.id,'build');assert.equal(manager.allowsAction('welcome:claim'),false);
    fail=false;manager.retry();assert.equal(manager.activeStep.id,'welcome');assert.equal(shown,'welcome');
    manager.resume({phase:'welcome',pageId:'welcome',stepId:'build'});
    assert.equal(shown,'welcome');assert.equal(manager.allowsAction('welcome:claim'),true);assert.equal(manager.allowsAction('dialog:close'),false);
});

test('initial and cross-page resume writes retry the pending step without releasing forced actions',()=>{
    let fail=true,shown=null;
    const rows=[step('build',{params:{allowedActions:['home:build']}}),step('welcome',{pageId:'welcome',targetId:'welcome.claim',params:{allowedActions:['welcome:claim']}})];
    const manager=new GuideManager(rows,{present:s=>shown=s.id,clear:()=>shown=null,persistStep:()=>{if(fail)throw Error('disk full');}});
    manager.resume({phase:'build',pageId:'home'});
    assert.equal(manager.activeStep,null);assert.equal(manager.allowsAction('home:build'),false);
    fail=false;manager.retry();assert.equal(shown,'build');
    fail=true;manager.resume({phase:'welcome',pageId:'welcome'});
    assert.equal(shown,null);assert.equal(manager.allowsAction('welcome:claim'),false);
    fail=false;manager.retry();assert.equal(shown,'welcome');assert.equal(manager.allowsAction('welcome:claim'),true);
});

test('three drag lessons restore the first unfinished placement even from an old free-play step',()=>{
    const lessons=[0,1,2].map(i=>step('drag'+i,{pageId:'puzzle',action:'drag',nextStepId:i<2?'drag'+(i+1):'win',completeEvent:'puzzle.placementCommitted',
        params:{pieceId:'p'+i,targetCell:{q:i,r:0},allowedActions:['puzzle:drag']}}));
    const rows=[...lessons,step('win',{pageId:'puzzle',action:'wait',params:{allowedActions:[]}})];
    let shown=null;const manager=new GuideManager(rows,{present:s=>shown=s.id,clear:()=>shown=null});
    manager.resume({phase:'puzzle',pageId:'puzzle',stepId:'win',placements:{}});assert.equal(shown,'drag0');
    manager.resume({phase:'puzzle',pageId:'puzzle',stepId:'win',placements:{p0:{q:0,r:0}}});assert.equal(shown,'drag1');
    assert.equal(manager.allowsPiece('p0'),false);assert.equal(manager.allowsPiece('p1'),true);assert.equal(manager.allowsAction('puzzle:undo'),false);
    manager.resume({phase:'puzzle',pageId:'puzzle',stepId:'drag0',placements:{p0:{q:0,r:0},p1:{q:1,r:0}}});assert.equal(shown,'drag2');
    assert.equal(manager.onEvent({type:'puzzle.placementCommitted',pieceId:'p2',targetCell:{q:2,r:0}}),true);assert.equal(shown,'win');
    assert.equal(manager.allowsPiece('p0'),false);
    manager.resume({phase:'puzzle',pageId:'puzzle',stepId:'win',placements:{p0:{q:9,r:0},p1:{q:1,r:0}}});assert.equal(shown,'drag0');
});
test('missing target registry resolves null and stale teardown cannot remove a replacement',()=>{
    const registry=new GuideTargetRegistry();assert.equal(registry.resolve('missing'),null);
    const first={},second={},off=registry.register('home.build',first);off();registry.register('home.build',second);off();
    assert.equal(registry.resolve('home.build'),second);assert.throws(()=>registry.register('home.build',first),/already registered/);
});
test('drag pointer can cross dark area while extra pointers and dark starts stay blocked',()=>{
    const input=new GuideInput();input.enabled=true;input.action='drag';input.regions=[{x:10,y:10,width:20,height:20,shape:'rect'}];
    assert.equal(input.accepts('start',1,{x:200,y:200}),false);
    assert.equal(input.accepts('start',1,{x:10,y:10}),true);
    assert.equal(input.accepts('move',1,{x:200,y:200}),true);
    assert.equal(input.accepts('start',2,{x:10,y:10}),false);
    assert.equal(input.accepts('end',1,{x:200,y:200}),true);
    assert.equal(input.accepts('move',1,{x:10,y:10}),false);
    input.reset();assert.equal(input.accepts('start',2,{x:200,y:200}),true);
});
test('circle and rounded corners follow visible holes instead of rectangular bounding boxes',()=>{
    assert.equal(contains({x:0,y:0,width:20,height:20,radius:10,shape:'circle'},{x:9,y:9}),false);
    assert.equal(contains({x:0,y:0,width:20,height:20,radius:8,shape:'roundRect'},{x:9,y:9}),false);
    assert.equal(contains({x:0,y:0,width:20,height:20,radius:8,shape:'roundRect'},{x:0,y:9}),true);
});
test('explicit configured group start honours its trigger',()=>{
    const manager=new GuideManager([step('a',{triggerEvent:'reward.claimed'})],{present:()=>{},clear:()=>{}});
    const context={phase:'build',pageId:'home'};
    assert.equal(manager.start('a',context,{type:'button.click'}),false);
    assert.equal(manager.activeStep,null);
    assert.equal(manager.start('a',context,{type:'reward.claimed'}),true);
    assert.equal(manager.activeStep.id,'a');
});
test('drag teaching requires the configured destination, not merely any valid placement',()=>{
    const drag=step('drag',{pageId:'puzzle',action:'drag',completeEvent:'puzzle.placementCommitted',params:{pieceId:'p0',targetCell:{q:1,r:2}}});
    const manager=new GuideManager([drag],{present:()=>{},clear:()=>{}});
    manager.resume({phase:'puzzle',pageId:'puzzle',attemptId:'attempt-1'});
    assert.equal(manager.onEvent({type:'puzzle.placementCommitted',attemptId:'attempt-2',pieceId:'p0',targetCell:{q:1,r:2}}),false);
    assert.equal(manager.onEvent({type:'puzzle.placementCommitted',attemptId:'attempt-1',pieceId:'p0'}),false);
    assert.equal(manager.onEvent({type:'puzzle.placementCommitted',attemptId:'attempt-1',pieceId:'p0',targetCell:{q:2,r:2}}),false);
    assert.equal(manager.onEvent({type:'puzzle.placementCommitted',attemptId:'attempt-1',pieceId:'p0',targetCell:{q:1,r:2}}),true);
});
test('polygon drag starts include hex edges but exclude transparent corners and destination',()=>{
    const hex=[{x:-10,y:0},{x:-5,y:8.66},{x:5,y:8.66},{x:10,y:0},{x:5,y:-8.66},{x:-5,y:-8.66}];
    assert.equal(pointInPolygon(hex,{x:0,y:0}),true);
    assert.equal(pointInPolygon(hex,{x:10,y:0}),true);
    assert.equal(pointInPolygon(hex,{x:9,y:8}),false);
    const input=new GuideInput();input.enabled=true;input.action='drag';
    input.regions=[{x:0,y:0,width:20,height:20,shape:'rect'},{x:100,y:100,width:20,height:20,shape:'rect'}];
    input.sourcePolygons=[hex];
    assert.equal(input.canStart({x:100,y:100}),false);
    assert.equal(input.canStart({x:9,y:8}),false);
    assert.equal(input.accepts('start',7,{x:0,y:0}),true);
    assert.equal(input.accepts('move',7,{x:50,y:50}),true);
    assert.equal(input.accepts('end',7,{x:100,y:100}),true);
});
test('presentation uses configured duration and normalized fingertip with safe old-config defaults',()=>{
    const old=guidePresentation(undefined,{handTipX:.4,handTipY:.95});
    assert.equal(old.handTipX,.4);assert.equal(old.handTipY,.95);
    assert.equal(old.handWidth,140);assert.equal(old.handHeight,200);
    assert.ok(Math.abs(old.sourceHold+old.pressDuration+old.dragDuration+old.destinationHold+old.fadeDuration+old.loopDelay-1.95)<1e-9);
    const changed=guidePresentation({dragDuration:1.2,handTipX:1.5,handTipY:-1,pulseMinOpacity:100,pulseMaxOpacity:20,instructionY:-210});
    assert.equal(changed.dragDuration,1.2);assert.equal(changed.handTipX,1);assert.equal(changed.handTipY,0);
    assert.equal(changed.pulseMaxOpacity,100);assert.equal(changed.instructionY,-210);
});
