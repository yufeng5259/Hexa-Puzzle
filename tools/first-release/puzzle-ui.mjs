import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Builder,ref,external,scriptType } from '../prefab-foundation/builder.mjs';
import { PROJECT,stableUuid,directory,writeFile,writeOnceStableMeta } from '../prefab-foundation/io.mjs';
const VIEW='assets/scripts/features/puzzle/ui/FirstReleasePuzzleView.ts';
export function generatePuzzleUI(){
 const file='assets/resources/first-release/prefabs/PuzzlePage.prefab';
 directory(path.dirname(file));
 writeOnceStableMeta(path.join(PROJECT,VIEW),{ver:'4.0.24',importer:'typescript',imported:true,uuid:stableUuid(VIEW),files:[],subMetas:{},userData:{}});
 const manifest=JSON.parse(fs.readFileSync(path.join(PROJECT,'assets/resources/framework/config/source-art-manifest.json')));
 const extra=path.join(PROJECT,'assets/resources/first-release/art-additions.json');
 const puzzleArt=JSON.parse(fs.readFileSync(path.join(PROJECT,'tools/first-release/puzzle-art-additions.json')));
 const records=[...manifest.records,...manifest.derivatives,...(fs.existsSync(extra)?JSON.parse(fs.readFileSync(extra)).records||[]:[]),...puzzleArt.records];
 const registry=JSON.parse(fs.readFileSync(path.join(PROJECT,'assets/resources/framework/config/prefab-registry.json')));
 const record=id=>registry.prefabs.find(x=>x.id===id);
 const find=(id,name)=>records.find(x=>x.id===id)||records.find(x=>x.name===name);
 const b=new Builder('PuzzlePage',[853,1844]);
 const background=b.node('Background',b.root,{width:853,height:1844});
 const bg=find('firstrelease.puzzle.background','玩法_完整裸背景');
 if(bg)b.sprite(background,bg.spriteFrameUuid);
 const caption=b.node('MoveCaption',b.root,{x:-64,y:660,width:250,height:60});const captionLabel=b.label(caption,'已用步数',{font_size:36,color_rgb:[40,84,93],weight:'bold'});
 const counter=b.node('Moves',b.root,{x:130,y:660,width:100,height:60});const movesLabel=b.label(counter,'0',{font_size:40,color_rgb:[40,84,93],weight:'bold'});
 const live=b.node('LiveBoard',b.root,{width:853,height:1844});
 const board=b.node('Board',live,{x:0,y:210,width:770,height:780});
 const wood=find(null,'hex_wood_floor'),well=find('block_reuse_f714e5b86eea9964a094');
 if(!wood||!well)throw Error('Missing original puzzle materials');
 const obstacle=find('firstrelease.puzzle.obstacle');
 if(!obstacle)throw Error('Missing original puzzle obstacle artwork');
 const geometries=[];
 for(const role of ['shadow','floor','rim']){
  const node=b.node('Board'+role,live,{x:0,y:210,width:770,height:780});const graphics=b.component(node,'cc.Graphics');let mask=null,texture=null;
  if(role==='floor'){
   mask=ref(b.component(node,'cc.Mask',{_type:2,_inverted:false,_segments:64,_alphaThreshold:.1}));
   const material=b.node('Wood',node,{width:770,height:780});texture=ref(b.sprite(material,wood.spriteFrameUuid));b.objects[texture.__id__]._type=2;
  }
  geometries.push(b.component(node,scriptType('assets/scripts/features/presentation/SourceGeometry.ts'),{graphics:ref(graphics),mask,texture,spec:JSON.stringify({renderer:'block.hex.v1',role,cells:[[0,0]],bbox:[0,0,770,780],padding:32,flip_y:true})}));
 }
 const trayPanel=b.node('TrayPanel',live,{x:0,y:-390,width:820,height:340});
 const trayArt=find('firstrelease.puzzle.tray','完整托盘_无字木托盘');if(trayArt)b.sprite(trayPanel,trayArt.spriteFrameUuid);
 const scrollNode=b.node('TrayScroll',live,{x:0,y:-390,width:750,height:270});
 const viewport=b.node('Viewport',scrollNode,{width:750,height:270});b.component(viewport,'cc.Mask',{_type:0,_inverted:false,_segments:64,_alphaThreshold:.1});
 const content=b.node('Content',viewport,{width:750,height:270});
 const scroll=b.component(scrollNode,'cc.ScrollView',{_content:ref(content),horizontal:true,vertical:false,inertia:true,brake:.75,elastic:true,bounceDuration:.2,cancelInnerEvents:false,scrollEvents:[]});
 const hintNode=b.node('HintOutline',live,{x:0,y:210,width:770,height:780});const hintGraphics=b.component(hintNode,'cc.Graphics');
 b.objects[live]._children=[...geometries.map(id=>ref(b.objects[id].node.__id__)),ref(board),ref(trayPanel),ref(scrollNode),ref(hintNode)];
 const palette=['金色','蓝色','粉色','绿色','紫色'].map(name=>find(null,name+'无花母件'));
 if(palette.some(x=>!x))throw Error('Missing original puzzle palette');
 const textures={};[1,3,6,7,8,9,10,11,12,13,16,17].forEach((n,i)=>textures[n+'_png']=palette[i%palette.length].id);
 const boardComp=b.component(b.root,scriptType('assets/scripts/features/puzzle/presentation/PuzzleBoardPresentation.ts'),{liveRoot:ref(live),fixtureNodes:[],boardMount:ref(board),piecesMount:ref(content),cellPrefab:external(record('hex-cell').uuid,'cc.Prefab'),piecePrefab:external(record('puzzle-piece').uuid,'cc.Prefab'),boardShadow:ref(geometries[0]),boardFloor:ref(geometries[1]),boardRim:ref(geometries[2]),remainingLabel:ref(movesLabel),remainingCaptionLabel:ref(captionLabel),wellAssetId:well.id,obstacleAssetId:obstacle.id,textureAssetIds:JSON.stringify(textures),trayScroll:ref(scroll),trayViewport:ref(viewport),hintGraphics:ref(hintGraphics),trayPadding:16,trayGap:18,countMoves:true});
 const preview=b.node('PlacementPreview',board,{width:770,height:780},false),drag=b.node('DraggedPiece',b.root,{x:0,y:210,width:770,height:780});
 const controller=b.component(b.root,scriptType('assets/scripts/features/puzzle/controller/PuzzleController.ts'),{board:ref(boardComp),dragRoot:ref(drag),previewRoot:ref(preview),previewGraphics:ref(b.component(preview,'cc.Graphics')),previewOpacity:ref(b.component(preview,'cc.UIOpacity',{_opacity:255}))});
 const button=(name,x,y,action,glyph)=>{
  const side=['Undo','Restart','Hint'].includes(name)?165:125;
  const node=b.node(name,b.root,{x,y,width:side,height:side});const art=find('firstrelease.ui.'+name.toLowerCase());
  if(art)b.sprite(node,art.spriteFrameUuid);else {const label=b.node('Icon',node,{width:120,height:120});b.label(label,glyph,{font_size:72,color_rgb:[255,255,255],weight:'bold'});}
  b.button(node,b.root,'FirstReleasePuzzleView','onAction',action);return node;
 };
 const back=button('Back',-320,785,'puzzle:back','↩'),settings=button('Settings',320,785,'settings','⚙');
 const undo=button('Undo',-220,-780,'puzzle:undo','↶'),restart=button('Restart',0,-780,'puzzle:restart','↻'),hint=button('Hint',220,-780,'puzzle:hint','💡');
 for(const [name,x,text] of [['UndoCaption',-220,'撤销'],['RestartCaption',0,'重玩'],['HintCaption',220,'提示']]){
  const caption=b.node(name,b.root,{x,y:-890,width:180,height:44});b.label(caption,text,{font_size:30,color_rgb:[36,65,91],weight:'bold'});
 }
 const count=b.node('HintCount',hint,{x:72,y:72,width:70,height:40});const hintCount=b.label(count,'5',{font_size:32,color_rgb:[36,65,91],weight:'bold'});
 for(const [name,x,handler,glyph] of [['PreviousTray',-390,'previousTray','‹'],['NextTray',390,'nextTray','›']]){
  const node=b.node(name,b.root,{x,y:-390,width:50,height:150});b.label(node,glyph,{font_size:60,color_rgb:[40,84,93]});b.button(node,b.root,'FirstReleasePuzzleView',handler);
 }
 b.component(b.root,scriptType(VIEW),{board:ref(boardComp),controller:ref(controller),hintCountLabel:ref(hintCount),backButton:ref(back),settingsButton:ref(settings),undoButton:ref(undo),restartButton:ref(restart),hintButton:ref(hint)});
 const uuid=stableUuid(file);writeOnceStableMeta(path.join(PROJECT,file),{ver:'1.1.50',importer:'prefab',imported:true,uuid,files:['.json'],subMetas:{},userData:{}});
 writeFile(path.join(PROJECT,file),JSON.stringify(b.finish(),null,2)+'\n');
 return {id:'firstrelease-puzzle',uuid,bundle:'resources',resourcePath:'first-release/prefabs/PuzzlePage',assetPath:file};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(generatePuzzleUI()));
