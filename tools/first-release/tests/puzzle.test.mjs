import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require(process.env.TYPESCRIPT_PATH || 'G:/cocosCreator/Editor/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const root=path.resolve(import.meta.dirname,'../../..'),cache=new Map();
function load(filename){const file=filename.endsWith('.ts')?filename:filename+'.ts';if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInThisContext('(function(module,exports,require){'+source+'\n})',{filename:file})(module,module.exports,id=>load(path.resolve(path.dirname(file),id)));return module.exports;}
const {PuzzleSession}=load(path.join(root,'assets/scripts/features/puzzle/session/PuzzleSession'));
const {fitTrayWindow}=load(path.join(root,'assets/scripts/features/puzzle/presentation/PuzzleLayout'));
const at=q=>({q,r:0});
const level={id:'fixture',mode:'classic',index:1,mainlineNumber:1,moveLimit:null,targetCells:[at(0),at(1)],obstacleCells:[],pieces:[{id:'a',textureName:'1_png',cells:[at(0)],targetCells:[at(0)]},{id:'b',textureName:'3_png',cells:[at(0)],targetCells:[at(1)]}]};
test('failed candidate persistence never mutates board/counters/order/hint or notifies listeners',()=>{
 const run=new PuzzleSession(level,'attempt');let notified=0;run.subscribe(()=>notified++);
 run.beforeCommit=()=>{throw Error('disk full');};const before=run.snapshot;
 assert.throws(()=>run.place('a',at(0)),/disk full/);assert.deepEqual(run.snapshot,before);
 assert.throws(()=>run.activateHint(),/disk full/);assert.deepEqual(run.snapshot,before);assert.equal(notified,0);
 run.beforeCommit=null;run.place('a',at(0));const placed=run.snapshot;
 run.beforeCommit=()=>{throw Error('disk full');};assert.throws(()=>run.returnPiece(),/disk full/);assert.deepEqual(run.snapshot,placed);
});
test('accepted snapshot survives restart with last-placement order and hint identity',()=>{
 const run=new PuzzleSession(level,'attempt');let saved;
 run.beforeCommit=snapshot=>{saved=snapshot;};run.place('a',at(1));run.activateHint();
 const restored=new PuzzleSession(level,'attempt');restored.restore(saved);
 assert.deepEqual(restored.snapshot,run.snapshot);assert.equal(restored.hintCandidate().pieceId,run.hintCandidate().pieceId);
 let commits=0;restored.beforeCommit=()=>commits++;restored.activateHint();assert.equal(commits,0,'active hint is not purchased twice');
 restored.returnPiece();assert.equal(restored.snapshot.moves,2);assert.deepEqual(restored.snapshot.placementOrder,[]);
});
test('saved status cannot claim victory or failure independently of real geometry and move limit',()=>{
 const run=new PuzzleSession(level,'attempt');const before=run.snapshot;
 assert.throws(()=>run.restore({...before,status:'completed'}),/status/);
 assert.throws(()=>run.restore({...before,attemptId:'other'}),/identity/);
 assert.throws(()=>run.restore({...before,placements:{a:at(99)},placementOrder:['a']}),/placement/);
 assert.throws(()=>run.restore({...before,moves:NaN}),/counters/);
 assert.deepEqual(run.snapshot,before);
});
test('three visible tray slots keep a stable cell scale when seven pieces are available',()=>{
 const three=fitTrayWindow(level.pieces.concat(level.pieces.slice(0,1)),750,270,18,16);
 const seven=fitTrayWindow(Array.from({length:7},()=>level.pieces[0]),750,270,18,16);
 assert.equal(three.rows,1);assert.equal(seven.rows,1);assert.equal(three.radius,seven.radius);assert.equal(seven.pieces.length,7);
 assert.equal(new Set(seven.pieces.map(p=>p.position.x)).size,7);assert.ok(seven.pieces[6].position.x>375,'later pieces extend content and can scroll into view');
});
test('new puzzle prefab has authored scrolling, viewport mask, input and typed view bindings',()=>{
 const prefab=JSON.parse(fs.readFileSync(path.join(root,'assets/resources/first-release/prefabs/PuzzlePage.prefab')));
 const scroll=prefab.find(x=>x.__type__==='cc.ScrollView');assert.ok(scroll?.horizontal);assert.equal(scroll.vertical,false);assert.ok(prefab[scroll._content.__id__]);
 const viewport=prefab.find(x=>x._name==='Viewport');assert.ok(viewport._components.some(r=>prefab[r.__id__].__type__==='cc.Mask'));
 const view=prefab.find(x=>x.hintCountLabel&&x.restartButton&&x.controller);assert.ok(view&&prefab[view.board.__id__]&&prefab[view.controller.__id__]);
});

test('catalog accepts a different valid question count and data-driven legacy range',()=>{
 const {LevelCatalog}=load(path.join(root,'assets/scripts/features/puzzle/data/LevelCatalog'));
 const data=JSON.parse(fs.readFileSync(path.join(root,'assets/bundles/puzzle/config/level-catalog.json')));
 const one=data.levels.find(x=>x.mainlineNumber===1);
 const reduced={...data,levels:[one]};
 const catalog=new LevelCatalog(reduced);
 assert.equal(catalog.levels.length,1);assert.equal(catalog.getMainline(1).id,one.id);
 assert.throws(()=>catalog.getMainline(2),/range/);
});
