const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('node:vm'),xlsx=require('node-xlsx');
const {exportConfig}=require('../app.cjs');
const project=path.resolve(__dirname,'../../..'),scratch=path.resolve(project,'../tmp/v2/meta-tests');
const ts=require(process.env.TYPESCRIPT_PATH||'G:/cocosCreator/Editor/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
function runtime(){const module={exports:{}},file=path.join(project,'assets/scripts/features/config/MetaManager.ts'),code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInThisContext('(function(module,exports){'+code+'\n})',{filename:file})(module,module.exports);return module.exports.MetaManager;}
function fixture(){fs.mkdirSync(scratch,{recursive:true});const folder=fs.mkdtempSync(path.join(scratch,'transition-'));for(const name of fs.readdirSync(path.join(project,'config/excel')).filter(n=>n.endsWith('.xlsx')))fs.copyFileSync(path.join(project,'config/excel',name),path.join(folder,name));return folder;}
function edit(folder,key,value,type){const file=path.join(folder,'Constants.xlsx'),sheets=xlsx.parse(file),row=sheets[0].data.find(r=>r[0]===key);row[2]=value;if(type)row[1]=type;fs.writeFileSync(file,xlsx.build(sheets));}
test('transition constants export typed durations and preload toggle, including zero and upper bounds',()=>{
 const Meta=runtime();
 for(const [fade,motion,enabled]of [[0,0,false],[1,.5,true],[.15,.12,true]]){
  const input=fixture(),output=path.join(input,'config.json');edit(input,'puzzleTransitionFadeSeconds',String(fade));edit(input,'puzzleEnterMotionSeconds',String(motion));edit(input,'puzzlePreloadEnabled',String(enabled));exportConfig({input,output});const raw=JSON.parse(fs.readFileSync(output)),meta=new Meta(raw);assert.equal(meta.getConstant('puzzleTransitionFadeSeconds'),fade);assert.equal(meta.getConstant('puzzleEnterMotionSeconds'),motion);assert.equal(meta.getConstant('puzzlePreloadEnabled'),enabled);
 }
});
test('invalid transition constants reject export without replacing output and reject runtime config',()=>{
 const Meta=runtime(),baseline=JSON.parse(fs.readFileSync(path.join(project,'assets/resources/config/game-config.json')));
 for(const [key,value,type]of [['puzzleTransitionFadeSeconds','-0.1','number'],['puzzleTransitionFadeSeconds','1.01','number'],['puzzleEnterMotionSeconds','0.51','number'],['puzzleEnterMotionSeconds','-0.01','number'],['puzzleTransitionFadeSeconds','0.15','string'],['puzzlePreloadEnabled','true','string']]){
  const input=fixture(),output=path.join(input,'config.json');fs.writeFileSync(output,'last-valid');edit(input,key,value,type);assert.throws(()=>exportConfig({input,output}),/duration|boolean/);assert.equal(fs.readFileSync(output,'utf8'),'last-valid');const raw=structuredClone(baseline);raw.tables.Constants[key][2]=type==='number'?Number(value):value;assert.throws(()=>new Meta(raw),/constant/);
 }
 for(const value of [NaN,Infinity]){const raw=structuredClone(baseline);raw.tables.Constants.puzzleTransitionFadeSeconds[2]=value;assert.throws(()=>new Meta(raw),/duration/);}
});
