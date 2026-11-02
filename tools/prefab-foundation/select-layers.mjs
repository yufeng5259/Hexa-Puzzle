// Build-time extraction rules. Coordinates and source layer descriptors are
// intentionally preserved; the Prefab builder performs the local translation.
const nameOf = layer => layer.name || layer.layer_name || '';
const bounds = entry => entry.box || (entry.position && entry.size ? [entry.position[0],entry.position[1],entry.position[0]+entry.size[0],entry.position[1]+entry.size[1]] : null);
const textFor = (layer,config) => (config.texts||[]).find(t => (layer.text_id && [t.id,t.text_id].includes(layer.text_id)) || (layer.id && [t.id,t.text_id].includes(layer.id)));
const layerBounds = (layer,config) => bounds(layer) || bounds(textFor(layer,config)||{});
const centerInside = (box,rect) => box && (box[0]+box[2])/2>=rect[0] && (box[0]+box[2])/2<=rect[2] && (box[1]+box[3])/2>=rect[1] && (box[1]+box[3])/2<=rect[3];
const visible = layers => layers.filter(layer=>layer.visible!==false);
const matching = (layers,pattern) => layers.filter(layer=>pattern.test(nameOf(layer)));
const first = (layers,pattern) => matching(layers,pattern).slice(0,1);
const between = (layers,start,end) => {
  const begin=layers.find(layer=>start.test(nameOf(layer)));
  if(!begin)return [];
  const finish=layers.find(layer=>layer.z>begin.z&&end.test(nameOf(layer)));
  return layers.filter(layer=>layer.z>=begin.z&&(!finish||layer.z<finish.z));
};
const around = (layers,config,pattern) => {
  const mother=layers.find(layer=>pattern.test(nameOf(layer)));
  const rect=mother&&layerBounds(mother,config);
  if(!rect)return [];
  // Backgrounds and parent frames may have their centers inside an item; they
  // must not become children. Only smaller layers entirely inside are kept.
  return layers.filter(layer=>{
    const b=layerBounds(layer,config);
    return b&&b[0]>=rect[0]-2&&b[1]>=rect[1]-2&&b[2]<=rect[2]+2&&b[3]<=rect[3]+2;
  });
};
const guidePattern=/^(引导原生木纹提示框|引导原生奶油内衬|引导短句|引导步骤|跳过引导|引导手指)$/;

/** Returns a source-layer subset, in original z order, without mutating it. */
export function selectLayers(prefab,config) {
  if(!config)return [];
  const layers=visible(config.layers||[]);
  let selected;
  if(prefab.id==='endless')selected=layers.filter(layer=>layer.z<85);
  else if(prefab.category==='guide'||prefab.id==='guide-overlay')selected=layers.filter(layer=>layer.group==='事件式引导'||guidePattern.test(nameOf(layer)));
  else if(['page','dialog'].includes(prefab.category)) {
    const mask=layers.find(layer=>layer.group==='弹窗遮罩');
    // The original runtime renders overlay foreground from the mask onward.
    // T08=86, T12=114, T13=85, T36/T37/T38=79; derive from each source.
    selected=mask?layers.filter(layer=>layer.z>=mask.z):layers;
  } else {
    switch(prefab.id) {
      case 'level-node': {
        const node=layers.find(layer=>/^关卡\d+底板$/.test(nameOf(layer)));
        const prefix=node&&nameOf(node).replace(/底板$/,'');
        selected=prefix?layers.filter(layer=>nameOf(layer).startsWith(prefix)&&/^关卡\d+(底板|星[123]|号码)$/.test(nameOf(layer))):[];
        break;
      }
      case 'featured-item':selected=between(layers,/^精选原生行0$/,/^精选原生行1$/);break;
      case 'building':selected=first(layers,/^向阳花园_树屋_\d级$/);break;
      case 'building-price':selected=matching(layers,/^树屋(空白进度牌|五级进度底轨|独立五级进度填充|直接升级按钮|等级|动态价格与状态|价格|名称|阶段|花蜜|当前等级|升级花蜜)/);break;
      case 'scene-companion':selected=first(layers,/^原稿场景角色_树屋飞行蜜蜂$/);break;
      case 'companion-card':selected=between(layers,/^伙伴原生行0$/,/^伙伴原生行1$/);break;
      case 'affinity-node':selected=between(layers,/^成长节点原生卡0$/,/^成长节点原生卡1$/);break;
      case 'outfit-item':selected=between(layers,/^衣柜原生物品格0$/,/^衣柜原生物品格1$/);break;
      case 'photo-item': {
        const rows=layers.filter(layer=>nameOf(layer)==='无字面板_row');
        selected=rows[0]?layers.filter(layer=>layer.z>=rows[0].z&&(!rows[1]||layer.z<rows[1].z)):[];break;
      }
      case 'theme-card': {
        const rows=layers.filter(layer=>nameOf(layer)==='无字面板_row');
        selected=rows[0]?layers.filter(layer=>layer.z>=rows[0].z&&(!rows[1]||layer.z<rows[1].z)):[];break;
      }
      case 'task-item':selected=between(layers,/^每日任务原生行0$/,/^每日任务原生行1$/);break;
      case 'achievement-item':selected=between(layers,/^成就原生木行0$/,/^成就原生木行1$/);break;
      case 'signin-cell':selected=between(layers,/^第1天_原生奖励格$/,/^第2天_原生奖励格$/);break;
      case 'event-card': {
        const begin=layers.find(layer=>nameOf(layer)==='picnic');
        const end=layers.find(layer=>nameOf(layer)==='去看看_原生按钮');
        selected=begin?layers.filter(layer=>layer.z>=begin.z&&(!end||layer.z<=end.z+1)):[];break;
      }
      case 'milestone-item':selected=between(layers,/^野餐节点底0$/,/^野餐节点底1$/);break;
      case 'mail-item':selected=around(layers,config,/^信箱原生消息行$/);break;
      // The original contains one nine-slice tray frame, not a baked image per
      // slot. Keep this reusable mother only. Builder uses runtime slot bbox.
      case 'tray-slot':selected=first(layers,/^完整托盘_无字木托盘$/);break;
      case 'puzzle-piece':selected=matching(layers,/^完整托盘_拼块0_格\d+$/);break;
      case 'hex-cell':selected=first(layers,/^主棋盘_凹槽_/);break;
      case 'puzzle-tutorial':
      case 'endless-tutorial':
      case 'garden-tutorial':selected=layers.filter(layer=>!['背景','公共HUD','HUD'].includes(layer.group)&&layer.z>14&&!/^(无字面板_|我来试试_|返回_)/.test(nameOf(layer)));break;
      case 'reward-item':selected=around(layers,config,/^原尺寸奖励卡$/);break;
      case 'button':selected=matching(layers,/^免费开始_(无字按钮|文案)$/);break;
      case 'icon-button':selected=matching(layers,/^提示轮廓(木圆按钮|图标)$/);break;
      case 'resource-hud':selected=layers.filter(layer=>['HUD','公共HUD'].includes(layer.group)||centerInside(layerBounds(layer,config),[0,0,853,180])&&layer.type==='text');break;
      case 'resource-counter':selected=matching(layers,/^花蜜(数量底条|图标|数量)$/);break;
      case 'title-bar':selected=matching(layers,/^(左标题吊绳|右标题吊绳|好友系原生标题木牌|页面标题)$/);break;
      case 'dialog-frame':selected=matching(layers,/^(原生厚木边弹窗|弹窗左花叶|弹窗右花叶|原生弹窗木牌|弹窗标题)$/);break;
      case 'progress':selected=matching(layers,/^加载进度(底槽|填充)$/);break;
      case 'setting-toggle':selected=between(layers,/^设置原生行0$/,/^设置原生行1$/);break;
      case 'virtual-list':case 'toast':case 'gm-panel':case 'gm-command':selected=[];break;
      default:throw new Error(`No source-layer extraction rule for ${prefab.id}`);
    }
  }
  return selected.sort((a,b)=>(a.z||0)-(b.z||0));
}

/** Returns the editable text descriptors belonging to the selected layers. */
export function selectTexts(prefab,config,layers=selectLayers(prefab,config)) {
  if(!config)return [];
  const texts=config.texts||[];
  if(prefab.id==='progress')return texts.filter(text=>/^加载(状态|百分比)$/.test(text.layer_name));
  const textLayers=layers.filter(layer=>layer.type==='text');
  const selectedIds=new Set(textLayers.flatMap(layer=>[layer.id,layer.text_id]).filter(Boolean));
  const names=new Set(textLayers.map(nameOf));
  const hasLayeredText=(config.layers||[]).some(layer=>layer.type==='text');
  if(hasLayeredText)return texts.filter(text=>selectedIds.has(text.id)||selectedIds.has(text.text_id)||(!text.id&&!text.text_id&&names.has(text.layer_name)));
  // Early source configurations store text separately from the layer stream.
  if(['page','dialog'].includes(prefab.category))return texts;
  return texts.filter(text=>layers.some(layer=>centerInside(bounds(text),layerBounds(layer,config))));
}

/** True means an authored sample occupies a slot selected later by assetId. */
export function isDynamicImage(layer,prefab) {
  if(!layer.file||layer.type==='text')return false;
  const metadata=layer.metadata||{},name=nameOf(layer);
  if(metadata.theme||metadata.building||metadata.stage!==undefined)return true;
  if(/^(角色主体|bee_|outfit_|当前晴天围巾|原稿场景角色_|蜂友头像|原生头像)/.test(name))return true;
  if(layer.group==='照片'||/(已收录照片|待收录占位|实景地图缩略图)/.test(name))return true;
  if(['拼块','独立空格','未放整块','已放拼块','棋盘状态'].includes(layer.group))return true;
  return false;
}
