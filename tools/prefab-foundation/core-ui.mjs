import fs from 'node:fs';
import {ref,external,scriptType} from './builder.mjs';
import {attachLevelPresentation} from './level-ui.mjs';
const actions=JSON.parse(fs.readFileSync(new URL('./core-actions.json',import.meta.url))).configs;
export const coreIds=new Set(actions.map(config=>config.id));
export const itemIds=new Set(['level-node','building','hex-cell','tray-slot']);
const component='assets/scripts/features/presentation/';
const imageBox=layer=>{const a=layer.anchor||[0,0];return[layer.position[0]-a[0]*layer.size[0],layer.position[1]-a[1]*layer.size[1],...layer.size];};
const textBox=text=>{const b=text.box||text.layout_box;return[b[0],b[1],b[2]-b[0],b[3]-b[1]];};
const rect=(box,left=0,top=0)=>({x:box[0]-left+box[2]/2,y:top-box[1]-box[3]/2,width:box[2],height:box[3]});
const defaults={labels:[],labelKeys:[],progressBars:[],progressKeys:[],itemMounts:[],itemPrefabs:[],itemData:[]};

export function applyActions(p,b,context){
  const config=actions.find(config=>config.id===p.id&&config.sourcePage===context.sourcePage);
  if(!config)return;
  for(const mapping of config.buttons){
    const entry=context.nodes.filter(entry=>entry.name===mapping.name)[mapping.occurrence];
    if(!entry)continue; // Overlay extraction deliberately excludes the underlying page.
    let button=b.objects[entry.node]._components.map(r=>({id:r.__id__,o:b.objects[r.__id__]})).find(c=>c.o.__type__==='cc.Button');
    if(!button){const id=b.button(entry.node,b.root,p.viewClass,'onAction',mapping.action);button={id,o:b.objects[id]};}
    button.o.clickEvents=[{__type__:'cc.ClickEvent',target:ref(b.root),component:p.viewClass,_componentId:'',handler:'onAction',customEventData:mapping.action}];
    context.buttons.push({name:entry.name,node:entry.node,id:button.id,action:mapping.action});
  }
}

/** Explicit, source-bound contracts for the integrated pages. No fallback nodes. */
export function integrateCore(p,b,contexts,assets,byId,base){
  const definitions=new Map(),references=new Map(),presenters=[];
  const bind=(ctx,name,type,id)=>{
    if(id===undefined||id===null)throw new Error(`${p.id}/${ctx.sourcePage}: missing actual ${name}`);
    definitions.set(name,{name,type});
    if(!references.has(name))references.set(name,[]);
    references.get(name)[ctx.index]=type==='Prefab'?external(byId.get(id).uuid,'cc.Prefab'):ref(id);
  };
  for(const ctx of contexts){
    const field=(name,type,id)=>bind(ctx,name,type,id);
    const find=(list,pattern)=>list.find(entry=>pattern.test(entry.name));
    const label=pattern=>find(ctx.texts,pattern)?.id;
    const button=pattern=>find(ctx.buttons,pattern)?.id;
    const container=(name,entries=[])=>{
      const id=b.node(name,ctx.root,{width:b.size[0],height:b.size[1]});
      if(entries.length){
        const ids=new Set(entries.map(e=>e.node)),parent=b.objects[ctx.root],order=parent._children.filter(r=>ids.has(r.__id__));
        const insertion=parent._children.findIndex(r=>ids.has(r.__id__));
        parent._children=parent._children.filter(r=>!ids.has(r.__id__)&&r.__id__!==id);parent._children.splice(insertion,0,ref(id));
        b.objects[id]._children=order;for(const entry of order)b.objects[entry.__id__]._parent=ref(id);
      }
      return id;
    };
    const data={values:{}},presentation=structuredClone(defaults);
    const hide=entry=>{b.objects[entry.node]._active=false;ctx.hidden.add(entry.node);};
    const value=(entry,key,text)=>{
      if(!entry)throw new Error(`${p.id}/${ctx.sourcePage}: missing text ${key}`);
      presentation.labels.push(ref(entry.id));presentation.labelKeys.push(key);data.values[key]=text;
    };
    const progress=(trackPattern,fillPattern,key,amount)=>{
      const track=find(ctx.images,trackPattern);let fill=find(ctx.images,fillPattern);
      if(track&&!fill&&amount===0){
        const template=find(contexts[0].images,fillPattern);
        if(template){const parent=b.objects[track.node]._parent.__id__,trackNode=b.objects[track.node],size=b.objects[b.objects[track.node]._components[0].__id__]._contentSize;
          const node=b.node(key+'Fill',parent,{x:trackNode._lpos.x,y:trackNode._lpos.y,width:size.width,height:30});
          fill={node,id:b.sprite(node,b.objects[template.id]._spriteFrame?.__uuid__)};
        }
      }
      if(!track||!fill)throw new Error(`${p.id}/${ctx.sourcePage}: missing progress ${key}`);
      const trackSize=b.objects[b.objects[track.node]._components[0].__id__]._contentSize;
      const fillTransform=b.objects[b.objects[fill.node]._components[0].__id__];
      const fillObject=b.objects[fill.node],trackObject=b.objects[track.node];
      fillTransform._contentSize.width=trackSize.width;
      fillObject._lpos.x=trackObject._lpos.x;
      const id=b.component(track.node,'cc.ProgressBar',{_barSprite:ref(fill.id),_mode:0,_totalLength:trackSize.width,_progress:amount,_reverse:false});
      presentation.progressBars.push(ref(id));presentation.progressKeys.push(key);data.values[key]=amount;
      return id;
    };
    const mount=(parent,name,box,itemId,itemData,sourceEntries)=>{
      const node=b.node(name,parent,{x:box[0]-b.size[0]/2,y:b.size[1]/2-box[1],width:box[2],height:box[3],anchorX:0,anchorY:1});
      presentation.itemMounts.push(ref(node));presentation.itemPrefabs.push(external(byId.get(itemId).uuid,'cc.Prefab'));
      presentation.itemData.push(JSON.stringify(itemData));sourceEntries.forEach(hide);
      const children=b.objects[parent]._children,slot=children.findIndex(r=>sourceEntries.some(e=>e.node===r.__id__));
      if(slot>=0){children.pop();children.splice(slot,0,ref(node));}
      return node;
    };
    // Every displayed text slot has a data value in this layout, including fixture overrides.
    for(const entry of ctx.texts)value(entry,entry.text.text_id||entry.name,entry.text.default_text??entry.text.text??'');
    const textOverride=(pattern,text)=>{for(let i=0;i<ctx.texts.length;i++)if(pattern.test(ctx.texts[i].name))data.values[ctx.texts[i].text.text_id||ctx.texts[i].name]=text;};
    textOverride(/花蜜数量$|花蜜余额$|蜂蜜数量$/,120);textOverride(/提示库存$|提示库存值$|本关提示库存$/,5);
    if(p.id==='mainline-map'){
      const nodesRoot=container('LevelNodes',ctx.nodes.filter(e=>/^关卡\d+|^当前关卡/.test(e.name)));field('nodesRoot','Node',nodesRoot);field('levelNodePrefab','Prefab','level-node');
      field('gardenButton','Button',button(/^建造花园$/));field('settingsButton','Button',button(/^设置$/));
      const levels=ctx.images.filter(entry=>/^关卡\d+底板$/.test(entry.name));
      for(const entry of levels){
        const number=entry.name.match(/\d+/)[0],stars=ctx.images.filter(e=>new RegExp(`^关卡${number}星[123]$`).test(e.name));
        const numberText=find(ctx.texts,new RegExp(`^关卡${number}号码$`));
        const entries=[entry,...stars,numberText],boxes=entries.map(e=>e.layer?imageBox(e.layer):textBox(e.text));
        const left=Math.min(...boxes.map(r=>r[0])),top=Math.min(...boxes.map(r=>r[1]));
        const width=Math.max(...boxes.map(r=>r[0]+r[2]))-left,height=Math.max(...boxes.map(r=>r[1]+r[3]))-top;
        mount(nodesRoot,'Level'+number,[left,top,width,height],'level-node',{values:{number},bodyAssetId:entry.resource,bodyBox:rect(imageBox(entry.layer),left,top),rootSize:[width,height],accentAssetIds:stars.map(s=>s.resource),accentBoxes:stars.map(s=>rect(imageBox(s.layer),left,top)),labelBoxes:[rect(textBox(numberText.text),left,top)],labelFontSizes:[numberText.text.font_size]},entries);
      }
      textOverride(/^体力数值$/, '∞');textOverride(/^体力状态$/, '畅玩');textOverride(/^我的排名$/, '本机纪录');
    }else if(p.id==='garden'){
      field('titleLabel','Label',label(/^当前花园名称$/));field('backButton','Button',button(/^返回综合地图$/));
      const root=container('Buildings',ctx.images.filter(e=>/^(向阳花园|清风水湾|云上蜂谷)_.*_\d级/.test(e.name)));field('buildingsRoot','Node',root);field('buildingPrefab','Prefab','building');field('effectRoot','Node',container('Effects'));
      const total=ctx.config.runtime?.total_level??0;
      field('gardenProgress','ProgressBar',progress(/^花园25阶总进度底轨$/, /^花园25阶总进度填充$/, 'gardenProgress',total/25));
      field('gardenProgressLabel','Label',label(/^花园总等级$/));
      const bodies=ctx.images.filter(e=>e.layer.metadata?.building!==undefined&&!/转子/.test(e.name)&&e.layer.metadata?.stage!==undefined&&!/裸地形/.test(e.name));
      // Some deliveries encode building identity in the layer name rather than metadata.
      const actual=bodies.length===5?bodies:ctx.images.filter(e=>/^(向阳花园|清风水湾|云上蜂谷)_.*_\d级/.test(e.name)&&!/转子/.test(e.name));
      if(actual.length!==5)throw new Error(ctx.sourcePage+': expected five authored building bodies, got '+actual.length);
      for(const body of actual){
        const box=imageBox(body.layer),rotor=ctx.images.find(e=>/独立水轮转子/.test(e.name));
        const isWheel=/水车/.test(body.name),entries=[body];if(isWheel&&rotor)entries.push(rotor);
        const itemData={bodyAssetId:body.resource,rootSize:[box[2],box[3]],bodyBox:rect(box,box[0],box[1]),rotorAssetId:isWheel&&rotor?rotor.resource:null};
        if(isWheel&&rotor)itemData.rotorBox=rect(imageBox(rotor.layer),box[0],box[1]);
        mount(root,'Building'+actual.indexOf(body),box,'building',itemData,entries);
      }
      for(const name of ['树屋','花园','蜂蜜工坊','小溪水车','温室']){
        const index=['树屋','花园','蜂蜜工坊','小溪水车','温室'].indexOf(name),stage=ctx.config.runtime?.buildings?.[index]??0;
        progress(new RegExp('^'+name+'五级进度底轨$'),new RegExp('^'+name+'独立五级进度填充$'), 'buildingProgress'+index,stage/5);
      }
    }else if(p.id==='puzzle'||p.id==='puzzle-preview'){
      field('titleLabel','Label',label(/^页面标题$/));
      const board=container('BoardCells',ctx.images.filter(e=>/^主棋盘_凹槽_/.test(e.name)));
      const tray=container('TrayCells',ctx.images.filter(e=>/^完整托盘_拼块\d+_格\d+$|^完整托盘_无字木托盘$/.test(e.name)));
      field('boardRoot','Node',board);field('trayRoot','Node',tray);
      for(const entry of ctx.images.filter(e=>/^主棋盘_凹槽_|^完整托盘_拼块\d+_格\d+$/.test(e.name))){
        const box=imageBox(entry.layer);mount(/^主棋盘/.test(entry.name)?board:tray,entry.name,box,'hex-cell',{bodyAssetId:entry.resource,rootSize:[box[2],box[3]],bodyBox:rect(box,box[0],box[1])},[entry]);
      }
      const trayImage=find(ctx.images,/^完整托盘_无字木托盘$/);
      if(trayImage){const box=imageBox(trayImage.layer),node=mount(tray,'TrayFrame',box,'tray-slot',{bodyAssetId:trayImage.resource,rootSize:[box[2],box[3]],bodyBox:rect(box,box[0],box[1])},[trayImage]);const children=b.objects[tray]._children;children.splice(children.findIndex(r=>r.__id__===node),1);children.unshift(ref(node));}
      if(p.id==='puzzle'){
        field('hintRoot','Node',container('HintGeometry',ctx.nodes.filter(e=>/^主棋盘_金色提示轮廓$/.test(e.name))));field('cellPrefab','Prefab','hex-cell');field('slotPrefab','Prefab','tray-slot');field('piecePrefab','Prefab','puzzle-piece');
        field('remainingLabel','Label',label(/^剩余数量$|^剩余步数$/));field('hintButton','Button',button(/^提示轮廓木圆按钮$/));
        field('returnPieceButton','Button',button(/^取回拼块木圆按钮$/));field('pauseButton','Button',button(/^设置木质齿轮$/));field('helpButton','Button',button(/^图示帮助木圆按钮$/));
      }else{field('startButton','Button',button(/^免费开始_无字按钮$/));field('backButton','Button',button(/^返回地图$/));field('rewardLabel','Label',label(/^收益说明$/));textOverride(/^收益说明$/,'界面演示 · 不记录通关或奖励');}
    }else if(p.id==='loading'){
      field('statusLabel','Label',label(/^加载状态$/));field('progressLabel','Label',label(/^加载百分比$/));textOverride(/^加载状态$/,'正在准备界面');
    }else{
      field('titleLabel','Label',label(/^页面标题$|^弹窗标题$/));
      const backPattern=p.id==='pause'?/^继续玩_无字按钮$/:p.id==='confirmation'?/^继续这一局_无字按钮$/:p.id==='settings'?/^返回游戏_原生按钮$/:p.id==='help-index'?/^返回设置_无字按钮$/:p.id==='help-detail'?/^(返回|知道了)_无字按钮$/:/^返回上一页$/;
      field('backButton','Button',button(backPattern));
      if(p.id==='puzzle-result'){field('nextButton','Button',button(/^下一关_原生按钮$/));field('gardenButton','Button',button(/^回家园$/));textOverride(/^页面标题$/,'结算样式预览');textOverride(/^已到账$/,'演示数据 · 尚未发放奖励');textOverride(/^本次实际奖励$/,'+0');}
      if(p.id==='confirmation')textOverride(/^弹窗说明$/,'界面流程演示，不修改存档或对局');
    }
    // Replaced source nodes are not loaded or drawn alongside their reusable item instances.
    const source=b.objects[ctx.sourceComponent];
    for(const [refs,keys]of [['dynamicSprites','imageIds'],['dynamicLabels','textKeys']]){
      const keep=source[refs].map((r,i)=>({r,i})).filter(({r})=>!ctx.hidden.has(b.objects[r.__id__].node.__id__));
      source[refs]=keep.map(({r})=>r);source[keys]=keep.map(({i})=>source[keys][i]);
      if(refs==='dynamicLabels')source.previewTexts=keep.map(({i})=>source.previewTexts[i]);
    }
    const kept=presentation.labels.map((r,i)=>({r,i})).filter(({r})=>!ctx.hidden.has(b.objects[r.__id__].node.__id__));
    presentation.labels=kept.map(({r})=>r);presentation.labelKeys=kept.map(({i})=>presentation.labelKeys[i]);
    const layout=b.component(ctx.root,scriptType(component+'CorePresentation.ts'),{...presentation,actionTarget:ref(b.root),previewData:JSON.stringify(data)});
    presenters.push(ref(layout));
    attachLevelPresentation(p,b,ctx,assets,byId,presentation,layout);
  }
  b.component(b.root,scriptType(component+'PresentationGroup.ts'),{layouts:presenters});
  const selectedFields=[...definitions.values()],fields={},stateFields={};
  for(const field of selectedFields){const values=references.get(field.name);if(values.length!==contexts.length||values.some(v=>!v))throw new Error(p.id+': incomplete state contract '+field.name);fields[field.name]=values[0];stateFields[field.name+'States']=values;}
  return {selectedFields,fields,stateFields};
}

export function integrateItem(p,b,contexts,fields){
  if(!itemIds.has(p.id))return;
  if(p.id==='level-node'){
    const button=b.objects[fields.button.__id__];
    b.component(b.root,scriptType('assets/scripts/features/mainline/presentation/MainlineLevelSelection.ts'));
    for(const event of button.clickEvents)if(event.handler==='onAction'){
      event.component='MainlineLevelSelection';event.handler='onSelect';event.customEventData='nav:puzzle-preview';
    }
  }
  const ctx=contexts[0],body=p.id==='building'?fields.body:fields.icon??ref(ctx.images[0].id);
  const number=ctx.texts.find(e=>/号码$/.test(e.name));
  const stars=ctx.images.filter(e=>/星[123]$/.test(e.name));
  b.component(b.root,scriptType(component+'PresentationItem.ts'),{body,rotor:fields.rotor??null,rotorRoot:fields.rotorRoot??null,labels:number?[ref(number.id)]:[],labelKeys:number?['number']:[],bars:[],barKeys:[],accents:stars.map(s=>ref(s.id)),previewData:JSON.stringify({values:number?{number:number.text.text}: {}})});
}
