import {ref,external,scriptType} from './builder.mjs';
const base='assets/scripts/features/';
const box=layer=>{const a=layer.anchor||[0,0];return[layer.position[0]-a[0]*layer.size[0],layer.position[1]-a[1]*layer.size[1],...layer.size];};

export function attachLevelPresentation(p,b,ctx,assets,byId,presentation,layout){
  if(p.id==='mainline-map'){
    const art=assets.manifest.records.find(r=>r.name==='返回按钮');
    if(!art)throw new Error('Missing existing navigation arrow');
    const controls=[];
    for(const [name,x,action,flip]of [['PreviousSegment',90,'map:previous',false],['NextSegment',763,'map:next',true]]){
      const node=b.node(name,ctx.root,{x:x-b.size[0]/2,y:b.size[1]/2-1400,width:160,height:160},false);
      const icon=b.node('Arrow',node,{width:160,height:160});b.sprite(icon,art.spriteFrameUuid);
      if(flip)b.objects[icon]._lscale.x=-1;
      controls.push(b.button(node,b.root,p.viewClass,'onAction',action));
    }
    const page=b.node('SegmentNumber',ctx.root,{x:0,y:b.size[1]/2-1440,width:260,height:60},false);
    const pageLabel=b.label(page,'1 / 12',{font_size:44,color_rgb:[255,250,220],weight:'bold',stroke_width:3,stroke_color:[70,40,15]});
    b.component(ctx.root,scriptType(base+'mainline/presentation/MainlineMapPresentation.ts'),{
      layout:ref(layout),pageLabel:ref(pageLabel),previousButton:ref(controls[0]),nextButton:ref(controls[1]),actionTarget:ref(b.root),
    });
    return;
  }
  if(p.id!=='puzzle'&&p.id!=='puzzle-preview')return;
  const boardLayer=ctx.nodes.find(e=>e.name==='主棋盘_原生木纹底')?.layer;
  const trayLayer=ctx.images.find(e=>e.name==='完整托盘_无字木托盘')?.layer;
  if(!boardLayer||!trayLayer)throw new Error('Missing authored puzzle bounds: '+ctx.sourcePage);
  const boardBox=box(boardLayer),trayBox=box(trayLayer);
  const live=b.node('LevelPresentation',ctx.root,{width:b.size[0],height:b.size[1]},false);
  const mount=(name,r)=>b.node(name,live,{x:r[0]+r[2]/2-b.size[0]/2,y:b.size[1]/2-r[1]-r[3]/2,width:r[2],height:r[3]});
  const board=mount('QuestionCells',boardBox);
  // Keep source tray rails visible; inset the content instead of moving the authored frame.
  const tray=mount('QuestionPieces',[trayBox[0]+28,trayBox[1]+26,trayBox[2]-56,trayBox[3]-52]);
  const wood=assets.manifest.records.find(r=>r.name==='hex_wood_floor');
  const well=assets.manifest.records.find(r=>r.id==='block_reuse_f714e5b86eea9964a094');
  if(!wood||!well)throw new Error('Missing registered original puzzle materials');
  const geometries=[];
  for(const role of ['shadow','floor','rim']){
    const node=mount('Question'+role,boardBox),graphics=b.component(node,'cc.Graphics');
    let mask=null,texture=null;
    if(role==='floor'){
      mask=ref(b.component(node,'cc.Mask',{_type:2,_inverted:false,_segments:64,_alphaThreshold:.1}));
      const material=b.node('Wood',node,{width:boardBox[2],height:boardBox[3]});
      texture=ref(b.sprite(material,wood.spriteFrameUuid));b.objects[texture.__id__]._type=2;
    }
    geometries.push(b.component(node,scriptType(base+'presentation/SourceGeometry.ts'),{graphics:ref(graphics),mask,texture,
      spec:JSON.stringify({renderer:'block.hex.v1',role,cells:[[0,0]],bbox:[0,0,boardBox[2],boardBox[3]],padding:32,flip_y:true})}));
  }
  // Permanent source order: shadow, wood, rim, empty cells, whole pieces.
  b.objects[live]._children=[...geometries.map(id=>ref(b.objects[id].node.__id__)),ref(board),ref(tray)];
  const palette=['金色','蓝色','粉色','绿色','紫色'].map(color=>{
    const art=assets.manifest.records.find(r=>r.name===color+'无花母件');
    if(!art)throw new Error('Missing original hex master '+color);return art.id;
  });
  const textures={};for(const [i,n]of [1,3,6,7,8,9,10,11,12,13,16,17].entries())textures[n+'_png']=palette[i%palette.length];
  const source=b.objects[ctx.sourceComponent];
  const fixtures=[...presentation.itemMounts.filter(r=>b.objects[r.__id__]._name!=='TrayFrame'),...source.geometryMounts,
    ...ctx.texts.filter(t=>/^主棋盘_障碍标记|^提示消耗/.test(t.name)).map(t=>ref(t.node))];
  const label=pattern=>{const match=ctx.texts.find(t=>pattern.test(t.name));return match?ref(match.id):null;};
  const boardComponent=b.component(ctx.root,scriptType(base+'puzzle/presentation/PuzzleBoardPresentation.ts'),{
    liveRoot:ref(live),fixtureNodes:fixtures,boardMount:ref(board),piecesMount:ref(tray),
    cellPrefab:external(byId.get('hex-cell').uuid,'cc.Prefab'),piecePrefab:external(byId.get('puzzle-piece').uuid,'cc.Prefab'),
    boardShadow:ref(geometries[0]),boardFloor:ref(geometries[1]),boardRim:ref(geometries[2]),
    remainingLabel:label(/^剩余数量$/),remainingCaptionLabel:label(/^剩余标签$/),levelLabel:label(/^页面标题$/),totalCellsLabel:label(/^轮廓填充进度$/),
    moveLimitLabel:label(/^剩余步数$/),wellAssetId:well.id,obstacleAssetId:well.id,textureAssetIds:JSON.stringify(textures),
  });
  if(p.id==='puzzle'){
    const preview=mount('PlacementPreview',boardBox),drag=mount('DraggedPiece',boardBox);
    const graphics=b.component(preview,'cc.Graphics');
    b.component(ctx.root,scriptType(base+'puzzle/controller/PuzzleController.ts'),{
      board:ref(boardComponent),dragRoot:ref(drag),previewRoot:ref(preview),previewGraphics:ref(graphics),
    });
  }
}

export function attachPiecePresentation(p,b,fields,byId){
  if(p.id!=='puzzle-piece')return;
  const transform=b.objects[b.objects[b.root]._components[0].__id__];
  transform._anchorPoint={__type__:'cc.Vec2',x:.5,y:.5};
  for(const child of b.objects[b.root]._children){b.objects[child.__id__]._lpos.x-=b.size[0]/2;b.objects[child.__id__]._lpos.y+=b.size[1]/2;}
  const node=b.node('PieceCells',b.root,{width:100,height:100});
  b.component(b.root,scriptType(base+'puzzle/presentation/PuzzlePiecePresentation.ts'),{
    previewRoot:fields.previewRoot,cellsRoot:ref(node),cellPrefab:external(byId.get('hex-cell').uuid,'cc.Prefab'),touchArea:b.objects[b.root]._components[0],
  });
}
