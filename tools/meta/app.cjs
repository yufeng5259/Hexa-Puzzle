'use strict';
const fs=require('fs'),path=require('path'),xlsx=require('node-xlsx');
const {schemas,constants,dailyTaskTypes,dailyTaskSlots,guideSteps,guidePages}=require('./schema.cjs');
const PROJECT=path.resolve(__dirname,'../..');
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const forbidden=new Set(['keys','__proto__','constructor','prototype']);
function error(where,message){throw new Error(`${where}: ${message}`);}
function convert(value,type,where){
 const optional=type.endsWith('?');type=type.replace(/\?$/,'');
 if(value===null||value===undefined||value===''){if(optional)return null;error(where,'required value is blank');}
 if(typeof value==='object')error(where,'cell value must be a scalar');
 if(type==='string')return String(value);
 if(type==='int'||type==='number'){
  if(typeof value==='boolean'||String(value).trim()===''||!Number.isFinite(Number(value))||(type==='int'&&!Number.isSafeInteger(Number(value))))error(where,`invalid ${type}`);
  return Number(value);
 }
 if(type==='bool'){if(value===true||value===1||value==='1'||String(value).toLowerCase()==='true')return true;if(value===false||value===0||value==='0'||String(value).toLowerCase()==='false')return false;error(where,'expected true/false/0/1');}
 if(type==='json'){try{return typeof value==='string'?JSON.parse(value):value;}catch{error(where,'invalid JSON');}}
 error(where,`unknown type ${type}`);
}
function parseRows(name,data,sheet='Data'){
 const schema=schemas[name],where=`${name}.xlsx/${sheet}`;
 if(!schema||!Array.isArray(data)||data.length<3)error(where,'three header rows required');
 const types=data[1]||[],headers=data[2]||[],indices=[],keys=[];
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
  if(name==='Constants')row.value=convert(row.value,row.valueType==='bool'?'bool':row.valueType,`${where}/row${r+1}/value`);
  Object.defineProperty(row,'_location',{value:`${where}/row${r+1}`,enumerable:false});rows[row.id]=row;
 }
 if(!Object.keys(rows).length)error(where,'no data rows');return rows;
}
/** Cross-table checks. The runtime (core/Config.ts) repeats the shape checks when loading. */
function validate(tables,levels){
 for(const name of Object.keys(schemas))if(!tables[name])error(name,'missing table');
 const list=name=>Object.values(tables[name]);
 const check=(row,field,ok,message)=>{if(!ok)error(`${row._location||row.id}/${field}`,message);};
 const ref=(row,field,table)=>check(row,field,row[field]===null||own(tables[table],String(row[field])),`unknown ${table} id ${row[field]}`);
 const C=tables.Constants;
 for(const [id,type] of Object.entries(constants)){
  if(!own(C,id))error('Constants.xlsx',`missing ${id}`);
  check(C[id],'valueType',C[id].valueType===type,`expected ${type}`);
  if(type==='int'||type==='number')check(C[id],'value',C[id].value>=0,'must not be negative');
 }
 const k=id=>C[id].value;
 if(k('energyMax')<1||k('energyRecoverSeconds')<1||k('energyInitial')>k('energyMax'))error('Constants.xlsx','invalid energy bounds');
 if(k('endlessRadius')<1||k('endlessTraySize')<1||k('dailyTaskCount')<1)error('Constants.xlsx','radius, tray size and task count must be positive');
 for(const id of ['welcomeRewardId','dailyChestRewardId'])check(C[id],'value',own(tables.Rewards,k(id)),`${id} points to unknown reward ${k(id)}`);
 check(C.firstMapId,'value',own(tables.Maps,k('firstMapId')),'unknown map');
 for(const row of list('Rewards'))for(const f of ['coins','energy','hints'])check(row,f,row[f]>=0,'negative reward');
 const maps=list('Maps').sort((a,b)=>a.order-b.order);
 maps.forEach((map,i)=>{
  check(map,'order',map.order===i+1,'orders must be 1..n');
  check(map,'nextMapId',map.nextMapId===(maps[i+1]?.id??null),'must point to the next map by order');
  ref(map,'completionRewardId','Rewards');
  const slots=list('MapBuildings').filter(b=>b.mapId===map.id).sort((a,b)=>a.slot-b.slot);
  check(map,'id',slots.length>0&&slots.every((b,j)=>b.slot===j+1),'buildings need slots 1..n');
 });
 check(C.firstMapId,'value',maps[0]?.id===k('firstMapId'),'first map must have order 1');
 for(const b of list('MapBuildings')){
  ref(b,'mapId','Maps');ref(b,'maxRewardId','Rewards');
  for(const f of ['feetX','feetY','anchorX','anchorY'])check(b,f,b[f]>=0&&b[f]<=1,'outside 0..1');
  check(b,'widthFraction',b.widthFraction>0&&b.widthFraction<=1,'outside (0,1]');
  const stages=list('BuildingStages').filter(s=>s.buildingId===b.id).sort((x,y)=>x.level-y.level);
  check(b,'id',stages.length>=2&&stages.every((s,i)=>s.level===i),'stages must be continuous from level 0');
  check(b,'id',stages[0].cost===0&&stages.slice(1).every(s=>s.cost>0),'level 0 is free, upgrades cost coins');
 }
 for(const s of list('BuildingStages'))check(s,'buildingId',own(tables.MapBuildings,s.buildingId),'unknown building');
 const guideB=tables.MapBuildings[k('guideBuildingId')];
 check(C.guideBuildingId,'value',guideB&&guideB.mapId===k('firstMapId'),'guide building must be on the first map');
 const puzzles=new Map(levels.map(l=>[l.id,l])),used=new Set(),main=list('Mainline').sort((a,b)=>a.levelNo-b.levelNo);
 main.forEach((row,i)=>{
  check(row,'levelNo',row.levelNo===i+1,'level numbers must be continuous from 1');
  check(row,'puzzleId',puzzles.has(row.puzzleId)&&!used.has(row.puzzleId),'unknown or duplicate puzzle');used.add(row.puzzleId);
  check(row,'kind',row.kind==='normal'||row.kind==='challenge','normal or challenge');
  if(puzzles.has(row.puzzleId))check(row,'kind',(puzzles.get(row.puzzleId).mode==='challenge')===(row.kind==='challenge'),'kind differs from the puzzle catalog');
  ref(row,'firstClearRewardId','Rewards');ref(row,'replayRewardId','Rewards');
 });
 check(C.endlessUnlockAfterLevelNo,'value',k('endlessUnlockAfterLevelNo')>=1&&k('endlessUnlockAfterLevelNo')<=main.length,'outside mainline');
 const firstCost=list('BuildingStages').find(s=>s.buildingId===k('guideBuildingId')&&s.level===1)?.cost??Infinity;
 if(main.length&&k('initialCoins')+tables.Rewards[main[0].firstClearRewardId].coins<firstCost)error('Constants.xlsx/guideBuildingId','first win cannot afford the guide build');
 list('PlayerLevels').sort((a,b)=>a.level-b.level).forEach((row,i)=>{check(row,'level',row.level===i+1,'levels must be continuous from 1');check(row,'expToNext',row.expToNext>0,'must be positive');ref(row,'rewardId','Rewards');});
 list('SignIn').sort((a,b)=>a.day-b.day).forEach((row,i)=>{check(row,'day',row.day===i+1,'days must be continuous from 1');ref(row,'rewardId','Rewards');});
 list('DailyTasks').sort((a,b)=>a.order-b.order).forEach((t,i)=>check(t,'order',t.order===i+1,'orders must be continuous from 1'));
 list('EndlessShapes').sort((a,b)=>a.order-b.order).forEach((s,i)=>check(s,'order',s.order===i+1,'orders must be continuous from 1'));
 for(const t of list('DailyTasks')){
  check(t,'type',dailyTaskTypes.includes(t.type),'unknown type');check(t,'slot',dailyTaskSlots.includes(t.slot),'unknown slot');
  check(t,'target',t.target>0,'must be positive');check(t,'weight',t.weight>=0&&(t.slot!=='rotate'||t.weight>0),'rotating tasks need a positive weight');ref(t,'rewardId','Rewards');
 }
 if(!list('DailyTasks').some(t=>t.slot==='fallback'))error('DailyTasks.xlsx','a fallback task is required');
 const near=(a,b)=>[[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]].some(([q,r])=>a[0]+q===b[0]&&a[1]+r===b[1]);
 for(const s of list('EndlessShapes')){
  const ok=Array.isArray(s.cells)&&s.cells.length>=1&&s.cells.length<=5&&s.cells.every(c=>Array.isArray(c)&&c.length===2&&c.every(Number.isSafeInteger));
  check(s,'cells',ok,'1–5 cells of [q,r] integers');
  const keys=new Set(s.cells.map(c=>c.join(',')));check(s,'cells',keys.size===s.cells.length,'duplicate cell');
  const seen=[s.cells[0]];for(let grow=true;grow;){grow=false;for(const c of s.cells)if(!seen.includes(c)&&seen.some(x=>near(x,c))){seen.push(c);grow=true;}}
  check(s,'cells',seen.length===s.cells.length,'cells must be connected');
  check(s,'cells',s.cells.every(([q,r])=>Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=2*k('endlessRadius')),'shape larger than the board');
  check(s,'weight',s.weight>0,'must be positive');check(s,'color',s.color>=0,'must not be negative');
 }
 let last=0;for(const s of list('EndlessStages').sort((a,b)=>a.score-b.score)){check(s,'score',s.score>last,'scores must be positive and unique');last=s.score;ref(s,'rewardId','Rewards');}
 const guide=list('GuideSteps').sort((a,b)=>a.order-b.order);
 guide.forEach((g,i)=>{
  check(g,'order',g.order===i+1,'orders must be continuous from 1');
  check(g,'step',guideSteps.includes(g.step),'unknown guide step');check(g,'pageId',guidePages.includes(g.pageId),'unknown page');
  check(g,'params',g.params&&typeof g.params==='object'&&!Array.isArray(g.params),'params must be an object');
  if(i)check(g,'step',guideSteps.indexOf(g.step)>=guideSteps.indexOf(guide[i-1].step),'steps must follow the guide order');
 });
 for(const step of guideSteps)if(!guide.some(g=>g.step===step))error('GuideSteps.xlsx','missing step '+step);
 const first=puzzles.get(main[0]?.puzzleId),drags=guide.filter(g=>g.params.pieceId!==undefined);
 if(first){
  const board=new Set(first.targetCells.map(c=>`${c.q},${c.r}`)),covered=new Set();
  for(const g of drags){
   const piece=first.pieces.find(p=>p.id===g.params.pieceId),cell=g.params.targetCell;
   check(g,'params',piece&&cell&&Number.isSafeInteger(cell.q)&&Number.isSafeInteger(cell.r),'unknown first-level piece or bad targetCell');
   const expected=new Set(piece.targetCells.map(c=>`${c.q},${c.r}`));
   for(const c of piece.cells){const key=`${c.q+cell.q},${c.r+cell.r}`;check(g,'params.targetCell',board.has(key)&&expected.has(key)&&!covered.has(key),'guided placement must match the solution');covered.add(key);}
  }
  if(drags.length!==first.pieces.length||covered.size!==board.size)error('GuideSteps.xlsx','guided drags must solve the first level');
 }
 return tables;
}
function encode(tables){const output={schemaVersion:2,tables:{}};for(const name of Object.keys(schemas)){const keys=Object.keys(schemas[name]),table={keys};for(const id of Object.keys(tables[name]).sort())table[id]=keys.map(key=>tables[name][id][key]);output.tables[name]=table;}return output;}
function exportConfig(options={}){
 const input=options.input||path.join(PROJECT,'config/excel'),output=options.output||path.join(PROJECT,'assets/resources/config/game-config.json');
 const levels=options.levels||JSON.parse(fs.readFileSync(path.join(PROJECT,'assets/bundles/puzzle/config/level-catalog.json'),'utf8')).levels;
 const tables={};for(const name of Object.keys(schemas)){const file=path.join(input,name+'.xlsx');if(!fs.existsSync(file))error(file,'missing workbook');const sheets=xlsx.parse(file);tables[name]=parseRows(name,sheets[0]?.data,sheets[0]?.name||'Data');}
 const bytes=JSON.stringify(encode(validate(tables,levels)),null,1)+'\n';JSON.parse(bytes);
 fs.mkdirSync(path.dirname(output),{recursive:true});const temporary=output+'.tmp-'+process.pid;
 try{fs.writeFileSync(temporary,bytes);if(fs.readFileSync(temporary,'utf8')!==bytes)throw Error('temporary readback differs');fs.renameSync(temporary,output);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
 return {output,tables:Object.keys(tables).length,rows:Object.fromEntries(Object.entries(tables).map(([name,rows])=>[name,Object.keys(rows).length]))};
}
module.exports={convert,parseRows,validate,encode,exportConfig};
if(require.main===module){try{console.log(JSON.stringify(exportConfig(),null,2));}catch(err){console.error(err.message);process.exitCode=1;}}
