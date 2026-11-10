"""Synchronize the three puzzle action images and hint counter into the saved PSD.
Run after firstrelease:generate. Does not rebuild other pages or puzzle geometry.
"""
from pathlib import Path
import json,re,hashlib,copy,shutil
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from psd_tools import PSDImage
from psd_tools.api.layers import PixelLayer,TypeLayer
from psd_text_layers import create_type_layer,render_text_cache,verify_type_layer
P=Path(__file__).resolve().parents[2];A=P/'arts'
OUT=Path('D:/CodexData/Artifacts/HexaPuzzle拼图操作按钮改版20261109');OUT.mkdir(parents=True,exist_ok=True)
PAGE='五页首版_拼图';CFG=A/f'游戏素材/页面配置/五页首版/{PAGE}.json';PSD=A/f'PSD/五页首版/{PAGE}.psd';PREVIEW=A/f'页面对照/PSD合成/五页首版/{PAGE}.png'
def read(p):return json.loads(p.read_text(encoding='utf8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
def patch_entries(p,changes,key):
 text=p.read_text(encoding='utf8');decoder=json.JSONDecoder();edits=[];found=set()
 for m in re.finditer(r'(?m)^    \{',text):
  start=m.start()+4
  obj,n=decoder.raw_decode(text[start:]);identity=obj.get(key)
  if identity in changes:
   edits.append((start,start+n,json.dumps(changes[identity],ensure_ascii=False,indent=2).replace('\n','\n    ')));found.add(identity)
 assert found==set(changes),(p,found,set(changes))
 for start,end,value in reversed(edits):text=text[:start]+value+text[end:]
 p.write_text(text,encoding='utf8',newline='\n')
def replace_layer(psd,old,pic,pos):
 index=psd.index(old);new=PixelLayer.frompil(pic,psd,old.name,top=pos[1],left=pos[0]);psd.remove(new);psd.remove(old);psd.insert(index,new)
def fingerprint(layer):
 pic=layer.topil().convert('RGBA');return (layer.name,tuple(layer.bbox),sha256(pic.tobytes()))
def sha256(b):return hashlib.sha256(b).hexdigest()
config=read(CFG);specs={x['layer_name']:x for x in config['layers']};psd=PSDImage.open(PSD)
owned={'PuzzlePage/Undo','PuzzlePage/Restart','PuzzlePage/Hint','PuzzlePage/Hint/HintCount','PuzzlePage/UndoCaption','PuzzlePage/RestartCaption','PuzzlePage/HintCaption'}
untouched=[fingerprint(l) for l in psd if l.name not in owned];original_count=len(psd);new_caption_count=sum('PuzzlePage/'+n not in specs for n in ['UndoCaption','RestartCaption','HintCaption'])
# Back up before each first invocation, never overwrite the verified original.
for f in [CFG,PSD,PREVIEW,A/'游戏素材/素材清单.json',A/'index.html',A/'文件校验清单.json',A/'交付清单与校验.json']:
 dest=OUT/'before'/f.relative_to(P);dest.parent.mkdir(parents=True,exist_ok=True)
 if not dest.exists():shutil.copy2(f,dest)
prefab=read(P/'assets/resources/first-release/prefabs/PuzzlePage.prefab')
def component(node,type):return next(prefab[c['__id__']] for c in node['_components'] if prefab[c['__id__']]['__type__']==type)
def geometry(name):
 node=next(n for n in prefab if n.get('__type__')=='cc.Node' and n.get('_name')==name);ui=component(node,'cc.UITransform');w=ui['_contentSize']['width'];h=ui['_contentSize']['height'];x=node['_lpos']['x'];y=node['_lpos']['y'];return node,w,h,x,y
updated={}
for name in ['Undo','Restart','Hint']:
 node,w,h,x,y=geometry(name);pos=[round(853/2+x-w/2),round(1844/2-y-h/2)];spec=copy.deepcopy(specs['PuzzlePage/'+name]);pic=Image.open(A/spec['source_file']).convert('RGBA').resize((round(w),round(h)),Image.Resampling.LANCZOS)
 old=next(l for l in psd if l.name==spec['layer_name']);replace_layer(psd,old,pic,pos);spec['position']=pos;spec['instance'].update(width=round(w),height=round(h));updated[spec['layer_name']]=spec
node,w,h,x,y=geometry('HintCount');hint,_,_,hx,hy=geometry('Hint');label=component(node,'cc.Label');cx=853/2+hx+x;cy=1844/2-hy-y;spec=copy.deepcopy(specs['PuzzlePage/Hint/HintCount']);spec.update(font_size=label['_fontSize'],color_rgb=[label['_color'][k] for k in ['r','g','b']],box=[cx-w/2,cy-h/2,cx+w/2,cy+h/2],min_font_size=label['_fontSize'],position=[cx,cy]);cache=render_text_cache(spec);iw,ih=cache['spec']['measured_ink_size'];spec['position']=[cx-iw/2,cy-ih/2];old=next(l for l in psd if l.name==spec['layer_name']);index=psd.index(old);psd.remove(old);created,cache=create_type_layer(psd,spec,index=index);updated[spec['layer_name']]={'kind':'text',**cache['spec']}
captions={}
for name in ['UndoCaption','RestartCaption','HintCaption']:
 node,w,h,x,y=geometry(name);label=component(node,'cc.Label');cx=853/2+x;cy=1844/2-y
 spec={'layer_name':'PuzzlePage/'+name,'text':label['_string'],'position':[cx,cy],'box':[cx-w/2,cy-h/2,cx+w/2,cy+h/2],'font_size':label['_fontSize'],'weight':'bold','align':'center','color_rgb':[label['_color'][k] for k in ['r','g','b']],'stroke_width':0,'stroke_color':[0,0,0],'min_font_size':label['_fontSize'],'max_lines':1,'category':'localized_copy','binding':'puzzle.'+name,'localization_key':'firstrelease.puzzle.'+name.removesuffix('Caption').lower()+'.caption'}
 cache=render_text_cache(spec);iw,ih=cache['spec']['measured_ink_size'];spec['position']=[cx-iw/2,cy-ih/2];existing=next((l for l in psd if l.name==spec['layer_name']),None)
 if existing is not None:psd.remove(existing)
 created,cache=create_type_layer(psd,spec);captions[spec['layer_name']]={'kind':'text',**cache['spec']}
updated.update(captions)
expected=Image.new('RGBA',psd.size)
for l in psd:
 if l.visible:expected.alpha_composite(l.topil().convert('RGBA'),(l.left,l.top))
psd.save(PSD);opened=PSDImage.open(PSD);assert len(opened)==original_count+new_caption_count
assert [fingerprint(l) for l in opened if l.name not in owned]==untouched,'Unrelated saved PSD layer changed'
for l in opened:
 if isinstance(l,TypeLayer):verify_type_layer(l,updated[l.name] if l.name in updated else specs[l.name])
composed=opened.composite(force=True,apply_icc=False).convert('RGBA');diff=int(np.abs(np.asarray(composed).astype(int)-np.asarray(expected).astype(int)).max());assert diff<=2,('PSD composite',diff);composed.save(PREVIEW);patch_entries(CFG,{k:v for k,v in updated.items() if k in specs},'layer_name')
text=CFG.read_text(encoding='utf8');start=text.index('  "layers": [');end=text.index('\n  ],',start)
for spec in [v for k,v in captions.items() if k not in specs]:
 value=',\n    '+json.dumps(spec,ensure_ascii=False,indent=2).replace('\n','\n    ');text=text[:end]+value+text[end:];end+=len(value)
CFG.write_text(text,encoding='utf8',newline='\n')
# Targeted catalog/index updates retain existing records, ordering and geometric floats.
catpath=A/'游戏素材/素材清单.json';cat=read(catpath);manifest=read(P/'assets/resources/framework/config/source-art-manifest.json');registered={r['id']:r for r in manifest['records']}
asset_changes={}
for id in ['firstrelease.ui.undo','firstrelease.ui.restart','firstrelease.ui.hint']:
 entry=copy.deepcopy(next(r for r in cat['assets'] if r['id']==id));rec=registered[id];entry.update(sha256=sha(P/rec['sourceFile']),size=rec['size'],purpose={'firstrelease.ui.undo':'撤销上一步：大号左回退箭头','firstrelease.ui.restart':'重玩本关：循环箭头包围六边形棋块，非旋转','firstrelease.ui.hint':'提示落点：放大镜查看六边形棋块'}[id]);asset_changes[id]=entry
patch_entries(catpath,asset_changes,'id')
cat=read(catpath);reward=registered['firstrelease.reward.hint'];entry={'id':reward['id'],'name':'欢迎奖励提示道具灯泡','file':reward['sourceFile'].removeprefix('arts/游戏素材/'),'size':reward['size'],'category':'公共UI','subtype':'UI','pages':['五页首版_拼图'],'runtime_pages':['欢迎奖励弹窗'],'purpose':'保留原欢迎奖励灯泡；与新放大镜提示操作按钮独立','sha256':sha(P/reward['sourceFile']),'identities':[reward['id']],'source':reward['sourceFile']}
if any(x['id']==entry['id'] for x in cat['assets']):patch_entries(catpath,{entry['id']:entry},'id')
else:
 text=catpath.read_text(encoding='utf8');start=text.index('  "assets": [');end=text.index('\n  ],',start);text=text[:end]+',\n    '+json.dumps(entry,ensure_ascii=False,indent=2).replace('\n','\n    ')+text[end:];text=re.sub(r'"asset_count": \d+',f'"asset_count": {len(cat["assets"])+1}',text,count=1);catpath.write_text(text,encoding='utf8',newline='\n')
cat=read(catpath);page=copy.deepcopy(next(p for p in cat['pages'] if p['name']==PAGE));page['text_count']=sum(isinstance(l,TypeLayer) for l in opened);page['layer_count']=len(opened);page['editable_text_checks']=[verify_type_layer(l,updated[l.name] if l.name in updated else specs[l.name]) for l in opened if isinstance(l,TypeLayer)];page.update(psd_sha256=sha(PSD),preview_sha256=sha(PREVIEW),composite_max_channel_difference=diff);patch_entries(catpath,{PAGE:page},'name');cat=read(catpath)
text=catpath.read_text(encoding='utf8');text=re.sub(r'(?m)^  "text_count": \d+',f'  "text_count": {sum(p.get("text_count",0) for p in cat["pages"])}',text,count=1);catpath.write_text(text,encoding='utf8',newline='\n');cat=read(catpath)
index=A/'index.html';html=index.read_text(encoding='utf8');start=html.index('const DATA=')+len('const DATA=');end=html.index(';\nconst BOARDS=',start);html=html[:start]+json.dumps(cat,ensure_ascii=False)+html[end:];index.write_text(html,encoding='utf8',newline='\n')
# Update historic current-page receipt, keeping its other page evidence unchanged.
receipt=A/'补充制作记录/五页首版/PSD回读与合成校验.json';history=read(receipt);oldpage=next(p for p in history['pages'] if p['name']==PAGE);oldpage.update(text_count=page['text_count'],layer_count=len(opened),psd_sha256=sha(PSD),preview_sha256=sha(PREVIEW),composite_max_channel_difference=diff,editable_text_checks=page['editable_text_checks']);dump(receipt,history)
summarypath=A/'交付清单与校验.json';summary=read(summarypath);summary['asset_count']=cat['asset_count'];summary['editable_text_count']=cat['text_count'];summary['puzzleActionButtons20261109']={'replaced':['firstrelease.ui.undo','firstrelease.ui.restart','firstrelease.ui.hint'],'separateRewardIcon':'firstrelease.reward.hint','pagePSD':str(PSD.relative_to(A)).replace('\\','/'),'modifiedLayers':sorted(owned),'unchangedLayersVerified':len(untouched),'psdRoundTripCompositeMaxDifference':diff,'photoshopInteraction':False};dump(summarypath,summary)
checks_path=A/'文件校验清单.json';checks=read(checks_path);byfile={r['file']:r for r in checks['files']};changed=[CFG,PSD,PREVIEW,catpath,index,receipt,summarypath]+[P/registered[id]['sourceFile'] for id in list(asset_changes)+['firstrelease.reward.hint']]
for f in changed:
 relative=f.relative_to(A).as_posix();byfile[relative]={'file':relative,'bytes':f.stat().st_size,'sha256':sha(f)}
checks['files']=list(byfile.values());dump(checks_path,checks)
report={'status':'PASS','page':PAGE,'psd_sha256':sha(PSD),'preview_sha256':sha(PREVIEW),'modifiedLayers':sorted(owned),'unchangedLayersVerified':len(untouched),'trueTextLayerChecks':oldpage['editable_text_checks'],'compositeMaxChannelDifference':diff,'photoshopInteraction':False,'configRuntimeAndUniqueSourcesUpdated':True}
dump(OUT/'art-sync-report.json',report);print(json.dumps({'status':'PASS','unchangedLayers':len(untouched),'compositeMaxDifference':diff,'output':str(PREVIEW)},ensure_ascii=False))
