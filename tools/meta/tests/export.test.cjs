const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),xlsx=require('node-xlsx');
const {parseRows,exportConfig,convert}=require('../app.cjs');
const {schemas}=require('../schema.cjs');
const project=path.resolve(__dirname,'../../..');
const scratch=path.resolve(project,'../tmp/prototype/first-release/meta/tests');fs.mkdirSync(scratch,{recursive:true});
function fixture(){const folder=fs.mkdtempSync(path.join(scratch,'case-'));for(const name of Object.keys(schemas))fs.copyFileSync(path.join(project,'config/excel',name+'.xlsx'),path.join(folder,name+'.xlsx'));return folder;}
function edit(folder,name,fn){const data=xlsx.parse(path.join(folder,name+'.xlsx'))[0].data;fn(data);fs.writeFileSync(path.join(folder,name+'.xlsx'),xlsx.build([{name:'Data',data}]));}
test('seven independent workbooks combine deterministically; all 110 puzzle references survive',()=>{
 const output=path.join(scratch,'valid.json'),report=exportConfig({output});assert.equal(report.tables,7);assert.equal(report.rows.Mainline,110);
 const before=fs.readFileSync(output,'utf8');exportConfig({output});assert.equal(fs.readFileSync(output,'utf8'),before);
 const json=JSON.parse(before);assert.equal(json.tables.Constants.energyRecoverSeconds[2],300);assert.equal(Object.keys(json.tables.Maps).length,2);
});
test('bad duplicate IDs identify workbook/row and preserve previous output',()=>{
 const input=fixture(),output=path.join(input,'output.json');fs.writeFileSync(output,'unchanged');
 edit(input,'Rewards',data=>{data.push([...data[3]]);});
 assert.throws(()=>exportConfig({input,output}),/Rewards.xlsx\/Data\/row8\/id: duplicate/);assert.equal(fs.readFileSync(output,'utf8'),'unchanged');
});
test('unaffordable initial upgrade and missing building slots are rejected',()=>{
 const input=fixture(),output=path.join(input,'output.json');edit(input,'BuildingStages',data=>{data[4][data[2].indexOf('cost')]=101;});
 assert.throws(()=>exportConfig({input,output}),/cannot afford/);assert.equal(fs.existsSync(output),false);
 const missing=fixture();edit(missing,'MapBuildings',data=>data.pop());assert.throws(()=>exportConfig({input:missing,output}),/five unique slots/);
});
test('foreign keys, malformed JSON and illegal guide cycles produce actionable failures',()=>{
 const input=fixture(),output=path.join(input,'output.json');edit(input,'Mainline',data=>{data[3][data[2].indexOf('rewardId')]='missing';});assert.throws(()=>exportConfig({input,output}),/Mainline.xlsx\/Data\/row4\/rewardId/);
 const cyclic=fixture();edit(cyclic,'GuideSteps',data=>{data[3][data[2].indexOf('nextStepId')]='ftue-drag';});assert.throws(()=>exportConfig({input:cyclic,output}),/guide cycle/);
 const broken=fixture();edit(broken,'GuideSteps',data=>{data[3][data[2].indexOf('params')]='{broken';});assert.throws(()=>exportConfig({input:broken,output}),/row4\/params: invalid JSON/);
});
test('optional trailing fields stay aligned; zero is not blank; boolean and numbers are strict',()=>{
 const schema=schemas.Maps,keys=Object.keys(schema),row=['a','name','garden1.background',null,'map-complete'];
 const rows=parseRows('Maps',[keys,Object.values(schema),keys,row]);assert.equal(rows.a.nextMapId,null);assert.equal(rows.a.completionRewardId,'map-complete');
 assert.equal(convert(0,'int','test'),0);assert.equal(convert(1,'bool','test'),true);assert.throws(()=>convert('maybe','bool','test'),/expected/);assert.throws(()=>convert(1.5,'int','test'),/invalid/);
});
test('invalid first puzzle target and unregistered guide slots fail before publishing',()=>{
 const input=fixture(),output=path.join(input,'output.json');edit(input,'GuideSteps',data=>{const i=data[2].indexOf('params'),p=JSON.parse(data[3][i]);p.targetCell={q:999,r:999};data[3][i]=JSON.stringify(p);});assert.throws(()=>exportConfig({input,output}),/targetCell/);
 const second=fixture();edit(second,'GuideSteps',data=>{const i=data[2].indexOf('params'),row=data.find(r=>r[0]==='ftue-upgrade'),p=JSON.parse(row[i]);p.slotId=6;row[i]=JSON.stringify(p);});assert.throws(()=>exportConfig({input:second,output}),/guide slot/);
});
test('drag animation seed preserves real targets and loops until committed placement',()=>{
 const output=path.join(scratch,'animation-seed.json');exportConfig({output});
 const guide=JSON.parse(fs.readFileSync(output,'utf8')).tables.GuideSteps,keys=guide.keys;
 const drag=Object.fromEntries(keys.map((key,i)=>[key,guide['ftue-drag'][i]]));
 assert.equal(drag.timeoutSeconds,0);assert.equal(drag.params.pieceId,'piece-0-1_png');
 assert.equal(drag.params.dragSourceTargetId,'puzzle.piece0');assert.equal(drag.params.dragDestinationTargetId,'puzzle.target0');
 assert.deepEqual(drag.params.targetCell,{q:4,r:0});
 assert.equal(drag.params.presentation.dragDuration,0.9);assert.equal(drag.params.presentation.handWidth,140);
});
test('presentation is optional for legacy tables and accepts partial finite overrides',()=>{
 for(const presentation of [undefined,{}, {handTipX:0,handTipY:1,instructionX:-90,instructionY:0,pulseMinOpacity:0,pulseMaxOpacity:255}]){
  const input=fixture(),output=path.join(input,'output.json');
  edit(input,'GuideSteps',data=>{const i=data[2].indexOf('params'),p=JSON.parse(data[3][i]);if(presentation===undefined)delete p.presentation;else p.presentation=presentation;data[3][i]=JSON.stringify(p);});
  assert.doesNotThrow(()=>exportConfig({input,output}));
 }
});
test('bad animation numbers and ranges fail without replacing the previous config',()=>{
 const bad=[null,[],{handWidth:0},{handHeight:-1},{sourceHold:0},{pressDuration:-1},{dragDuration:'0.9'},{destinationHold:0},{fadeDuration:0},{loopDelay:0},{pulseDuration:0},{pulseMinOpacity:-1},{pulseMaxOpacity:256},{pulseMinOpacity:191},{pulseMinOpacity:100,pulseMaxOpacity:99},{handTipX:1.1},{handTipY:-0.1},{instructionX:true},{unknown:1}];
 for(const presentation of bad){
  const input=fixture(),output=path.join(input,'output.json');fs.writeFileSync(output,'unchanged');
  edit(input,'GuideSteps',data=>{const i=data[2].indexOf('params'),p=JSON.parse(data[3][i]);p.presentation=presentation;data[3][i]=JSON.stringify(p);});
  assert.throws(()=>exportConfig({input,output}),/GuideSteps.xlsx\/Data\/row4\/params.presentation/);assert.equal(fs.readFileSync(output,'utf8'),'unchanged');
 }
 const input=fixture(),output=path.join(input,'output.json');fs.writeFileSync(output,'unchanged');
 edit(input,'GuideSteps',data=>{const i=data[2].indexOf('params'),p=JSON.parse(data[3][i]);p.presentation={dragDuration:1};data[3][i]=JSON.stringify(p).replace('"dragDuration":1','"dragDuration":1e999');});
 assert.throws(()=>exportConfig({input,output}),/finite number/);assert.equal(fs.readFileSync(output,'utf8'),'unchanged');
});
test('real exported MetaManager supports durable first win and first building upgrade',()=>{
 const vm=require('node:vm'),ts=require(process.env.TYPESCRIPT_PATH||'G:/cocosCreator/Editor/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
 const cache=new Map();function load(file){file=file.endsWith('.ts')?file:file+'.ts';if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInThisContext('(function(module,exports,require){'+code+'\n})',{filename:file})(module,module.exports,name=>load(path.resolve(path.dirname(file),name)));return module.exports;}
 const {MetaManager}=load(path.join(project,'assets/scripts/features/config/MetaManager'));
 const {GameStateStore}=load(path.join(project,'assets/scripts/features/progression/GameStateStore'));
 const {GameServices}=load(path.join(project,'assets/scripts/features/progression/GameServices'));
 const raw=JSON.parse(fs.readFileSync(path.join(project,'assets/resources/config/game-config.json'),'utf8')),meta=new MetaManager(raw);
 const writes=new Map(),storage={getItem:key=>writes.get(key)??null,setItem:(key,val)=>writes.set(key,val)},store=new GameStateStore(storage,meta,()=>1000000),services=new GameServices(store,meta,()=>1000000,()=>{});
 const attempt=services.startOrResume();
 services.saveAttempt({attemptId:attempt.attemptId,levelId:attempt.puzzleId,moves:3,status:'completed',revision:1,placements:{},selectedPieceId:null,placementOrder:[]});
 services.completeAttempt(attempt.attemptId);assert.equal(services.state.coins,100);assert.equal(services.getGuidePhase(),'build');
 services.upgrade('garden-1',1,0);assert.equal(services.state.coins,60);assert.equal(services.getGuidePhase(),'welcome');
 services.claimWelcome();assert.equal(services.state.coins,160);assert.equal(services.getGuidePhase(),'complete');
 assert.equal(new GameStateStore(storage,meta,()=>1000000).read().guide.completed,true);
 assert.equal(meta.getMainlineCount(),110);assert.equal(meta.getMainline(110).puzzleId,'challenge-030');assert.equal(Object.isFrozen(meta.getBuildingStages('treehouse')),true);
 raw.tables.Constants.energyRecoverSeconds[2]=0;assert.throws(()=>new MetaManager(raw),/energy/);
});

test('welcome reward reference and registered presentation/actions are validated before export',()=>{
 const unknown=fixture(),output=path.join(unknown,'out.json');fs.writeFileSync(output,'unchanged');
 edit(unknown,'Constants',data=>{data.find(row=>row[0]==='welcomeRewardId')[2]='missing';});
 assert.throws(()=>exportConfig({input:unknown,output}),/welcomeRewardId/);assert.equal(fs.readFileSync(output,'utf8'),'unchanged');
 for(const patch of [{highlightProvider:'arbitraryMethod'},{allowedActions:['settings']},{allowedActions:'puzzle:drag'}]){
  const input=fixture();edit(input,'GuideSteps',data=>{const i=data[2].indexOf('params'),p=JSON.parse(data[3][i]);Object.assign(p,patch);data[3][i]=JSON.stringify(p);});
  assert.throws(()=>exportConfig({input,output:path.join(input,'out.json')}),/highlightProvider|allowedActions/);
 }
 const missing=fixture();edit(missing,'GuideSteps',data=>{const keys=data[2],row=data.find(r=>r[0]==='ftue-upgrade');row[keys.indexOf('nextStepId')]='ftue-welcome';const welcome=data.find(r=>r[0]==='ftue-welcome');welcome[keys.indexOf('completeEvent')]='button.click';});
 assert.throws(()=>exportConfig({input:missing,output:path.join(missing,'out.json')}),/welcome exit/);
});

test('three forced placements use matching original pieces and tile footprints; win wait grants no actions',()=>{
 const output=path.join(scratch,'three-drags.json');exportConfig({output});
 const table=JSON.parse(fs.readFileSync(output,'utf8')).tables.GuideSteps,keys=table.keys;
 const row=id=>Object.fromEntries(keys.map((key,i)=>[key,table[id][i]]));
 const ids=['ftue-drag','ftue-drag-2','ftue-drag-3'];
 const targets=[{q:4,r:0},{q:5,r:-2},{q:6,r:-1}],pieces=['piece-0-1_png','piece-1-3_png','piece-2-6_png'];
 ids.forEach((id,i)=>{const s=row(id);assert.equal(s.params.pieceId,pieces[i]);assert.deepEqual(s.params.targetCell,targets[i]);assert.equal(s.targetId,'puzzle.piece'+i);assert.equal(s.params.dragDestinationTargetId,'puzzle.target'+i);assert.deepEqual(s.params.allowedActions,['puzzle:drag']);assert.equal(s.nextStepId,ids[i+1]||'ftue-win');assert.equal(s.skippable,false);assert.equal(s.timeoutSeconds,0);});
 assert.deepEqual(row('ftue-win').params.allowedActions,[]);
 const brokenCases=[
  data=>{const i=data[2].indexOf('params'),s=data.find(r=>r[0]==='ftue-drag-2'),p=JSON.parse(s[i]);p.pieceId=pieces[0];s[i]=JSON.stringify(p);},
  data=>{const i=data[2].indexOf('params'),s=data.find(r=>r[0]==='ftue-drag-2'),p=JSON.parse(s[i]);p.dragDestinationTargetId='puzzle.target0';s[i]=JSON.stringify(p);},
  data=>{const i=data[2].indexOf('params'),s=data.find(r=>r[0]==='ftue-drag-3'),p=JSON.parse(s[i]);p.targetCell={q:6,r:0};s[i]=JSON.stringify(p);},
  data=>{const i=data[2].indexOf('params'),s=data.find(r=>r[0]==='ftue-win');s[i]=JSON.stringify({allowedActions:['puzzle:undo']});},
  data=>data.splice(data.findIndex(r=>r[0]==='ftue-drag-3'),1)
 ];
 for(const editFn of brokenCases){const input=fixture(),out=path.join(input,'out.json');fs.writeFileSync(out,'previous');edit(input,'GuideSteps',editFn);assert.throws(()=>exportConfig({input,output:out}),/GuideSteps/);assert.equal(fs.readFileSync(out,'utf8'),'previous');}
});
