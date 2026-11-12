const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),xlsx=require('node-xlsx');
const {parseRows,exportConfig,convert}=require('../app.cjs');
const {schemas}=require('../schema.cjs');
const project=path.resolve(__dirname,'../../..');
const scratch=path.resolve(project,'../tmp/v2/meta-tests');fs.mkdirSync(scratch,{recursive:true});
function fixture(){const folder=fs.mkdtempSync(path.join(scratch,'case-'));for(const name of Object.keys(schemas))fs.copyFileSync(path.join(project,'config/excel',name+'.xlsx'),path.join(folder,name+'.xlsx'));return folder;}
function edit(folder,name,fn){const data=xlsx.parse(path.join(folder,name+'.xlsx'))[0].data;fn(data);fs.writeFileSync(path.join(folder,name+'.xlsx'),xlsx.build([{name:'Data',data}]));}
const col=(data,key)=>data[2].indexOf(key);
const row=(data,id)=>data.find(r=>r[0]===id);
function rejects(name,fn,pattern){const input=fixture(),output=path.join(input,'out.json');fs.writeFileSync(output,'previous');edit(input,name,fn);assert.throws(()=>exportConfig({input,output}),pattern);assert.equal(fs.readFileSync(output,'utf8'),'previous');}

test('twelve workbooks export deterministically and the committed JSON is current',()=>{
 const output=path.join(scratch,'valid.json'),report=exportConfig({output});
 assert.equal(report.tables,12);assert.equal(report.rows.Mainline,110);assert.equal(report.rows.BuildingStages,90);
 const bytes=fs.readFileSync(output,'utf8');exportConfig({output});assert.equal(fs.readFileSync(output,'utf8'),bytes);
 assert.equal(fs.readFileSync(path.join(project,'assets/resources/config/game-config.json'),'utf8'),bytes,'run npm run config:export after editing Excel');
});
test('duplicate ids name workbook and row; previous output survives',()=>{
 rejects('Rewards',data=>{data.push([...data[3]]);},/Rewards.xlsx\/Data\/row28\/id: duplicate/);
});
test('reference, order and economy errors are rejected before publishing',()=>{
 rejects('Mainline',data=>{data[3][col(data,'firstClearRewardId')]='missing';},/Mainline.xlsx\/Data\/row4\/firstClearRewardId/);
 rejects('Mainline',data=>{data[3][col(data,'kind')]='challenge';},/kind differs/);
 rejects('Mainline',data=>{data[4][col(data,'puzzleId')]=data[3][col(data,'puzzleId')];},/duplicate puzzle/);
 rejects('BuildingStages',data=>{row(data,'B01_L1')[col(data,'cost')]=101;},/cannot afford/);
 rejects('BuildingStages',data=>{data.splice(data.indexOf(row(data,'B03_L2')),1);},/continuous from level 0/);
 rejects('Maps',data=>{row(data,'M01')[col(data,'nextMapId')]='M03';},/next map by order/);
 rejects('MapBuildings',data=>{row(data,'B02')[col(data,'feetX')]=1.5;},/outside 0..1/);
 rejects('Constants',data=>{row(data,'welcomeRewardId')[2]='missing';},/welcomeRewardId/);
 rejects('Constants',data=>{row(data,'guideBuildingId')[2]='B06';},/first map/);
 rejects('Constants',data=>{row(data,'energyInitial')[2]='9';},/energy bounds/);
 rejects('Constants',data=>{data.splice(data.indexOf(row(data,'endlessRadius')),1);},/missing endlessRadius/);
});
test('daily, sign-in, level and endless tables are checked',()=>{
 rejects('DailyTasks',data=>{row(data,'build_1')[col(data,'type')]='shop';},/unknown type/);
 rejects('DailyTasks',data=>{data.splice(data.indexOf(row(data,'place_10')),1);},/fallback task/);
 rejects('SignIn',data=>{row(data,'day3')[col(data,'day')]=9;},/continuous/);
 rejects('PlayerLevels',data=>{row(data,'Lv2')[col(data,'expToNext')]=0;},/positive/);
 rejects('EndlessShapes',data=>{row(data,'i2a')[col(data,'cells')]='[[0,0],[2,0]]';},/connected/);
 rejects('EndlessShapes',data=>{row(data,'s1')[col(data,'cells')]='[[0,0';},/invalid JSON/);
 rejects('EndlessStages',data=>{row(data,'stage2')[col(data,'score')]=500;},/unique/);
});
test('guide drags must solve the first level exactly',()=>{
 rejects('GuideSteps',data=>{const i=col(data,'params'),r=row(data,'drag2'),p=JSON.parse(r[i]);p.targetCell={q:6,r:0};r[i]=JSON.stringify(p);},/solution/);
 rejects('GuideSteps',data=>{data.splice(data.indexOf(row(data,'drag3')),1);},/solve the first level|continuous/);
 rejects('GuideSteps',data=>{row(data,'welcome')[col(data,'step')]='goBuild';},/guide order|missing step/);
});
test('blank optionals stay null; zero is not blank; types are strict',()=>{
 const keys=Object.keys(schemas.Maps),rows=parseRows('Maps',[keys,Object.values(schemas.Maps),keys,['a',1,'name','bg','','']]);
 assert.equal(rows.a.nextMapId,null);assert.equal(rows.a.completionRewardId,null);
 assert.equal(convert(0,'int','t'),0);assert.equal(convert(1,'bool','t'),true);assert.throws(()=>convert('maybe','bool','t'),/expected/);assert.throws(()=>convert(1.5,'int','t'),/invalid/);
});
