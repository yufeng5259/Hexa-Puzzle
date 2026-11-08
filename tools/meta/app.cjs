'use strict';
const fs=require('fs'),path=require('path'),xlsx=require('node-xlsx');
const {schemas,assetIds,targetIds}=require('./schema.cjs');
const PROJECT=path.resolve(__dirname,'../..');
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const forbidden=new Set(['keys','__proto__','constructor','prototype']);
function error(where,message){throw new Error(`${where}: ${message}`);}
function convert(value,type,where){
 const optional=type.endsWith('?');type=type.replace(/\?$/,'');
 if(value===null||value===undefined||value===''){if(optional)return null;error(where,'required value is blank');}
 if(typeof value==='object'&&!(type==='json'))error(where,'cell value must be a scalar');
 if(type==='string')return String(value);
 if(type==='int'||type==='number'){
  if(typeof value==='boolean'||String(value).trim()===''||!Number.isFinite(Number(value))||(type==='int'&&!Number.isSafeInteger(Number(value))))error(where,`invalid ${type}`);
  return Number(value);
 }
 if(type==='bool') {if(value===true||value===1||value==='1'||String(value).toLowerCase()==='true')return true;if(value===false||value===0||value==='0'||String(value).toLowerCase()==='false')return false;error(where,'expected true/false/0/1');}
 if(type==='json'){try{return typeof value==='string'?JSON.parse(value):value;}catch{error(where,'invalid JSON');}}
 error(where,`unknown type ${type}`);
}
function parseRows(name,data,sheet='Data'){
 const schema=schemas[name],where=`${name}.xlsx/${sheet}`;
 if(!schema||!Array.isArray(data)||data.length<3)error(where,'three header rows required');
 const types=data[1]||[],headers=data[2]||[],indices=[];const keys=[];
 for(let i=0;i<headers.length;i++){
  if(types[i]===null||types[i]===undefined||types[i]===''||types[i]==='null')continue;
  const key=String(headers[i]||'');
  if(!own(schema,key)||keys.includes(key))error(`${where}/row3/${key||i+1}`,'unknown or duplicate field');
  if(types[i]!==schema[key])error(`${where}/row2/${key}`,`expected ${schema[key]}`);
  keys.push(key);indices.push(i);
 }
 if(keys[0]!=='id'||Object.keys(schema).some(key=>!keys.includes(key)))error(where,'missing schema fields or id is not first');
 const rows=Object.create(null);
 for(let r=3;r<data.length;r++){
  const raw=data[r]||[];if(raw.every(value=>value===null||value===undefined||value===''))continue;
  const row=Object.create(null);
  keys.forEach((key,i)=>{row[key]=convert(raw[indices[i]],schema[key],`${where}/row${r+1}/${key}`);});
  if(!row.id.trim()||forbidden.has(row.id))error(`${where}/row${r+1}/id`,'invalid/reserved id');
  if(own(rows,row.id))error(`${where}/row${r+1}/id`,'duplicate id '+row.id);
  if(name==='Constants')row.value=convert(row.value,row.valueType,`${where}/row${r+1}/value`);
  Object.defineProperty(row,'_location',{value:`${where}/row${r+1}`,enumerable:false});rows[row.id]=row;
 }
 if(!Object.keys(rows).length)error(where,'no data rows');return rows;
}
function validate(tables,levels){
 const entries=name=>Object.values(tables[name]||{});
 const check=(row,field,condition,message)=>{if(!condition)error(`${row._location||row.id}/${field}`,message);};
 const ref=(row,field,table)=>check(row,field,own(tables[table],String(row[field])),`unknown ${table} id ${row[field]}`);
 for(const name of Object.keys(schemas))if(!tables[name])error(name,'missing table');
 const constant=id=>{if(!own(tables.Constants,id))error('Constants.xlsx',`missing ${id}`);return tables.Constants[id].value;};
 for(const id of ['energyMax','energyInitial','energyRecoverSeconds','energyFailureCost','initialCoins','initialHints']){
  const v=constant(id);check(tables.Constants[id],'value',Number.isSafeInteger(v)&&v>=0,'nonnegative safe integer required');
 }
 if(constant('energyMax')<1||constant('energyRecoverSeconds')<1||constant('energyInitial')>constant('energyMax'))error('Constants.xlsx','invalid energy bounds');
 if(!tables.Maps[constant('firstMapId')])error('Constants.xlsx/firstMapId','unknown map');
 if(!tables.Rewards[constant('welcomeRewardId')])error('Constants.xlsx/welcomeRewardId','unknown reward');
 for(const row of entries('Rewards'))for(const field of ['coins','energy','hints'])check(row,field,row[field]>=0,'negative reward');
 for(const row of entries('Maps')){
  ref(row,'completionRewardId','Rewards');if(row.nextMapId)ref(row,'nextMapId','Maps');
  check(row,'backgroundAssetId',assetIds.includes(row.backgroundAssetId),'unknown declared asset');
  const slots=entries('MapBuildings').filter(x=>x.mapId===row.id).sort((a,b)=>a.slotId-b.slotId);
  check(row,'id',slots.length===5&&slots.every((x,i)=>x.slotId===i+1),'map requires five unique slots 1..5');
  const seen=new Set([row.id]);let next=row.nextMapId;while(next){if(!own(tables.Maps,next))error(row._location+'/nextMapId','unknown map '+next);if(seen.has(next))error(row._location,'map cycle');seen.add(next);next=tables.Maps[next].nextMapId;}
 }
 for(const row of entries('MapBuildings')){
  ref(row,'mapId','Maps');check(row,'scale',row.scale>0,'scale must be positive');
  for(const field of ['anchorX','anchorY'])check(row,field,row[field]>=0&&row[field]<=1,'anchor outside 0..1');
  const stages=entries('BuildingStages').filter(x=>x.buildingId===row.buildingId).sort((a,b)=>a.stage-b.stage);
  check(row,'buildingId',stages.length>=2&&stages.every((x,i)=>x.stage===i),'building stages must be continuous from 0');
 }
 for(const row of entries('BuildingStages')){
  check(row,'stage',row.stage>=0,'negative stage');check(row,'cost',row.cost>=0&&(row.stage!==0||row.cost===0),'invalid cost');
  check(row,'bodyAssetId',assetIds.includes(row.bodyAssetId),'unknown declared asset');check(row,'effectId',row.effectId===null||row.effectId==='upgrade','unknown effect');
 }
 const puzzles=new Map(levels.map(row=>[row.id,row]));const main=entries('Mainline').sort((a,b)=>a.levelNo-b.levelNo);const used=new Set();
 for(let i=0;i<main.length;i++){
  const row=main[i];check(row,'levelNo',row.levelNo===i+1,'level numbers must be continuous');
  check(row,'puzzleId',puzzles.has(row.puzzleId)&&!used.has(row.puzzleId),'unknown or duplicate puzzle');used.add(row.puzzleId);ref(row,'rewardId','Rewards');
 }
 const guide=entries('GuideSteps'),groups=new Map();
 for(const row of guide){
  if(!groups.has(row.groupId))groups.set(row.groupId,[]);groups.get(row.groupId).push(row);
  check(row,'action',['click','drag','wait','continue'].includes(row.action),'unknown action');
  check(row,'shape',['none','rect','roundRect','circle'].includes(row.shape),'unknown shape');
  check(row,'targetId',row.targetId===null||targetIds.includes(row.targetId),'unknown declared target');
  check(row,'params',row.params&&typeof row.params==='object'&&!Array.isArray(row.params),'params must be object');
  for(const key of Object.keys(row.params))check(row,'params',['pieceId','targetCell','mapId','slotId','expectedStage','dragSourceTargetId','dragDestinationTargetId','pageId','mode','presentation','highlightProvider','allowedActions'].includes(key),'unknown params key '+key);
  check(row,'pageId',['home','puzzle','result','build','welcome'].includes(row.pageId),'unknown page');
  if(own(row.params,'highlightProvider'))check(row,'params.highlightProvider',row.params.highlightProvider==='puzzlePlacementPreview'&&row.action==='drag'&&!!row.params.pieceId&&!!row.params.targetCell,'invalid highlight provider');
  const allowedActions=['puzzle:drag','puzzle:undo','result:home','home:build','building:upgrade:1','welcome:claim'];
  check(row,'params.allowedActions',Array.isArray(row.params.allowedActions)&&row.params.allowedActions.every(action=>allowedActions.includes(action)),'allowedActions must contain registered actions');
  if(own(row.params,'presentation')){
   const p=row.params.presentation;
   check(row,'params.presentation',p&&typeof p==='object'&&!Array.isArray(p),'presentation must be object');
   const sizes=['handWidth','handHeight'],times=['sourceHold','pressDuration','dragDuration','destinationHold','fadeDuration','loopDelay','pulseDuration'];
   const opacity=['pulseMinOpacity','pulseMaxOpacity'],tips=['handTipX','handTipY'],positions=['instructionX','instructionY'];
   const allowed=[...sizes,...times,...opacity,...tips,...positions];
   for(const [key,value] of Object.entries(p)){
    check(row,'params.presentation.'+key,allowed.includes(key),'unknown presentation key '+key);
    check(row,'params.presentation.'+key,typeof value==='number'&&Number.isFinite(value),'finite number required');
    if(sizes.includes(key)||times.includes(key))check(row,'params.presentation.'+key,value>0,'size and duration must be positive');
    if(opacity.includes(key))check(row,'params.presentation.'+key,value>=0&&value<=255,'opacity outside 0..255');
    if(tips.includes(key))check(row,'params.presentation.'+key,value>=0&&value<=1,'hand tip outside 0..1');
   }
   check(row,'params.presentation',(p.pulseMinOpacity??70)<=(p.pulseMaxOpacity??190),'pulse minimum exceeds maximum');
  }
  for(const key of ['dragSourceTargetId','dragDestinationTargetId'])if(row.params[key])check(row,'params',targetIds.includes(row.params[key]),'unknown drag target');
  for(const field of ['padding','timeoutSeconds'])check(row,field,row[field]>=0,'negative value');
  for(const field of ['width','height','radius'])check(row,field,row[field]===null||row[field]>0,'size must be positive');
  if(row.nextStepId){ref(row,'nextStepId','GuideSteps');check(row,'nextStepId',tables.GuideSteps[row.nextStepId].groupId===row.groupId,'cross-group next');}
  const seen=new Set([row.id]);let next=row.nextStepId;while(next){if(!own(tables.GuideSteps,next))error(row._location+'/nextStepId','unknown guide '+next);if(seen.has(next))error(row._location,'guide cycle');seen.add(next);next=tables.GuideSteps[next].nextStepId;}
 }
 if(!groups.has(constant('firstGuideGroupId')))error('Constants.xlsx/firstGuideGroupId','unknown group');
 for(const [id,rows] of groups){const pointed=new Set(rows.map(x=>x.nextStepId));if(rows.filter(x=>!pointed.has(x.id)).length!==1||rows.filter(x=>!x.nextStepId).length!==1)error('GuideSteps.xlsx/'+id,'one entry and exit required');}
 const firstGroup=groups.get(constant('firstGuideGroupId'));
 for(const action of ['drag','click'])if(!firstGroup.some(row=>row.action===action))error('GuideSteps.xlsx','first guide requires drag and click');
 if(!firstGroup.some(row=>row.targetId==='home.build')||!firstGroup.some(row=>row.targetId==='building.slot1.upgrade'))error('GuideSteps.xlsx','missing build/upgrade guidance');
 const welcome=firstGroup.find(row=>row.targetId==='welcome.claim'),upgrade=firstGroup.find(row=>row.targetId==='building.slot1.upgrade');
 if(!welcome||welcome.pageId!=='welcome'||welcome.completeEvent!=='welcome.rewardCommitted'||welcome.nextStepId!==null||upgrade.nextStepId!==welcome.id)error('GuideSteps.xlsx','missing welcome exit after upgrade');
 const first=main[0],firstLevel=puzzles.get(first.puzzleId),piece=firstLevel.pieces;
 const dragged=firstGroup.filter(row=>row.action==='drag');
 check(dragged[0]||firstGroup[0],'params',piece.length===3&&dragged.length===piece.length,'first guide requires three consecutive puzzle drag steps');
 const covered=new Set(),guidedPieces=new Set();
 const boardCells=new Set(firstLevel.targetCells.map(cell=>`${cell.q},${cell.r}`));
 for(const row of dragged){
  const index=piece.findIndex(p=>p.id===row.params.pieceId),p=piece[index],cell=row.params.targetCell;
  check(row,'params',index>=0&&!guidedPieces.has(p.id),'duplicate or unknown guided piece');guidedPieces.add(p.id);
  check(row,'params',row.pageId==='puzzle'&&row.targetId===`puzzle.piece${index}`&&row.params.dragSourceTargetId===row.targetId&&row.params.dragDestinationTargetId===`puzzle.target${index}`,'guided source/destination must match the configured piece');
  check(row,'params.targetCell',cell&&Number.isSafeInteger(cell.q)&&Number.isSafeInteger(cell.r),'invalid first puzzle targetCell');
  check(row,'params',row.params.highlightProvider==='puzzlePlacementPreview'&&!row.skippable&&row.timeoutSeconds===0&&row.params.allowedActions.length===1&&row.params.allowedActions[0]==='puzzle:drag','drag teaching must be forced with native placement preview');
  const expected=new Set(p.targetCells.map(c=>`${c.q},${c.r}`));
  for(const c of p.cells){const key=`${c.q+cell.q},${c.r+cell.r}`;check(row,'params.targetCell',boardCells.has(key)&&expected.has(key)&&!covered.has(key),'guided placements must match original targets without overlap');covered.add(key);}
 }
 check(dragged[0],'params',covered.size===boardCells.size,'guided placements must cover the first board');
 const pointed=new Set(firstGroup.map(row=>row.nextStepId));let cursor=firstGroup.find(row=>!pointed.has(row.id));
 const pending=new Set(dragged.map(row=>row.id));
 while(cursor?.action==='drag'){pending.delete(cursor.id);cursor=tables.GuideSteps[cursor.nextStepId];}
 check(dragged[0],'nextStepId',pending.size===0&&cursor?.completeEvent==='puzzle.winCommitted','first guide requires consecutive drag steps before win wait');
 check(cursor,'params',cursor.action==='wait'&&cursor.params.allowedActions.length===0&&!cursor.skippable&&cursor.timeoutSeconds===0,'win step must only wait for committed victory');
 for(const row of firstGroup){
  if(row.params.pieceId)check(row,'params',piece.some(p=>p.id===row.params.pieceId),'unknown first puzzle piece');
  if(row.params.targetCell){const cell=row.params.targetCell,p=piece.find(p=>p.id===row.params.pieceId);check(row,'params',cell&&Number.isSafeInteger(cell.q)&&Number.isSafeInteger(cell.r)&&p&&p.targetCells.some(c=>c.q===cell.q&&c.r===cell.r),'invalid first puzzle targetCell');}
  if(row.params.mapId){check(row,'params',own(tables.Maps,row.params.mapId),'unknown guide map');if(row.params.slotId){const slot=entries('MapBuildings').find(x=>x.mapId===row.params.mapId&&x.slotId===row.params.slotId);check(row,'params',!!slot,'unknown guide slot');if(row.params.expectedStage!==undefined)check(row,'params',entries('BuildingStages').some(s=>s.buildingId===slot.buildingId&&s.stage===row.params.expectedStage),'unknown guide expectedStage');}}
  if(row.params.pageId)check(row,'params',['home','puzzle','result','build'].includes(row.params.pageId),'unknown destination page');
  if(row.params.mode)check(row,'params',['home','build'].includes(row.params.mode),'unknown destination mode');
 }
 const slot=entries('MapBuildings').find(x=>x.mapId===constant('firstMapId')&&x.slotId===1),stage=entries('BuildingStages').find(x=>x.buildingId===slot.buildingId&&x.stage===1);
 if(constant('initialCoins')+tables.Rewards[first.rewardId].coins<stage.cost)error('GuideSteps.xlsx','first win cannot afford first upgrade');
 return tables;
}
function encode(tables){const output={schemaVersion:1,tables:{}};for(const name of Object.keys(schemas)){const keys=Object.keys(schemas[name]),table={keys};for(const id of Object.keys(tables[name]).sort())table[id]=keys.map(key=>tables[name][id][key]);output.tables[name]=table;}return output;}
function exportConfig(options={}){
 const input=options.input||path.join(PROJECT,'config/excel'),output=options.output||path.join(PROJECT,'assets/resources/config/game-config.json');
 const levels=options.levels||JSON.parse(fs.readFileSync(path.join(PROJECT,'assets/bundles/puzzle/config/level-catalog.json'),'utf8')).levels;
 const tables={};for(const name of Object.keys(schemas)){const file=path.join(input,name+'.xlsx');if(!fs.existsSync(file))error(file,'missing workbook');const sheets=xlsx.parse(file);tables[name]=parseRows(name,sheets[0]?.data,sheets[0]?.name||'Data');}
 const bytes=JSON.stringify(encode(validate(tables,levels)),null,2)+'\n';JSON.parse(bytes);
 fs.mkdirSync(path.dirname(output),{recursive:true});const temporary=output+'.tmp-'+process.pid;
 try{fs.writeFileSync(temporary,bytes);if(fs.readFileSync(temporary,'utf8')!==bytes)throw Error('temporary readback differs');fs.renameSync(temporary,output);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
 return {output,tables:Object.keys(tables).length,rows:Object.fromEntries(Object.entries(tables).map(([name,rows])=>[name,Object.keys(rows).length]))};
}
module.exports={convert,parseRows,validate,encode,exportConfig};
if(require.main===module){try{console.log(JSON.stringify(exportConfig(),null,2));}catch(err){console.error(err.message);process.exitCode=1;}}
