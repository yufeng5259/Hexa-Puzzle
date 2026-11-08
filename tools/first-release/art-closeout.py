from pathlib import Path
import json,copy,hashlib,re,shutil,sys
from PIL import Image,ImageDraw,ImageFont,ImageChops
import numpy as np
from psd_tools import PSDImage
from psd_tools.api.layers import PixelLayer,TypeLayer
from psd_text_layers import create_type_layer,render_text_cache,verify_type_layer
P=Path(__file__).resolve().parents[2];A=P/'arts';W,H=853,1844
OUT=A/'PSD/五页首版';OUT.mkdir(parents=True,exist_ok=True)
CFG=A/'游戏素材/页面配置/五页首版';CFG.mkdir(parents=True,exist_ok=True)
CMP=A/'页面对照/PSD合成/五页首版';CMP.mkdir(parents=True,exist_ok=True)
ORIG=A/'页面对照/原页面/五页首版';ORIG.mkdir(parents=True,exist_ok=True)
NOTE=A/'补充制作记录/五页首版';NOTE.mkdir(parents=True,exist_ok=True)
def read(f):return json.loads(Path(f).read_text(encoding='utf8'))
def dump(f,v):Path(f).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def rel(p):return Path(p).relative_to(A).as_posix()
manifest=read(P/'assets/resources/framework/config/source-art-manifest.json');addition=read(P/'assets/resources/first-release/art-additions.json')
records={x['id']:x for x in manifest['records']+manifest['derivatives']+addition['records']};frames={x['spriteFrameUuid']:x for x in records.values()};aliases=addition['aliases']
catalog_sources={a['id']:'游戏素材/'+a['file'] for a in read(A/'游戏素材/素材清单.json')['assets']}
def record(id):return records[aliases.get(id,id)]
tables=read(P/'assets/resources/config/game-config.json')['tables']
def rows(t):return [dict(zip(tables[t]['keys'],v)) for k,v in tables[t].items() if k!='keys']
def comp(o,n,t):return next((o[c['__id__']] for c in n['_components'] if o[c['__id__']]['__type__']==t),None)
def node(o,c):return o[c['node']['__id__']]
def settext(o,c,text):o[c['__id__']]['_string']=text

def home(build=False):
 o=read(P/'assets/resources/first-release/prefabs/HomeBuild.prefab');v=next(c for c in o if 'mapRoot' in c)
 for key,on in [('homeBottom',not build),('buildBottom',build),('upgradeRoot',build)]:o[v[key]['__id__']]['_active']=on
 node(o,o[v['mapNameLabel']['__id__']])['_active']=build
 for key,s in [('coinLabel','60'),('levelLabel','2'),('progressLabel','1/25'),('mapNameLabel','向阳蜂谷')]:settext(o,v[key],s)
 o[v['progressFill']['__id__']]['_lscale']['x']=1/25
 slots=rows('MapBuildings');stages=rows('BuildingStages')
 for i,slot in enumerate(slots):
  stage=1 if i==0 else 0;sc=o[v['buildingSprites'][i]['__id__']];n=node(o,sc);n['_lpos'].update(x=slot['x'],y=slot['y']);n['_lscale'].update(x=slot['scale'],y=slot['scale']);comp(o,n,'cc.UITransform')['_anchorPoint'].update(x=slot['anchorX'],y=slot['anchorY'])
  rec=next(r for r in stages if r['buildingId']==slot['buildingId'] and r['stage']==stage);sc['_spriteFrame']={'__uuid__':record(rec['bodyAssetId'])['spriteFrameUuid']}
  btn=o[v['upgradeButtons'][i]['__id__']];node(o,btn)['_lpos'].update(x=slot['x']+slot['upgradeOffsetX'],y=slot['y']+slot['upgradeOffsetY'])
  nextrec=next(r for r in stages if r['buildingId']==slot['buildingId'] and r['stage']==stage+1);settext(o,v['costLabels'][i],str(nextrec['cost']))
  for j in range(5):o[v['stageSprites'][i*5+j]['__id__']]['_spriteFrame']={'__uuid__':record('firstrelease.ui.stage-green' if j<stage else 'firstrelease.ui.stage-gray')['spriteFrameUuid']}
 return o

def loading():
 o=read(P/'assets/resources/first-release/prefabs/Loading.prefab');next(c for c in o if c['__type__']=='cc.Label' and c['_string']=='0%')['_string']='100%';return o

def settings():
 o=read(P/'assets/resources/first-release/prefabs/Dialog.prefab');v=next(c for c in o if 'titleLabel' in c)
 for k,s in [('titleLabel','设置'),('bodyLabel',''),('primaryLabel','确定')]:settext(o,v[k],s)
 node(o,o[v['secondaryButton']['__id__']])['_active']=False;o[v['settingsRoot']['__id__']]['_active']=True
 for i,s in enumerate(['开启','开启','开启','简体中文']):settext(o,v['settingLabels'][i],s)
 return o

def render(o,page,prefix=''):
 result=[]
 def walk(idx,x=0,y=0,sx=1,sy=1,alpha=1,hierarchy=''):
  n=o[idx]
  if not n.get('_active',True):return
  p=n['_lpos'];sc=n['_lscale'];x+=p['x']*sx;y+=p['y']*sy;sx*=sc['x'];sy*=sc['y'];ui=comp(o,n,'cc.UITransform');opacity=comp(o,n,'cc.UIOpacity');alpha*=opacity['_opacity']/255 if opacity else 1
  if ui:
   size=ui['_contentSize'];anchor=ui['_anchorPoint'];ww=max(1,round(size['width']*sx));hh=max(1,round(size['height']*sy));left=round(W/2+x-ww*anchor['x']);top=round(H/2-y-hh*(1-anchor['y']))
   sp=comp(o,n,'cc.Sprite');lb=comp(o,n,'cc.Label');name=prefix+hierarchy+n['_name']
   graphics=comp(o,n,'cc.Graphics')
   if not sp and graphics and n['_name']=='Shade':sp={'_color':graphics['_fillColor'],'_spriteFrame':None}
   if sp:
    col=sp['_color'];a=alpha*col.get('a',255)/255;fr=sp.get('_spriteFrame');rec=frames[fr['__uuid__']] if fr else None
    if rec:
     pic=Image.open(P/rec['assetPath']).convert('RGBA').resize((ww,hh),Image.Resampling.LANCZOS);rgba=np.array(pic).astype(np.float32);rgba[:,:,:3]*=np.array([col['r'],col['g'],col['b']])/255;rgba[:,:,3]*=a;pic=Image.fromarray(rgba.astype('uint8'))
    else:pic=Image.new('RGBA',(ww,hh),(col['r'],col['g'],col['b'],round(a*255)))
    # Crop off-canvas pixels, preserving their actual composition and origin.
    box=(max(0,-left),max(0,-top),min(ww,W-left),min(hh,H-top))
    if box[2]>box[0] and box[3]>box[1]:
     pic=pic.crop(box);left+=box[0];top+=box[1];result.append({'kind':'image','layer_name':name,'image':pic,'position':[left,top],'asset_id':rec['id'] if rec else None,'source_file':catalog_sources.get(rec['id'],rec.get('sourceFile',rec['assetPath']).removeprefix('arts/')) if rec else None,'instance':{'width':ww,'height':hh,'rgba':col,'opacity':alpha}})
   elif lb and lb.get('_string'):
    text=lb['_string'];size=lb['_fontSize']*sy;font=ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc',round(size));measure=ImageDraw.Draw(Image.new('RGBA',(1,1)));bb=measure.multiline_textbbox((0,0),text,font=font,spacing=round(size*.18));tw=bb[2]-bb[0];th=bb[3]-bb[1];inkx=left+(ww-tw)/2;inky=top+(hh-th)/2;col=lb['_color']
    spec={'layer_name':name,'text':text,'position':[inkx,inky],'box':[left,top,left+ww,top+hh],'font_size':size,'weight':'bold','align':'center','color_rgb':[col['r'],col['g'],col['b']],'font_file':'msyhbd.ttc','postscript_font':'MicrosoftYaHei-Bold','stroke_width':0,'stroke_color':[0,0,0],'min_font_size':max(12,size*.65),'max_lines':8,'category':'localized_copy' if any('\u4e00'<=c<='\u9fff' for c in text) or text.isalpha() else 'runtime_value','binding':page+'.'+n['_name'],'localization_key':'firstrelease.'+n['_name'] if not text.isnumeric() else None}
    result.append({'kind':'text','layer_name':name,'spec':spec})
  for child in n['_children']:walk(child['__id__'],x,y,sx,sy,alpha,hierarchy+n['_name']+'/')
 walk(1);return result

def export(name,original,layers):
 psd=PSDImage.new('RGBA',(W,H),color=(0,0,0,0));expected=Image.new('RGBA',(W,H));cfg=[];textspecs={};images=0
 for layer in layers:
  if layer['kind']=='image':
   pic=layer['image'];pos=layer['position'];PixelLayer.frompil(pic,psd,layer['layer_name'],top=pos[1],left=pos[0]);expected.alpha_composite(pic,tuple(pos));cfg.append({k:v for k,v in layer.items() if k!='image'});images+=1
  else:
   spec=layer['spec'];cache=render_text_cache(spec);created,cache=create_type_layer(psd,spec,cache=cache);textspecs[layer['layer_name']]=cache['spec'];expected.alpha_composite(cache['image'],cache['offset']);cfg.append({'kind':'text',**cache['spec']})
 file=OUT/(name+'.psd');psd.save(file);opened=PSDImage.open(file);checks=[verify_type_layer(l,textspecs[l.name]) for l in opened if isinstance(l,TypeLayer)]
 composed=opened.composite(force=True,apply_icc=False).convert('RGBA');diff=np.abs(np.array(composed).astype(int)-np.array(expected).astype(int));maximum=int(diff.max());assert maximum<=2,(name,maximum)
 png=CMP/(name+'.png');composed.save(png);orig=ORIG/original;shutil.copy2(A/'效果预览/效果图v2'/original,orig)
 config=CFG/(name+'.json');dump(config,{'name':name,'canvas':[W,H],'source':'Actual first-release Prefab + current config snapshot, not screenshot flattening','snapshot':{'coins':60,'currentLevelNo':2,'buildingStages':[1,0,0,0,0],'progress':'1/25'},'layers':cfg,'limitations':['Existing native stage buildings differ from v2 illustrated building shapes.','Canvas composition is standard 853x1844; actual Creator viewport tests are separate.']})
 return {'name':name,'size':[W,H],'psd':rel(file),'config':rel(config),'preview':rel(png),'asset_ids':sorted(set(l.get('asset_id') for l in layers if l.get('asset_id'))),'text_count':len(checks),'image_layer_count':images,'layer_count':len(layers),'comparison':{'original':rel(orig),'original_label':'v2页面效果设计图','original_size':[W,H],'psd_composite':rel(png)},'psd_sha256':sha(file),'preview_sha256':sha(png),'original_sha256':sha(orig),'editable_text_checks':checks,'composite_max_channel_difference':maximum,'status':'Prefab-derived implementation composition; visual differences explicitly retained'}

def puzzle_layers():
 source=P.parent/'tmp/prototype/first-release/art-puzzle/geometry.json'
 if not source.exists():source=CFG/'拼图参数化组件.json'
 g=read(source)
 assert sha(P/g['source_prefab'])==g['source_prefab_sha256'],'Puzzle geometry export is stale'
 for l in g['layers']:
  l['source_file']=catalog_sources.get(l['asset_id'],l['source_file'])
 for shape in g['geometry']:
  if shape['texture']:shape['texture']['source_file']=catalog_sources.get(shape['texture']['asset_id'],shape['texture']['source_file'])
 dump(CFG/'拼图参数化组件.json',g)
 o=read(P/g['source_prefab'])
 for n in o:
  if n.get('__type__')=='cc.Node' and n.get('_name') in g['exclude_static_subtrees']:n['_active']=False
  elif n.get('__type__')=='cc.Label':
   n['_string']=g['text_overrides'].get(node(o,n)['_name'],n['_string'])
 static=render(o,'puzzle');geometry=[]
 # Rasterize only parameterized component layers, preserving their independent PSD identity.
 for shape in g['geometry']:
  factor=3;canvas=Image.new('RGBA',(W*factor,H*factor));draw=ImageDraw.Draw(canvas);r=shape['render']
  points=lambda ring,dy=0:[(round(x*factor),round((y+dy)*factor)) for x,y in ring]
  if shape['role']=='floor':
   mask=Image.new('L',canvas.size);md=ImageDraw.Draw(mask)
   for ring in shape['cell_polygons']:md.polygon(points(ring),fill=255)
   tex=Image.open(P/shape['texture']['assetPath']).convert('RGBA');tile=tex.resize((tex.width*factor,tex.height*factor),Image.Resampling.NEAREST);ox,oy,_,_=shape['page_box']
   for yy in range(round(oy*factor),H*factor,tile.height):
    for xx in range(round(ox*factor),W*factor,tile.width):canvas.alpha_composite(tile,(xx,yy))
   canvas.putalpha(mask)
  elif shape['role']=='shadow':
   for ring in shape['cell_polygons']:draw.polygon(points(ring,r['page_shift_y']),fill=tuple(r['fill_rgba']))
   for ring in shape['boundary_polygons']:
    pp=points(ring,r['page_shift_y']);draw.line(pp+[pp[0]],fill=tuple(r['stroke_rgba']),width=round(r['stroke_width']*factor),joint='curve')
  else:
   for stroke in r['strokes']:
    for ring in shape['boundary_polygons']:
     pp=points(ring);draw.line(pp+[pp[0]],fill=tuple(stroke['rgba']),width=round(stroke['width']*factor),joint='curve')
  canvas=canvas.resize((W,H),Image.Resampling.LANCZOS);box=canvas.getbbox();texture=shape['texture'];geometry.append({'kind':'image','layer_name':shape['layer_name'],'image':canvas.crop(box),'position':list(box[:2]),'asset_id':texture['asset_id'] if texture else None,'source_file':texture['source_file'] if texture else None,'parameterized_renderer':shape})
 cell_layers=[]
 for l in g['layers']:
  im=Image.open(P/l['assetPath']).convert('RGBA').resize(tuple(round(v) for v in l['size']),Image.Resampling.LANCZOS)
  if l.get('grayscale',False):
   alpha=im.getchannel('A');im=im.convert('L').convert('RGBA');im.putalpha(alpha)
  cell_layers.append({'kind':'image','layer_name':l['layer_name'],'image':im,'position':[round(v) for v in l['position']],'asset_id':l['asset_id'],'source_file':l['source_file'],'axial':l['axial'],'instance':{'size':l['size'],'grayscale':l.get('grayscale',False)}})
 at=next(i for i,l in enumerate(static) if 'TrayPanel' in l['layer_name'])
 return static[:at]+geometry+[l for l in cell_layers if '/Board/' in l['layer_name']]+static[at:]+[l for l in cell_layers if '/Board/' not in l['layer_name']]

partial='--puzzle-only' in sys.argv or '--settings-only' in sys.argv
pages=read(NOTE/'PSD回读与合成校验.json')['pages'] if partial else []
if not partial:
 for name,original,layers in [('五页首版_Loading','01_Loading.png',render(loading(),'loading')),('五页首版_主页','02_主页.png',render(home(),'home')),('五页首版_建造','03_建造页面.png',render(home(True),'build')),('五页首版_设置','06_设置.png',render(home(),'home','Home/')+render(settings(),'settings','Settings/'))]:
  print('Exporting',name,flush=True);pages.append(export(name,original,layers))
if '--settings-only' in sys.argv:
 pages=[p for p in pages if p['name']!='五页首版_设置'];pages.append(export('五页首版_设置','06_设置.png',render(home(),'home','Home/')+render(settings(),'settings','Settings/')))
if '--settings-only' not in sys.argv and ((P.parent/'tmp/prototype/first-release/art-puzzle/geometry.json').exists() or (CFG/'拼图参数化组件.json').exists()):
 pages=[p for p in pages if p['name']!='五页首版_拼图'];pages.append(export('五页首版_拼图','04_拼图玩法.png',puzzle_layers()))
dump(NOTE/'PSD回读与合成校验.json',{'pages':pages,'puzzle':'19 board cells + 18 piece cells + separate floor/rim/shadow parameterized layers; no screenshots used.','photoshop_ui_executed':False,'text_helper':{'source':'D:/CodexData/Temp/BigHero补给站对齐20261107/candidate/执行工具/psd_text_layers.py','target':'tools/first-release/psd_text_layers.py','sha256':sha(Path(__file__).with_name('psd_text_layers.py'))}})
# Register every new unique PNG and actual PSD page in the authoritative portable index.
catalog=A/'游戏素材/素材清单.json';data=read(catalog);ids={a['id'] for a in data['assets']}
for r in addition['records']:
 source=r['sourceFile'].removeprefix('arts/');path=A/source;file=source.removeprefix('游戏素材/');public='/公共UI/' in source;assigned=['五页首版_主页','五页首版_建造','五页首版_设置'] if public or r['id']=='garden1.background' else ['五页首版_Loading'] if 'loading' in r['id'] else ['五页首版_拼图'] if '.puzzle.' in r['id'] or any(k in r['id'] for k in ['undo','restart','hint']) else ['五页首版_主页'] if r['id'].endswith('.play') else ['五页首版_建造']
 entry={'id':r['id'],'name':r['name'],'file':file,'size':r['size'],'category':'公共UI' if public else '公共素材' if r['id']=='garden1.background' else '页面素材','subtype':'背景' if 'background' in r['id'] else 'UI','pages':assigned,'runtime_pages':assigned,'purpose':'五页首版运行素材，来源及变换见补充制作记录/五页首版','sha256':sha(path),'identities':[r['id']],'source':r['sourceFile']}
 existing=next((i for i,a in enumerate(data['assets']) if a['id']==r['id']),None)
 if existing is None:data['assets'].append(entry)
 else:data['assets'][existing]=entry
for page in pages:
 data['pages']=[p for p in data['pages'] if p['name']!=page['name']];data['pages'].append(page)
data['asset_count']=len(data['assets']);data['revision']='2026-11-08-firstrelease';data['text_count']=sum(p.get('text_count',0) for p in data['pages']);dump(catalog,data)
index=A/'index.html';html=index.read_text(encoding='utf8');start=html.index('const DATA=')+len('const DATA=');end=html.index(';\nconst BOARDS=',start);html=html[:start]+json.dumps(data,ensure_ascii=False)+html[end:];marker='<a href="补充制作记录/五页首版/交付状态.md">五页首版：素材与PSD范围</a>'
if marker not in html:html=html.replace('<a href="使用说明.md">使用说明</a>','<a href="使用说明.md">使用说明</a>'+marker)
index.write_text(html,encoding='utf8',newline='\n');dump(NOTE/'新增素材清单与校验.json',{'records':addition['records'],'pages':[{'name':p['name'],'psd':p['psd'],'psd_sha256':p['psd_sha256'],'preview':p['preview'],'preview_sha256':p['preview_sha256']} for p in pages]})
print(json.dumps({'pages':len(pages),'texts':sum(p['text_count'] for p in pages),'newPNGs':len(addition['records'])}))
