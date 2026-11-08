import fs from 'node:fs';
import path from 'node:path';
import { PROJECT, SCRATCH, stableUuid, normalize, directory, writeFile, writeOnceStableMeta, assetJson, sha256 } from './io.mjs';
import { importAssets } from './import-assets.mjs';
import { prefabCatalog, routeCatalog, sourceConfigs, categoryCounts } from './catalog.mjs';
import { selectLayers, selectTexts, isDynamicImage } from './select-layers.mjs';
import { Builder, ref, external, scriptType, color } from './builder.mjs';
import { ManagedOutputs } from './managed-output.mjs';
import { serializeScene } from './scene-contract.mjs';
import {coreIds,itemIds,applyActions,integrateCore,integrateItem} from './core-ui.mjs';
import {exportLevels,LEVEL_CATALOG_PATH} from './export-levels.mjs';
import {attachPiecePresentation} from './level-ui.mjs';
import {attachPlayStatus} from './play-ui.mjs';

if (fs.existsSync(path.join(PROJECT,'tools/first-release/active.json'))) throw new Error('旧全量页面生成器已退役；请使用 npm run firstrelease:generate，禁止恢复旧页面。');
const managed = new ManagedOutputs(PROJECT,'tools/prefab-foundation/generated-files.json');
managed.preflight();
// Build every graph before publishing owned outputs. A malformed source cannot
// leave earlier Prefabs changed while the ownership manifest still has old hashes.
const pendingOutputs=new Map();
const queueOutput=(file,bytes)=>pendingOutputs.set(file,bytes);
queueOutput(LEVEL_CATALOG_PATH,JSON.stringify(exportLevels(),null,2)+'\n');
const assets=importAssets(); assets.prepareDerivatives();
const script = (file, source) => {
  directory(path.dirname(file));
  const metaPath=path.join(PROJECT,file+'.meta');
  const uuid=source===undefined&&fs.existsSync(metaPath)?JSON.parse(fs.readFileSync(metaPath,'utf8')).uuid:stableUuid(file);
  writeOnceStableMeta(path.join(PROJECT,file), {ver:'4.0.24',importer:'typescript',imported:true,uuid,files:[],subMetas:{},userData:{}});
  if(source!==undefined)queueOutput(file,source);
};
const relativeImport=(file,target)=>{let value=normalize(path.relative(path.dirname(file),target)).replace(/\.ts$/,'');return value.startsWith('.')?value:'./'+value;};
const className=p=>p.name.endsWith('View')?p.name:p.name+'View';
const scriptPath=p=>p.category==='debug'?`assets/scripts/debug/${className(p)}.ts`:p.category==='common'?`assets/scripts/ui/common/${className(p)}.ts`:`assets/scripts/features/${p.module}/ui/${className(p)}.ts`;
const records=prefabCatalog.map(p=>({...p,assetPath:p.path,uuid:stableUuid(p.path),viewClass:p.id==='virtual-list'?'VirtualList':className(p),scriptPath:p.id==='virtual-list'?'assets/scripts/framework/ui/VirtualList.ts':scriptPath(p),bundle:p.path.startsWith('assets/resources/')?'resources':p.module,resourcePath:p.path.startsWith('assets/resources/')?p.path.slice('assets/resources/'.length,-7):p.path.split('/prefabs/')[1]?'prefabs/'+p.path.split('/prefabs/')[1].slice(0,-7):'',sourceScriptUri:'chunks:///_virtual/'+(p.id==='virtual-list'?'VirtualList.ts':path.basename(scriptPath(p)))}));
const byId=new Map(records.map(p=>[p.id,p]));
for(const record of records){const config=sourceConfigs[record.sourcePage],layers=config?selectLayers(record,config):[],texts=config?selectTexts(record,config,layers):[];record.layoutSize=extent(layers,texts,config,['item','common','debug'].includes(record.category)).size;}
const commonBase='assets/scripts/ui/common/SerializedView.ts';
const listItemIds=new Set([...records.map(record=>record.listItemId).filter(Boolean),'reward-item','gm-command']);
const requiredTypes = new Set(['Node','Label','Sprite','Button','Prefab','ScrollView','Mask','ProgressBar']);
const componentTypes = new Map();
function indexComponentTypes(dir) {
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())indexComponentTypes(file);
    else if(entry.name.endsWith('.ts')&&fs.existsSync(file+'.meta')) {
      const name=fs.readFileSync(file,'utf8').match(/@ccclass\(['"]([^'"]+)['"]\)/)?.[1];
      if(!name)continue;
      if(componentTypes.has(name))throw new Error('Duplicate component class: '+name);
      componentTypes.set(name,scriptType(normalize(path.relative(PROJECT,file))));
    }
  }
}
indexComponentTypes(path.join(PROJECT,'assets/scripts'));
function makeViewScript(record,fields,stateFields) {
  const file=record.scriptPath, typeNames=[...new Set(fields.map(f=>f.type))].filter(t=>requiredTypes.has(t));
  const stateProperties=stateFields?fields.map(f=>`    @property([${f.type}]) private ${f.name}States: ${f.type}[] = [];`).join('\n'):'';
  const selectState=stateFields?`    public selectState(id?: string): void {\n        super.selectState(id);\n        const index = id ? this.stateIds.indexOf(id) : 0;\n${fields.map(f=>`        this.${f.name} = this.${f.name}States[index];`).join('\n')}\n    }\n`:'';
  const validateStates=stateFields?fields.map(f=>`        if (this.${f.name}States.length !== this.stateIds.length || this.${f.name}States.some(value => !value)) throw new Error('${record.viewClass}.${f.name}: incomplete state bindings');`).join('\n'):'';
  const multi=record.variants.length>1,base=multi?'SerializedView':'BaseView';
  script(file,`import { _decorator${typeNames.length?', '+typeNames.join(', '):''} } from 'cc';\nimport { ${base} } from '${relativeImport(file,multi?commonBase:'assets/scripts/framework/ui/BaseView.ts')}';\n${fields.length?`import { requireBinding } from '${relativeImport(file,'assets/scripts/framework/components/Binding.ts')}';\n`:''}const { ccclass, property } = _decorator;\n\n/** Prefab bindings for the actual controls; rules and services belong to the feature. */\n@ccclass('${record.viewClass}')\nexport class ${record.viewClass} extends ${base} {\n${fields.map(f=>`    @property(${f.type}) public ${f.name}: ${f.type} | null = null;`).join('\n')}\n${stateProperties}\n${selectState}    public validateBindings(): void {\n        super.validateBindings();\n${fields.map(f=>`        requireBinding('${record.viewClass}', '${f.name}', this.${f.name});`).join('\n')}\n${validateStates}\n    }\n}\n`);
}
function boxForLayer(l,canvas,origin=[0,0]) {const [w,h]=l.size;const a=l.anchor??[0,0];return{x:l.position[0]-w*a[0]+w/2-origin[0]-canvas[0]/2,y:canvas[1]/2-(l.position[1]-h*a[1]+h/2-origin[1]),width:w,height:h};}
function textBox(t){return t.box??t.layout_box??[t.position?.[0]??0,t.position?.[1]??0,(t.position?.[0]??0)+100,(t.position?.[1]??0)+40];}
function extent(layers,texts,config,small) {
  if(!small)return{size:config?.canvas??config?.size??[853,1844],origin:[0,0]};
  const boxes=[...layers.filter(l=>l.position&&l.size).map(l=>{const a=l.anchor??[0,0];return[l.position[0]-l.size[0]*a[0],l.position[1]-l.size[1]*a[1],l.position[0]+l.size[0]*(1-a[0]),l.position[1]+l.size[1]*(1-a[1])];}),...texts.map(textBox)];
  if(!boxes.length)return{size:[420,120],origin:[0,0]};
  const x=Math.min(...boxes.map(b=>b[0])),y=Math.min(...boxes.map(b=>b[1]));
  return{size:[Math.max(32,Math.max(...boxes.map(b=>b[2]))-x),Math.max(32,Math.max(...boxes.map(b=>b[3]))-y)],origin:[x,y]};
}
const prefabFields={levelNodePrefab:'level-node',buildingPrefab:'building',piecePrefab:'puzzle-piece',cellPrefab:'hex-cell',slotPrefab:'tray-slot',commandPrefab:'gm-command'};
function makeScroll(b,parent,itemId,viewFields,fieldNodes) {
  const width=Math.min(660,b.size[0]),height=Math.min(1040,b.size[1]*.6);
  const root=b.node('List',parent,{width,height});
  const viewport=b.node('Viewport',root,{x:-width/2,y:height/2,width,height,anchorX:0,anchorY:1});
  const mask=b.component(viewport,'cc.Mask',{_type:0,_inverted:false,_segments:64,_alphaThreshold:.1});
  const content=b.node('Content',viewport,{width,height,anchorX:0,anchorY:1});
  const scroll=b.component(root,'cc.ScrollView',{_content:ref(content),horizontal:false,vertical:true,inertia:true,brake:.5,elastic:true,bounceDuration:.23,cancelInnerEvents:true,scrollEvents:[]});
  Object.assign(viewFields,{scrollView:ref(scroll),viewport:ref(mask),content:ref(content)});
  Object.assign(fieldNodes,{scrollView:root,viewport,content});
  if(itemId) {
    viewFields.itemPrefab=external(byId.get(itemId).uuid,'cc.Prefab');
    b.component(root,scriptType('assets/scripts/framework/ui/VirtualList.ts'),{scrollView:ref(scroll),viewport:ref(viewport),content:ref(content),itemPrefab:viewFields.itemPrefab,itemExtent:byId.get(itemId).layoutSize[1],spacing:12,buffer:2,horizontal:false});
  }
  return {root,viewport,content,scroll};
}

// Group related controls only when they are consecutive in the authored drawing
// order. Interleaved artwork keeps its order; small items need no extra container.
function groupControls(p,b,contexts){
  if(!['page','dialog','guide'].includes(p.category))return;
  for(const context of contexts){
    const parent=b.objects[context.root],children=[...parent._children];
    if(children.length<6)continue;
    const authored=new Set(context.nodes.map(entry=>entry.node));
    const role=id=>{
      if(!authored.has(id))return null;
      const node=b.objects[id];
      if(/背景|裸地形|天空/.test(node._name))return 'Background';
      if(node._lpos.y>b.size[1]/2-320)return 'Header';
      if(node._lpos.y<-b.size[1]/2+300)return 'Footer';
      if(/按钮|入口|关闭|取消|确认|开始|继续|领取|再来/.test(node._name))return 'Actions';
      return 'Content';
    };
    const output=[],counts=new Map();
    for(let index=0;index<children.length;){
      const kind=role(children[index].__id__);let end=index+1;
      while(kind&&end<children.length&&role(children[end].__id__)===kind)end++;
      const run=children.slice(index,end);
      if(kind&&run.length>=3&&run.length<children.length){
        const count=(counts.get(kind)||0)+1;counts.set(kind,count);
        const group=b.node(kind+(count===1?'':count),context.root,{width:b.size[0],height:b.size[1]});
        b.objects[group]._children=run;for(const child of run)b.objects[child.__id__]._parent=ref(group);
        output.push(ref(group));
      }else output.push(...run);
      index=end;
    }
    parent._children=output;
  }
}
const generated=[],layoutRecords=[];
for(const p of records) {
  if(p.maintenance==='manual') {
    // Artist-authored pages are registered from disk, never rebuilt by this tool.
    const bytes=fs.readFileSync(path.join(PROJECT,p.path)),objects=JSON.parse(bytes);
    const root=objects[objects[0].data.__id__];
    const rootComponent=root._components.map(reference=>reference.__id__).find(index=>objects[index].__type__===scriptType(p.scriptPath));
    if(rootComponent===undefined)throw new Error('Manual Prefab is missing its root View: '+p.id);
    const component=objects[rootComponent];
    for(const binding of p.bindings){
      const value=component[binding.name];
      const expectedType=requiredTypes.has(binding.type)?'cc.'+binding.type:componentTypes.get(binding.type);
      const valid=binding.type==='Prefab'
        ? value?.__expectedType__==='cc.Prefab'&&records.some(record=>record.uuid===value.__uuid__)
        : expectedType&&objects[value?.__id__]?.__type__===expectedType;
      if(!valid)throw new Error('Manual Prefab has an invalid binding: '+p.id+'.'+binding.name);
    }
    const transform=root._components.map(reference=>objects[reference.__id__]).find(object=>object.__type__==='cc.UITransform');
    if(!transform)throw new Error('Manual Prefab is missing its root UITransform: '+p.id);
    generated.push({...p,uuid:JSON.parse(fs.readFileSync(path.join(PROJECT,p.path+'.meta'),'utf8')).uuid,
      layoutSize:[transform._contentSize.width,transform._contentSize.height],stateIds:component.stateIds||[],rootComponent,
      nodeCount:objects.filter(object=>object.__type__==='cc.Node').length,geometrySlots:0,sha256:sha256(bytes)});
    continue;
  }
  if(p.id==='building')p.bindings=p.bindings.filter(f=>['body','rotorRoot','rotor','button'].includes(f.name));
  if(p.id==='hex-cell'||p.id==='tray-slot')p.bindings=p.bindings.filter(f=>['icon','button'].includes(f.name));
  const isSmall=['item','common','debug'].includes(p.category)&&p.id!=='gm-panel';
  const config=sourceConfigs[p.sourcePage], firstLayers=config?selectLayers(p,config):[],firstTexts=config?selectTexts(p,config,firstLayers):[];
  const bounds=extent(firstLayers,firstTexts,config,isSmall);
  const b=new Builder(p.name,p.id==='gm-panel'?[700,1100]:p.id==='virtual-list'?[680,1000]:bounds.size);
  const dynamic=b.root;
  const fields={},fieldNodes={};
  const stateRoots=[],stateIds=[],imageCandidates=[],textCandidates=[],buttonCandidates=[],contexts=[];
  const states=p.variants.length?p.variants:[{sourcePage:null,id:'default'}];
  for(const [stateIndex,state]of states.entries()) {
    const cfg=sourceConfigs[state.sourcePage], layers=cfg?selectLayers(p,cfg):[],texts=cfg?selectTexts(p,cfg,layers):[];
    // Only actual variants need a container. Single-layout UI is authored directly on its root.
    const stateRoot=states.length>1?b.node(`${p.id==='garden'?'GardenStage':p.id==='guide-overlay'?'Guide':'Mode'}${stateIndex+1}`,b.root,{width:b.size[0],height:b.size[1]},stateIndex===0)
      :p.id==='puzzle-piece'?b.node('PiecePreview',b.root,{width:b.size[0],height:b.size[1]}):b.root;
    if(p.id==='puzzle-piece')fields.previewRoot=ref(stateRoot);
    stateRoots.push(ref(stateRoot));stateIds.push(state.id);
    const slots={sourcePage:state.sourcePage??'',dynamicSprites:[],imageIds:[],dynamicLabels:[],textKeys:[],previewTexts:[],geometryMounts:[],geometrySpecs:[]};
    const elements=[...layers.filter(l=>l.type!=='text').map(layer=>({z:layer.z??0,layer})),...texts.map(text=>({z:cfg?.layers.find(l=>l.type==='text'&&l.text_id===(text.text_id??text.id))?.z??70,text}))].sort((a,c)=>a.z-c.z);
    const layerNodes=new Map(),nodes=[];
    for(const entry of elements) {
      if(entry.layer) {
        const layer=entry.layer;
        if(!layer.position||!layer.size)continue;
        const node=b.node(layer.name,stateRoot,boxForLayer(layer,b.size,bounds.origin),layer.visible!==false);layerNodes.set(layer.name,node);nodes.push({name:layer.name,node,layer});
        if(layer.type==='procedural') {
          slots.geometryMounts.push(ref(node));slots.geometrySpecs.push(JSON.stringify({renderer:'block.hex.v1',spec:layer.procedural,crop:layer.procedural_crop}));
          if(coreIds.has(p.id)){
            const graphics=b.component(node,'cc.Graphics'),role=layer.procedural?.role;
            let mask=null,texture=null;
            const material=layer.procedural?.materials?.hex_wood_floor??layer.procedural?.materials?.hex_empty_well;
            const record=assets.manifest.records.find(image=>image.id===material);
            if(role==='floor')mask=ref(b.component(node,'cc.Mask',{_type:2,_inverted:false,_segments:64,_alphaThreshold:.1}));
            if(record&&(role==='floor'||role==='obstacle')){const child=b.node('Material',node,{width:layer.size[0],height:layer.size[1]});const sprite=b.sprite(child,record.spriteFrameUuid);if(role==='floor')b.objects[sprite]._type=2;texture=ref(sprite);}
            b.component(node,scriptType('assets/scripts/features/presentation/SourceGeometry.ts'),{graphics:ref(graphics),mask,texture,spec:slots.geometrySpecs[slots.geometrySpecs.length-1]});
          }
          continue;
        }
        if(!layer.file)continue;
        const image=assets.ensureLayerImage(layer),dynamicImage=isDynamicImage(layer,p);
        const sprite=b.sprite(node,image.spriteFrameUuid,layer.opacity??1);
        if(dynamicImage){slots.dynamicSprites.push(ref(sprite));slots.imageIds.push(image.id);}
        imageCandidates.push({name:layer.name,node,id:sprite,stateIndex,resource:image.id,dynamic:dynamicImage,layer});
      }else {
        const t=entry.text,box=textBox(t),node=b.node(t.layer_name??t.text_id,stateRoot,boxForLayer({position:[box[0],box[1]],size:[box[2]-box[0],box[3]-box[1]]},b.size,bounds.origin));
        const dynamicText=!!(t.value_binding||t.binding)||['number','template','player_input'].includes(t.text_role??t.role);
        const label=b.label(node,t.default_text??t.text??'',t);
        if(dynamicText){slots.dynamicLabels.push(ref(label));slots.textKeys.push(t.text_id??t.id??t.layer_name);slots.previewTexts.push(t.default_text??t.text??'');}
        textCandidates.push({name:t.layer_name??'',node,id:label,stateIndex,text:t});
        nodes.push({name:t.layer_name??'',node,text:t});
      }
    }
    const authoredActions=cfg?.runtime?.actions??[];
    const clickNames=[...new Set([...authoredActions.map(a=>a.layer),...layers.filter(l=>/按钮|返回|齿轮|设置|每日签到|每日任务|好友入口|主题挑战|关卡\d+底板/.test(l.name)).map(l=>l.name)])];
    for(const name of clickNames) {
      const node=layerNodes.get(name);if(node===undefined)continue;
      const action=authoredActions.find(a=>a.layer===name)?.action??name;
      const button=b.button(node,b.root,p.viewClass,'onAction',action);buttonCandidates.push({name,node,id:button,stateIndex,action});
    }
    // Source slots are build/audit data, not runtime components or Inspector fields.
    const sourceComponent=b.objects.length;b.objects.push({node:ref(stateRoot),...slots});
    const context={index:stateIndex,sourcePage:state.sourcePage,config:cfg,root:stateRoot,nodes,images:imageCandidates.filter(e=>e.stateIndex===stateIndex),texts:textCandidates.filter(e=>e.stateIndex===stateIndex),buttons:buttonCandidates.filter(e=>e.stateIndex===stateIndex),sourceComponent,hidden:new Set()};
    applyActions(p,b,context);contexts.push(context);
  }
  const semantic={titleLabel:/标题|名称|关卡标题/,backButton:/返回|关闭/,remainingLabel:/剩余|步数/,scoreLabel:/分数|得分/,rewardLabel:/奖励|花蜜/,progressLabel:/进度|百分比/,gardenProgressLabel:/建设进度|总进度/,honeyLabel:/花蜜数量|蜂蜜数量/,hintLabel:/提示库存/,bodyLabel:/^(信件正文|隐私正文)/,priceLabel:/价格|树屋动态价格/,bubbleLabel:/引导短句/,messageLabel:/提示|说明/,pageLabel:/页码/,settingsButton:/设置|齿轮/,hintButton:/提示/,undoButton:/撤回/,harvestButton:/收获/,startButton:/开始/,skipButton:/跳过/,closeButton:/关闭|返回/,previousButton:/上一|左箭头/,nextButton:/下一|右箭头/};
  if(['toast','gm-command','gm-panel'].includes(p.id)){
    const name=p.id==='toast'?'Message':p.id==='gm-command'?'CommandLabel':'Title';
    const node=b.node(name,b.root,{y:p.id==='gm-panel'?490:0,width:p.id==='gm-panel'?500:Math.min(400,b.size[0]),height:48});
    const id=b.label(node,p.id==='toast'?'提示信息':p.id==='gm-command'?'开发命令':'开发工具');
    textCandidates.push({name:p.id==='toast'?'提示说明':name,node,id,stateIndex:0});
    if(p.id==='gm-panel'){
      const close=b.node('Close',b.root,{x:290,y:490,width:70,height:70});b.label(close,'×');
      const button=b.button(close,b.root,p.viewClass,'onAction','closeButton');buttonCandidates.push({name:'关闭',node:close,id:button,stateIndex:0});
    }
  }
  if(listItemIds.has(p.id)||['level-node','button','icon-button','setting-toggle'].includes(p.id)){
    const existing=buttonCandidates.find(candidate=>candidate.stateIndex===0&&b.objects[candidate.node]._active);
    const button=existing?.id??b.button(b.root,b.root,p.viewClass,'onAction',p.id==='level-node'?'nav:puzzle-preview':'item');
    fields.button=ref(button);fieldNodes.button=existing?.node??b.root;
  }
  let selectedFields=[],stateFields;
  if(coreIds.has(p.id)){const integrated=integrateCore(p,b,contexts,assets,byId,fields);selectedFields=integrated.selectedFields;Object.assign(fields,integrated.fields);if(states.length>1)stateFields=integrated.stateFields;}
  for(const f of coreIds.has(p.id)?[]:p.bindings) {
    if(f.type==='Prefab') {
      const target=byId.get(prefabFields[f.name]??p.listItemId??(p.id==='virtual-list'?'reward-item':null));
      if(target)fields[f.name]=external(target.uuid,'cc.Prefab');else continue;
    }else if(f.type==='Node') {
      if(!fields[f.name]&&p.id==='building'&&f.name==='rotorRoot'){
        const n=b.node('Rotor',b.root,{width:180,height:180});fields[f.name]=ref(n);fieldNodes[f.name]=n;
      }
      if(!fields[f.name])continue;
    }else if(['ScrollView','Mask'].includes(f.type)){continue;}
    else if(f.type==='Label') {
      const pattern=p.id==='level-node'&&f.name==='titleLabel'?/号码$/:semantic[f.name]??/./;
      const found=textCandidates.find(t=>t.stateIndex===0&&pattern.test(t.name));
      if(found){fields[f.name]=ref(found.id);fieldNodes[f.name]=found.node;}
      else continue;
    }else if(f.type==='Button') {
      const found=buttonCandidates.find(t=>t.stateIndex===0&&(semantic[f.name]??/./).test(t.name));
      if(!fields[f.name]&&found){fields[f.name]=ref(found.id);fieldNodes[f.name]=found.node;}
      if(!fields[f.name])continue;
    }else if(f.type==='Sprite') {
      if(f.name==='rotor') {
        const parent=fieldNodes.rotorRoot??dynamic,node=b.node('Rotor',parent,{width:180,height:180});
        fields[f.name]=ref(b.sprite(node));fieldNodes[f.name]=node;selectedFields.push(f);continue;
      }
      const found=imageCandidates.find(t=>t.stateIndex===0&&((f.name==='body'||f.name==='icon')?t.dynamic:/按钮|面板|底|背景/.test(t.name)))??imageCandidates.find(t=>t.stateIndex===0);
      if(found){fields[f.name]=ref(found.id);fieldNodes[f.name]=found.node;}
      else continue;
    }else if(f.type==='ProgressBar') {
      const track=imageCandidates.find(t=>t.stateIndex===0&&/进度.*底|进度.*槽|进度条底/.test(t.name));
      const fill=imageCandidates.find(t=>t.stateIndex===0&&/进度.*填|进度条绿/.test(t.name));
      if(!track||!fill)continue;
      const node=track.node;
      const fillNode=fill?.node??b.node('Fill',node,{width:240,height:30});
      const sprite=fill?.id??b.sprite(fillNode);
      fields[f.name]=ref(b.component(node,'cc.ProgressBar',{_barSprite:ref(sprite),_mode:0,_totalLength:240,_progress:0,_reverse:false}));fieldNodes[f.name]=node;
    }
    if(fields[f.name])selectedFields.push(f);
  }
  if(p.id!=='virtual-list'&&(p.bindings.some(f=>f.type==='ScrollView')||p.id==='gm-panel')) {
    const scroll=makeScroll(b,dynamic,p.listItemId??(p.id==='gm-panel'?'gm-command':null),fields,fieldNodes);
    for(const name of ['scrollView','viewport','content'])if(!selectedFields.some(f=>f.name===name))selectedFields.push({name,type:name==='scrollView'?'ScrollView':name==='viewport'?'Mask':'Node'});
    // Long prose is an authored Label inside the prebound scroll content.
    if(fields.bodyLabel){
      const paragraphs=textCandidates.filter(t=>t.stateIndex===0&&/^(信件正文|隐私正文|隐私分段标题|署名)/.test(t.name));
      const boxes=paragraphs.map(t=>textBox(t.text)),left=Math.min(...boxes.map(x=>x[0])),top=Math.min(...boxes.map(x=>x[1])),right=Math.max(...boxes.map(x=>x[2])),bottom=Math.max(...boxes.map(x=>x[3]));
      const width=right-left,height=Math.min(600,bottom-top);
      Object.assign(b.objects[scroll.root]._lpos,{x:left+width/2-b.size[0]/2,y:b.size[1]/2-top-height/2});
      for(const [node,w,h]of [[scroll.root,width,height],[scroll.viewport,width,height],[scroll.content,width,bottom-top]]){
        const transform=b.objects[b.objects[node]._components[0].__id__];transform._contentSize.width=w;transform._contentSize.height=h;
      }
      Object.assign(b.objects[scroll.viewport]._lpos,{x:-width/2,y:height/2});
      for(const entry of paragraphs){
        const node=b.objects[entry.node],old=node._parent.__id__,box=textBox(entry.text);
        b.objects[old]._children=b.objects[old]._children.filter(r=>r.__id__!==entry.node);node._parent=ref(scroll.content);b.objects[scroll.content]._children.push(ref(entry.node));
        node._lpos.x=(box[0]+box[2])/2-left;node._lpos.y=top-(box[1]+box[3])/2;
      }
    }
  }
  let rootComponent;
  if(p.id==='virtual-list') {
    const scroll=makeScroll(b,b.root,'reward-item',{},{});
    // Use the list component itself as the public root; the nested instance is unnecessary here.
    const nested=b.objects[scroll.root]._components.find(r=>b.objects[r.__id__].__type__===scriptType('assets/scripts/framework/ui/VirtualList.ts'));
    const list=b.objects[nested.__id__];b.objects[scroll.root]._components=b.objects[scroll.root]._components.filter(r=>r!==nested);list.node=ref(b.root);b.objects[b.root]._components.push(nested);rootComponent=nested.__id__;
  }else {
    makeViewScript(p,selectedFields,stateFields);
    rootComponent=b.component(b.root,scriptType(p.scriptPath),{...(states.length>1?{stateRoots,stateIds}:{}),...Object.fromEntries(selectedFields.map(f=>[f.name,fields[f.name]])),...stateFields});
  }
  if(p.category==='item'||p.id==='gm-command') {
    const ui=b.objects[b.root]._components.map(r=>b.objects[r.__id__]).find(o=>o.__type__==='cc.UITransform');ui._anchorPoint={__type__:'cc.Vec2',x:0,y:1};
    // Preserve centered authored child positions after changing the reusable item anchor.
    const anchorChildren=itemIds.has(p.id)?contexts.flatMap(ctx=>b.objects[ctx.root]._children):b.objects[b.root]._children;
    for(const child of anchorChildren){b.objects[child.__id__]._lpos.x+=b.size[0]/2;b.objects[child.__id__]._lpos.y-=b.size[1]/2;}
    if(listItemIds.has(p.id)){
      b.component(b.root,scriptType('assets/scripts/framework/ui/VirtualListItem.ts'),{titleLabel:fields.titleLabel??fields.label??null,selectedMarker:null});
      b.objects[fields.button.__id__].clickEvents=[{__type__:'cc.ClickEvent',target:ref(b.root),component:'',_componentId:scriptType('assets/scripts/framework/ui/VirtualListItem.ts'),handler:'onItemClicked',customEventData:''}];
    }
  }
  integrateItem(p,b,contexts,fields);
  attachPiecePresentation(p,b,fields,byId);
  attachPlayStatus(p,b,contexts);
  groupControls(p,b,contexts);
  if(p.category==='dialog'||p.category==='guide'||p.id==='gm-panel')b.component(b.root,'cc.BlockInputEvents');
  const objects=b.finish();directory(path.dirname(p.path));
  const removed=new Set(contexts.map(context=>context.sourceComponent));
  for(const index of [...removed])if(objects[index].__prefab)removed.add(objects[index].__prefab.__id__);
  const slots=contexts.map(context=>{const {__prefab,...metadata}=objects[context.sourceComponent];return metadata;});
  const indices=new Map();for(let index=0;index<objects.length;index++)if(!removed.has(index))indices.set(index,indices.size);
  const reindex=value=>{
    if(!value||typeof value!=='object')return value;
    if('__id__'in value){if(!indices.has(value.__id__))throw new Error('Removed binding still referenced: '+p.id);return ref(indices.get(value.__id__));}
    if(Array.isArray(value))return value.map(reindex);
    return Object.fromEntries(Object.entries(value).map(([key,entry])=>[key,reindex(entry)]));
  };
  const compiled=objects.filter((_,index)=>!removed.has(index)).map(reindex);
  layoutRecords.push({id:p.id,layouts:slots.map(reindex)});
  writeOnceStableMeta(path.join(PROJECT,p.path),{ver:'1.1.50',importer:'prefab',imported:true,uuid:p.uuid,files:['.json'],subMetas:{},userData:{syncNodeName:p.name}});
  const prefabBytes=JSON.stringify(compiled,null,2)+'\n';queueOutput(p.path,prefabBytes);
  generated.push({...p,bindings:selectedFields,stateIds,rootComponent:indices.get(rootComponent),nodeCount:compiled.filter(o=>o.__type__==='cc.Node').length,geometrySlots:slots.reduce((sum,slot)=>sum+slot.geometrySpecs.length,0),sha256:sha256(prefabBytes)});
}
queueOutput('tools/prefab-foundation/layout-manifest.json',JSON.stringify({schema:'hexa.prefab-layout-audit.v1',prefabs:layoutRecords},null,2)+'\n');
// Publish metadata for hand-authored framework and application components as well.
function visitScripts(dir) {if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())visitScripts(file);else if(entry.name.endsWith('.ts'))script(normalize(path.relative(PROJECT,file)));}}
visitScripts(path.join(PROJECT,'assets/scripts'));
const registry={schema:'hexa.prefab-foundation.registry.v1',businessConnected:false,counts:categoryCounts,dataAssets:[{id:'data:level-catalog',uuid:stableUuid(LEVEL_CATALOG_PATH),bundle:'puzzle',resourcePath:'config/level-catalog',assetPath:LEVEL_CATALOG_PATH}],prefabs:generated,routes:routeCatalog,sourceHash:assets.manifest.sourceHashes,limitations:['Geometry mounts are serialized with original renderer specs; gameplay geometry, input and rule execution remain pending.','Preview samples are read-only artwork fixtures, never player save data.','GM contains bound controls only; no development commands or save mutation.']};
queueOutput('assets/resources/framework/config/prefab-registry.json',JSON.stringify(registry,null,2)+'\n');
directory('assets/bundles/debug',{name:'debug',priority:1});
// A small permanent composition scene; all presentation hierarchy lives in the Prefabs above.
const scene=new Builder('Main',[853,1844]),canvas=scene.root;
scene.objects[0]={__type__:'cc.SceneAsset',_name:'Main',_objFlags:0,__editorExtras__:{},_native:'',scene:ref(1)};
const sceneRoot=scene.objects.length;scene.objects.push({__type__:'cc.Scene',_name:'Main',_objFlags:0,__editorExtras__:{},_parent:null,_children:[ref(canvas)],_active:true,_components:[],_prefab:null,_lpos:{__type__:'cc.Vec3',x:0,y:0,z:0},_lrot:{__type__:'cc.Quat',x:0,y:0,z:0,w:1},_lscale:{__type__:'cc.Vec3',x:1,y:1,z:1},_mobility:0,_layer:1073741824,_euler:{__type__:'cc.Vec3',x:0,y:0,z:0},autoReleaseAssets:false,_id:stableUuid('assets/scenes/Main.scene')});
scene.objects[0].scene=ref(sceneRoot);scene.objects[canvas]._parent=ref(sceneRoot);scene.objects[canvas]._name='Canvas';
const camera=scene.node('Camera',canvas,{width:853,height:1844});scene.objects[camera]._lpos.z=1000;
const cameraComponent=scene.component(camera,'cc.Camera',{_projection:0,_priority:0,_fov:45,_fovAxis:0,_orthoHeight:922,_near:0,_far:2000,_color:color([30,51,34]),_depth:1,_stencil:0,_clearFlags:7,_rect:{__type__:'cc.Rect',x:0,y:0,width:1,height:1},_aperture:19,_shutter:7,_iso:0,_screenScale:1,_visibility:1108344832,_targetTexture:null,_postProcess:null,_usePostProcess:false,_cameraType:-1,_trackingType:0});
scene.component(canvas,'cc.Canvas',{_cameraComponent:ref(cameraComponent),_alignCanvasWithScreen:true});
const page=scene.node('Pages',canvas,{width:853,height:1844}),dialog=scene.node('Dialogs',canvas,{width:853,height:1844}),guide=scene.node('Guides',canvas,{width:853,height:1844});
const host=scene.component(canvas,scriptType('assets/scripts/framework/ui/ViewHost.ts'),{pageLayer:ref(page),dialogLayer:ref(dialog),guideLayer:ref(guide)});
const badge=scene.node('PreviewNotice',canvas,{y:890,width:760,height:50});const badgeLabel=scene.label(badge,'界面骨架预览 · 业务待接入',{font_size:22,color_rgb:[255,255,255]});
scene.button(badge,canvas,'FoundationBoot','onDemoAction');
scene.component(canvas,scriptType('assets/scripts/app/FoundationBoot.ts'),{host:ref(host),loadingPrefab:external(byId.get('loading').uuid,'cc.Prefab'),statusLabel:ref(badgeLabel)});
// Scene serialization uses stable node IDs rather than PrefabInfo records.
for(let i=1;i<scene.objects.length;i++){const o=scene.objects[i];if(o.__type__==='cc.Node'||o.__type__==='cc.Scene')o._id=stableUuid('Main:'+i);}
// Preserve the established entry identity referenced by editor/build settings.
directory('assets/scenes');writeOnceStableMeta(path.join(PROJECT,'assets/scenes/Main.scene'),{ver:'1.1.50',importer:'scene',imported:true,uuid:'18d4953b-98af-4367-aed2-67c183a3faaf',files:['.json'],subMetas:{},userData:{}});
// Creator maintains scene camera/canvas authoring data. Initialize this scene
// once, then leave it to the editor; regenerating Prefabs must not reset it.
if(!fs.existsSync(path.join(PROJECT,'assets/scenes/Main.scene')))
  writeFile(path.join(PROJECT,'assets/scenes/Main.scene'),JSON.stringify(serializeScene(scene.objects,sceneRoot,'18d4953b-98af-4367-aed2-67c183a3faaf'),null,2)+'\n');
managed.preflight();
for(const [file,bytes]of pendingOutputs)managed.write(file,bytes);
managed.commit();
fs.mkdirSync(SCRATCH,{recursive:true});writeFile(path.join(SCRATCH,'generation.json'),JSON.stringify({counts:categoryCounts,prefabs:generated.length,nodes:generated.reduce((s,p)=>s+p.nodeCount,0),sourceUnchanged:true,businessConnected:false},null,2)+'\n');
console.log(JSON.stringify({prefabs:generated.length,counts:categoryCounts,nodes:generated.reduce((s,p)=>s+p.nodeCount,0)}));
