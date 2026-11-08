import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_PATH || 'G:/cocosCreator/Editor/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const root = path.resolve(import.meta.dirname, '../../..');
const cache = new Map();
function load(file) {
    file = file.endsWith('.ts') ? file : file + '.ts';
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInThisContext('(function(module,exports,require){' + output + '\n})', { filename: file })(module, module.exports,
        name => { assert.ok(name.startsWith('.')); return load(path.resolve(path.dirname(file), name)); });
    return module.exports;
}
const { GameStateStore, GAME_SAVE_KEY } = load(path.join(root, 'assets/scripts/features/progression/GameStateStore'));
const { GameServices } = load(path.join(root, 'assets/scripts/features/progression/GameServices'));
function fixture(constants = {}, nextMapId = null) {
    let now = 1000000, writes = 0, fail = false;
    const data = new Map();
    const values = { energyMax: 5, energyInitial: 5, energyRecoverSeconds: 300, energyFailureCost: 1,
        initialCoins: 0, initialHints: 5, firstMapId: 'garden-1', firstGuideGroupId: 'first-session', welcomeRewardId:'welcome', ...constants };
    const meta = {
        getConstant: id => values[id],
        getMap: id => { if (!['garden-1','garden-2'].includes(id)) throw Error('map'); return { id, nextMapId: id === 'garden-1' ? nextMapId : null, completionRewardId: 'map' }; },
        getMapBuildings: () => Array.from({ length: 5 }, (_,i) => ({ slotId:i+1, buildingId:'b'+i })),
        getBuildingStage: (id,stage) => { if(stage<0||stage>5)throw Error('max'); return {stage,cost:stage===0?0:20+20*stage}; },
        getBuildingStages: () => Array.from({length:6},(_,stage)=>({stage,cost:stage===0?0:20+20*stage})),
        getMainline: no => { if(no<1||no>2)throw Error('level'); return {levelNo:no,puzzleId:'p'+no,rewardId:'win'}; },
        getMainlineCount: () => 2,
        getReward: id => ['map','welcome'].includes(id)?{coins:100,energy:0,hints:1}:{coins:100,energy:0,hints:0}
    };
    const storage = { getItem:key=>data.get(key)??null, setItem:(key,value)=>{if(fail)throw Error('disk full');data.set(key,value);writes++;} };
    const clock=()=>now,store=new GameStateStore(storage,meta,clock),services=new GameServices(store,meta,clock,()=>{});
    return {meta,storage,store,services,data,clock,setTime:n=>now=n,setFail:value=>fail=value,get writes(){return writes;}};
}
function snapshot(attempt, revision=1, status='active', activeHintPieceId=null) {
    return {attemptId:attempt.attemptId,levelId:attempt.puzzleId,moves:revision,status,placements:{a:{q:0,r:0}},selectedPieceId:null,revision,placementOrder:['a'],activeHintPieceId};
}
function firstWin(f) { const a=f.services.startOrResume();f.services.saveAttempt(snapshot(a,1,'completed')); return a; }

test('first win and first upgrade are separate durable tutorial milestones; each reward/charge is once',()=>{
    const f=fixture(),a=firstWin(f);
    assert.equal(f.services.getGuidePhase(),'build');assert.equal(f.services.state.coins,100);
    assert.equal(f.services.completeAttempt(a.attemptId),false);
    assert.equal(f.services.upgrade('garden-1',1,0),true);
    assert.equal(f.services.getGuidePhase(),'welcome');assert.equal(f.services.state.coins,60);assert.equal(f.services.state.guide.completed,false);
    assert.equal(f.services.upgrade('garden-1',1,0),false);assert.equal(f.services.state.coins,60);
    const restored=new GameServices(new GameStateStore(f.storage,f.meta,f.clock),f.meta,f.clock);
    assert.equal(restored.getGuidePhase(),'welcome');assert.equal(restored.state.guide.completed,false);
    assert.equal(restored.claimWelcome(),true);assert.equal(restored.state.coins,160);assert.equal(restored.state.hints,6);assert.equal(restored.state.energy,5);
    assert.equal(restored.getGuidePhase(),'complete');assert.equal(restored.state.guide.completed,true);
    assert.equal(restored.claimWelcome(),false);assert.equal(restored.state.coins,160);
});
test('failed storage writes leave snapshot, money, revision and notifications unchanged',()=>{
    const f=fixture(),a=f.services.startOrResume();let notifications=0;f.store.subscribe(()=>notifications++);
    const before=JSON.stringify(f.services.state);f.setFail(true);
    assert.throws(()=>f.services.saveAttempt(snapshot(a,1,'completed')),/disk full/);
    assert.equal(JSON.stringify(f.services.state),before);assert.equal(notifications,0);
    f.setFail(false);f.services.saveAttempt(snapshot(a,1,'completed'));assert.equal(f.services.state.coins,100);
});

test('welcome cannot be claimed early; failed claim stays pending and retry grants exactly once',()=>{
    const f=fixture();assert.throws(()=>f.services.claimWelcome(),/首次建造/);
    firstWin(f);assert.throws(()=>f.services.claimWelcome(),/首次建造/);
    f.services.upgrade('garden-1',1,0);
    const before=JSON.stringify(f.services.state),events=[];f.services.subscribe(e=>events.push(e.type));
    f.setFail(true);assert.throws(()=>f.services.claimWelcome(),/disk full/);
    assert.equal(JSON.stringify(f.services.state),before);assert.deepEqual(events,[]);
    f.setFail(false);const restored=new GameServices(new GameStateStore(f.storage,f.meta,f.clock),f.meta,f.clock);
    assert.equal(restored.getGuidePhase(),'welcome');assert.equal(restored.reconcileGuide(),false);
    assert.equal(restored.claimWelcome(),true);const paid=JSON.stringify(restored.state);
    assert.equal(restored.claimWelcome(),false);assert.equal(JSON.stringify(restored.state),paid);
    assert.equal(restored.state.receipts['welcome-reward:first-session'],true);assert.equal(restored.state.guide.completed,true);
    assert.equal(restored.state.guide.stepId,null);assert.equal(restored.state.coins,160);assert.equal(restored.state.hints,6);
});

test('completed legacy accounts keep balances and never re-enter or receive the welcome gift',()=>{
    const f=fixture();firstWin(f);f.services.upgrade('garden-1',1,0);
    f.store.transact(null,s=>{s.guide.completed=true;s.coins=321;s.energy=2;s.nextEnergyAt=f.clock()+300000;s.hints=7;});
    const restored=new GameServices(new GameStateStore(f.storage,f.meta,f.clock),f.meta,f.clock);
    assert.equal(restored.getGuidePhase(),'complete');assert.equal(restored.reconcileGuide(),false);
    assert.equal(restored.claimWelcome(),false);assert.equal(restored.state.coins,321);assert.equal(restored.state.energy,2);assert.equal(restored.state.hints,7);
    assert.equal(restored.state.receipts['welcome-reward:first-session'],undefined);
});
test('hint activation is persisted with one hint debit, duplicates and failed writes do not consume',()=>{
    const f=fixture(),a=f.services.startOrResume(),s=snapshot(a,1,'active','a');
    f.setFail(true);assert.throws(()=>f.services.saveAttempt(s));assert.equal(f.services.state.hints,5);
    f.setFail(false);f.services.saveAttempt(s);assert.equal(f.services.state.hints,4);
    f.services.saveAttempt(s);f.services.saveAttempt({...s,revision:2});assert.equal(f.services.state.hints,4);
});
test('zero energy tutorial creates/restarts; ordinary empty energy cannot create but can resume',()=>{
    const f=fixture({energyInitial:0});const a=f.services.startOrResume();assert.equal(a.tutorial,true);
    f.services.endAttempt(a.attemptId,'restart');assert.equal(f.services.state.energy,0);
    const b=f.services.startOrResume();assert.notEqual(a.attemptId,b.attemptId);f.services.saveAttempt(snapshot(b,1,'completed'));
    assert.throws(()=>f.services.startOrResume(),/体力不足/);
    const g=fixture();firstWin(g);const ordinary=g.services.startOrResume();
    g.store.transact(null,state=>{state.energy=0;state.nextEnergyAt=g.clock()+300000;});
    assert.equal(g.services.startOrResume().attemptId,ordinary.attemptId);
});
test('failure/restart charges once, preserves recovery progress; 300 seconds replenishes and offline clamps',()=>{
    const f=fixture();firstWin(f);const a=f.services.startOrResume();f.services.endAttempt(a.attemptId,'restart');
    assert.equal(f.services.state.energy,4);const at=f.services.state.nextEnergyAt;
    assert.equal(f.services.endAttempt(a.attemptId,'restart'),false);
    f.setTime(f.clock()+100000);const b=f.services.startOrResume();f.services.endAttempt(b.attemptId,'abandoned');
    assert.equal(f.services.state.energy,3);assert.equal(f.services.state.nextEnergyAt,at);
    f.setTime(at-1);const writes=f.writes;assert.equal(f.services.refresh(),false);assert.equal(f.writes,writes);
    f.setTime(at);f.services.refresh();assert.equal(f.services.state.energy,4);
    f.setTime(at+900000);f.services.refresh();assert.equal(f.services.state.energy,5);assert.equal(f.services.state.nextEnergyAt,null);
});
test('initial energy below max starts recovery using configured interval; full energy never banks recovery',()=>{
    const f=fixture({energyInitial:2,energyRecoverSeconds:60});assert.equal(f.services.state.nextEnergyAt,f.clock()+60000);
    f.setTime(f.clock()+180000);f.services.refresh();assert.equal(f.services.state.energy,5);
    f.setTime(f.clock()+999999);firstWin(f);const a=f.services.startOrResume();f.services.endAttempt(a.attemptId);
    assert.equal(f.services.state.nextEnergyAt,f.clock()+60000);assert.equal(f.services.state.energy,4);
});
test('map rewards require all configured stages, survive reload, and do not reset the last map',()=>{
    const f=fixture();assert.throws(()=>f.services.claimMap(),/尚未完成/);
    f.store.transact(null,s=>{s.coins=5000;});
    for(let slot=1;slot<=5;slot++)for(let stage=0;stage<5;stage++)f.services.upgrade('garden-1',slot,stage);
    assert.deepEqual(f.services.mapProgress(),{current:25,total:25,complete:true});
    const before=f.services.state.coins;f.services.claimMap();assert.equal(f.services.state.coins,before+100);
    assert.equal(f.services.claimMap(),false);assert.equal(f.services.state.currentMapId,'garden-1');
    assert.equal(f.services.state.buildings['garden-1']['1'],5);
});
test('bad save is preserved in both original and recovery copy, never overwritten with a fresh account',()=>{
    const f=fixture();f.data.set(GAME_SAVE_KEY,'{broken');
    assert.throws(()=>new GameStateStore(f.storage,f.meta,f.clock),/原始数据已保留/);
    assert.equal(f.data.get(GAME_SAVE_KEY),'{broken');assert.equal(f.data.get(GAME_SAVE_KEY+'.corrupt.'+f.clock()),'{broken');
});
test('next map initialisation preserves previous stages and reward receipts',()=>{
    const f=fixture({},'garden-2');f.store.transact(null,s=>{for(let slot=1;slot<=5;slot++)s.buildings['garden-1'][slot]=5;});
    f.services.claimMap();assert.equal(f.services.state.currentMapId,'garden-2');assert.equal(f.services.state.buildings['garden-1']['1'],5);
    assert.equal(f.services.state.buildings['garden-2']['1'],0);assert.equal(f.services.claimMap('garden-1'),false);
});
test('clock rollback never adds energy; immutable state cannot be mutated by views',()=>{
    const f=fixture({energyInitial:2});const due=f.services.state.nextEnergyAt;f.setTime(0);
    assert.equal(f.services.refresh(),false);assert.equal(f.services.state.energy,2);assert.equal(f.services.state.nextEnergyAt,due);
    assert.throws(()=>{f.services.state.coins=999;},TypeError);
});

test('unvalidated completion cannot award coins and validator rejection leaves the account unchanged',()=>{
    const f=fixture(),a=f.services.startOrResume();
    const guarded=new GameServices(f.store,f.meta,f.clock);
    assert.throws(()=>guarded.saveAttempt(snapshot(a,1,'completed')),/缺少拼图规则验证/);
    const rejecting=new GameServices(f.store,f.meta,f.clock,()=>{throw Error('not actually solved');});
    assert.throws(()=>rejecting.saveAttempt(snapshot(a,1,'completed')),/not actually solved/);
    assert.equal(f.services.state.coins,0);assert.equal(f.services.state.currentLevelNo,1);
});
test('final placement event precedes committed win for tutorial drag-to-win transitions',()=>{
    const f=fixture(),a=f.services.startOrResume(),events=[];
    f.services.subscribe(e=>events.push(e.type));f.services.saveAttempt(snapshot(a,1,'completed'));
    assert.deepEqual(events,['puzzle.placementCommitted','puzzle.winCommitted']);
});

test('real exported config and puzzle persistence hook reject forged victory and roll back failed placements',()=>{
    const { MetaManager }=load(path.join(root,'assets/scripts/features/config/MetaManager'));
    const { PuzzleSession }=load(path.join(root,'assets/scripts/features/puzzle/session/PuzzleSession'));
    const meta=new MetaManager(JSON.parse(fs.readFileSync(path.join(root,'assets/resources/config/game-config.json'),'utf8')));
    const levels=JSON.parse(fs.readFileSync(path.join(root,'assets/bundles/puzzle/config/level-catalog.json'),'utf8')).levels;
    const data=new Map();let fail=false;
    const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>{if(fail)throw Error('disk unavailable');data.set(key,value);}};
    const store=new GameStateStore(storage,meta,()=>1000000);
    const validate=snapshot=>{const level=levels.find(row=>row.id===snapshot.levelId);if(!level)throw Error('unknown puzzle');new PuzzleSession(level,snapshot.attemptId).restore(snapshot);};
    const services=new GameServices(store,meta,()=>1000000,validate);
    const attempt=services.startOrResume(),level=levels.find(row=>row.id===attempt.puzzleId);
    const session=new PuzzleSession(level,attempt.attemptId);session.beforeCommit=candidate=>services.saveAttempt(candidate);
    assert.throws(()=>services.saveAttempt({...session.snapshot,status:'completed',revision:1}));assert.equal(services.state.coins,0);
    const piece=level.pieces[0],point={q:piece.targetCells[0].q-piece.cells[0].q,r:piece.targetCells[0].r-piece.cells[0].r};
    fail=true;assert.throws(()=>session.place(piece.id,point),/disk unavailable/);assert.deepEqual(session.snapshot.placements,{});assert.equal(services.state.activeAttempt.snapshot,null);
    fail=false;
    for(const item of level.pieces)session.place(item.id,{q:item.targetCells[0].q-item.cells[0].q,r:item.targetCells[0].r-item.cells[0].r});
    assert.equal(session.snapshot.status,'completed');assert.equal(services.state.coins,meta.getReward(meta.getMainline(1).rewardId).coins);
    assert.equal(services.getGuidePhase(),'build');
});
