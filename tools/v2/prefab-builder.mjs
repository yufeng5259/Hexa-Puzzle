import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PROJECT } from './env.mjs';
import { stableUuid } from './import-art.mjs';
const sha256 = v => createHash('sha256').update(v).digest('hex');

export const ref = id => ({ __id__: id });
export const external = (uuid, type) => ({ __uuid__: uuid, __expectedType__: type });
export const color = (rgb = [255,255,255], a = 255) => ({ __type__: 'cc.Color', r:rgb[0],g:rgb[1],b:rgb[2],a });
export function scriptType(file) {
  // The live editor may import a new hand-authored component before generation.
  // Serialize its existing identity rather than replacing a valid script UUID.
  const meta=path.join(PROJECT,file+'.meta');
  const uuid=fs.existsSync(meta)?JSON.parse(fs.readFileSync(meta,'utf8')).uuid:stableUuid(file);
  const hex = uuid.replaceAll('-', '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = hex.slice(0,5);
  for(let i=5;i<32;i+=3){const value=parseInt(hex.slice(i,i+3),16);result+=alphabet[value>>6]+alphabet[value&63];}
  return result;
}
export class Builder {
  constructor(name, size = [853,1844]) {
    this.name=name;this.size=size;
    this.objects=[{__type__:'cc.Prefab',_name:name,_objFlags:0,__editorExtras__:{},_native:'',data:ref(1),optimizationPolicy:0,asyncLoadAssets:false,persistent:false}];
    this.root=this.node(name,null,{width:size[0],height:size[1]});
  }
  node(name,parent=this.root,box={},active=true) {
    const id=this.objects.length;
    this.objects.push({__type__:'cc.Node',_name:name,_objFlags:0,__editorExtras__:{},_parent:parent===null?null:ref(parent),_children:[],_active:active,_components:[],_prefab:null,
      _lpos:{__type__:'cc.Vec3',x:box.x||0,y:box.y||0,z:0},_lrot:{__type__:'cc.Quat',x:0,y:0,z:0,w:1},_lscale:{__type__:'cc.Vec3',x:1,y:1,z:1},_mobility:0,_layer:33554432,_euler:{__type__:'cc.Vec3',x:0,y:0,z:0},_id:''});
    if(parent!==null)this.objects[parent]._children.push(ref(id));
    this.component(id,'cc.UITransform',{_contentSize:{__type__:'cc.Size',width:box.width??100,height:box.height??100},_anchorPoint:{__type__:'cc.Vec2',x:box.anchorX??.5,y:box.anchorY??.5},_priority:0});
    return id;
  }
  component(node,type,fields={}) {
    const id=this.objects.length;
    this.objects.push({__type__:type,_name:'',_objFlags:0,__editorExtras__:{},node:ref(node),_enabled:true,__prefab:null,...fields});
    this.objects[node]._components.push(ref(id)); return id;
  }
  sprite(node,frame=null,opacity=1) {
    const id=this.component(node,'cc.Sprite',{_customMaterial:null,_visFlags:0,_srcBlendFactor:2,_dstBlendFactor:4,_color:color(),_spriteFrame:frame?external(frame,'cc.SpriteFrame'):null,_type:0,_fillType:0,_sizeMode:0,_fillCenter:{__type__:'cc.Vec2',x:0,y:0},_fillStart:0,_fillRange:1,_isTrimmedMode:false,_useGrayscale:false,_atlas:null});
    if(opacity!==1)this.component(node,'cc.UIOpacity',{_opacity:Math.round(opacity*255)});
    return id;
  }
  label(node,text='',style={}) {
    const size=style.font_size??28;
    return this.component(node,'cc.Label',{_customMaterial:null,_visFlags:0,_srcBlendFactor:2,_dstBlendFactor:4,_color:color(style.color_rgb??[74,49,25]),_string:String(text).replace(/\r\n?/g,'\n'),_horizontalAlign:({left:0,center:1,right:2})[style.align??'center'],_verticalAlign:1,_actualFontSize:size,_fontSize:size,_fontFamily:'Microsoft YaHei',_lineHeight:style.line_height??Math.round(size*1.2),_overflow:1,_enableWrapText:(style.max_lines??1)>1,_font:null,_isSystemFontUsed:true,_spacingX:0,_isItalic:false,_isBold:style.weight==='bold',_isUnderline:false,_underlineHeight:0,_cacheMode:0,_enableOutline:!!style.stroke_width,_outlineColor:color(style.stroke_color),_outlineWidth:style.stroke_width??0,_enableShadow:false,_shadowColor:color([0,0,0]),_shadowOffset:{__type__:'cc.Vec2',x:0,y:0},_shadowBlur:0});
  }
  button(node,target,componentName,handler='onAction',data='') {
    return this.component(node,'cc.Button',{interactable:true,_transition:0,_normalColor:color(),_pressedColor:color(),_hoverColor:color(),_disabledColor:color([155,155,155]),_duration:.1,_zoomScale:.97,_target:ref(node),clickEvents:[{__type__:'cc.ClickEvent',target:ref(target),component:componentName,_componentId:'',handler,customEventData:data}]});
  }
  finish() {
    const count=this.objects.length;
    for(let i=1;i<count;i++){
      const object=this.objects[i],fileId=sha256(this.name+':'+i).slice(0,22);
      if(object.__type__==='cc.Node'){object._prefab=ref(this.objects.length);this.objects.push({__type__:'cc.PrefabInfo',root:ref(this.root),asset:ref(0),fileId,instance:null,targetOverrides:null,nestedPrefabInstanceRoots:null});}
      else if(object.node){object.__prefab=ref(this.objects.length);this.objects.push({__type__:'cc.CompPrefabInfo',fileId});}
    }
    return this.objects;
  }
}
