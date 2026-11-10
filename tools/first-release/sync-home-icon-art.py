"""Replace the shared home navigation bitmap in its two visible page PSD layers.
Run after the managed firstrelease generator; preserves all unrelated layers and pages.
"""
from pathlib import Path
import copy,hashlib,json,re,shutil
import numpy as np
from PIL import Image
from psd_tools import PSDImage
from psd_tools.api.layers import PixelLayer,TypeLayer
from psd_text_layers import verify_type_layer
P=Path(__file__).resolve().parents[2];A=P/'arts';OUT=Path('D:/CodexData/Artifacts/HexaPuzzle返回主页图标20261110');OUT.mkdir(parents=True,exist_ok=True)
def read(p):return json.loads(p.read_text(encoding='utf8'))
def dump(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def patch_entries(p,changes,key):
 text=p.read_text(encoding='utf8');decoder=json.JSONDecoder();edits=[];found=set()
 for m in re.finditer(r'(?m)^    \{',text):
  start=m.start()+4;obj,n=decoder.raw_decode(text[start:]);identity=obj.get(key)
  if identity in changes:
   edits.append((start,start+n,json.dumps(changes[identity],ensure_ascii=False,indent=2).replace('\n','\n    ')));found.add(identity)
 assert found==set(changes),(p,found,set(changes))
 for start,end,value in reversed(edits):text=text[:start]+value+text[end:]
 p.write_text(text,encoding='utf8',newline='\n')
def fingerprint(l):return (l.name,l.bbox,l.visible,hashlib.sha256(l.topil().convert('RGBA').tobytes()).hexdigest())
manifest=read(P/'assets/resources/framework/config/source-art-manifest.json');record=next(x for x in manifest['records'] if x['id']=='firstrelease.ui.back');source=P/record['sourceFile'];runtime=P/record['assetPath'];assert sha(source)==sha(runtime)
CAT=A/'游戏素材/素材清单.json';catalog=read(CAT);receipt=A/'补充制作记录/五页首版/PSD回读与合成校验.json';history=read(receipt);untouched_history=copy.deepcopy([p for p in history['pages'] if p['name'] not in ['五页首版_建造','五页首版_拼图']]);report={'status':'PASS','photoshopInteraction':False,'source':record['sourceFile'],'sourceSha256':sha(source),'runtimeSha256':sha(runtime),'size':list(Image.open(source).size),'pages':[]};changed=[source,CAT,receipt,A/'index.html',A/'交付清单与校验.json']
pagechanges={}
for name,layer_name in [('五页首版_建造','HomeBuild/BuildBottom/Back'),('五页首版_拼图','PuzzlePage/Back')]:
 cfg=A/f'游戏素材/页面配置/五页首版/{name}.json';psdpath=A/f'PSD/五页首版/{name}.psd';preview=A/f'页面对照/PSD合成/五页首版/{name}.png';config=read(cfg);specs={x['layer_name']:x for x in config['layers']};spec=copy.deepcopy(specs[layer_name]);psd=PSDImage.open(psdpath);n=len(psd);old=next(l for l in psd if l.name==layer_name);other=[fingerprint(l) for l in psd if l.name!=layer_name];i=psd.index(old);pic=Image.open(source).convert('RGBA').resize((spec['instance']['width'],spec['instance']['height']),Image.Resampling.LANCZOS);x,y=spec['position'];new=PixelLayer.frompil(pic,psd,layer_name,top=y,left=x);psd.remove(new);psd.remove(old);psd.insert(i,new)
 expected=Image.new('RGBA',psd.size)
 for l in psd:
  if l.visible:expected.alpha_composite(l.topil().convert('RGBA'),(l.left,l.top))
 psd.save(psdpath);opened=PSDImage.open(psdpath);assert len(opened)==n;assert [fingerprint(l) for l in opened if l.name!=layer_name]==other,'Unrelated PSD layer changed'
 textchecks=[verify_type_layer(l,specs[l.name]) for l in opened if isinstance(l,TypeLayer)];composite=opened.composite(force=True,apply_icc=False).convert('RGBA');delta=int(np.abs(np.asarray(composite).astype(int)-np.asarray(expected).astype(int)).max());assert delta<=2,(name,delta);composite.save(preview);spec['purpose']='返回主页：珊瑚红立体底板与乳白房子，无箭头或金币；区别底部撤销上一步';spec['source_sha256']=sha(source);patch_entries(cfg,{layer_name:spec},'layer_name')
 page=copy.deepcopy(next(p for p in catalog['pages'] if p['name']==name));page.update(psd_sha256=sha(psdpath),preview_sha256=sha(preview),composite_max_channel_difference=delta,editable_text_checks=textchecks);pagechanges[name]=page
 oldpage=next(p for p in history['pages'] if p['name']==name);oldpage.update(psd_sha256=sha(psdpath),preview_sha256=sha(preview),composite_max_channel_difference=delta,editable_text_checks=textchecks)
 report['pages'].append({'name':name,'modifiedLayer':layer_name,'layerCount':n,'unchangedLayersVerified':len(other),'psd':psdpath.relative_to(A).as_posix(),'psdSha256':sha(psdpath),'preview':preview.relative_to(A).as_posix(),'previewSha256':sha(preview),'compositeMaxChannelDifference':delta,'trueTextLayerChecks':textchecks});changed.extend([cfg,psdpath,preview])
assert [p for p in history['pages'] if p['name'] not in pagechanges]==untouched_history;dump(receipt,history)
entry=copy.deepcopy(next(r for r in catalog['assets'] if r['id']=='firstrelease.ui.back'));entry.update(name='返回主页_珊瑚红小房子',size=record['size'],sha256=sha(source),purpose='拼图和建造返回主页；乳白小房子、珊瑚红底板，无箭头或金币；与撤销区分',pages=list(pagechanges),runtime_pages=list(pagechanges));patch_entries(CAT,{entry['id']:entry},'id');patch_entries(CAT,pagechanges,'name');text=CAT.read_text(encoding='utf8');text=re.sub(r'(?m)^  "revision": "[^"\n]+"','  "revision": "2026-11-10-home-icon"',text,count=1);CAT.write_text(text,encoding='utf8',newline='\n');catalog=read(CAT)
index=A/'index.html';html=index.read_text(encoding='utf8');start=html.index('const DATA=')+len('const DATA=');end=html.index(';\nconst BOARDS=',start);html=html[:start]+json.dumps(catalog,ensure_ascii=False)+html[end:];index.write_text(html,encoding='utf8',newline='\n')
summarypath=A/'交付清单与校验.json';summary=read(summarypath);summary['homeIcon20261110']={'id':entry['id'],'replacedPNGs':1,'visiblePSDReferences':len(pagechanges),'sourceRuntimeShaMatch':True,'pages':report['pages'],'photoshopInteraction':False};dump(summarypath,summary)
prov=A/'游戏素材/页面配置/五页首版/返回主页按钮来源.json';dump(prov,{'date':'2026-11-10','semantics':'Return home, not undo, rotate or reward. Coral beveled button + ivory house; no arrow, coin, text or digits baked in PNG.','asset':entry,'source':record['sourceFile'],'sourceSha256':sha(source),'runtime':record['assetPath'],'runtimeSha256':sha(runtime),'generation':{'method':'imagegen API fallback','model':'gpt-image-2','evidenceDirectory':str(OUT)},'pages':report['pages'],'photoshopInteraction':False,'scope':'Only shared back bitmap and its two visible image layers. Other artwork and true text layers remain unchanged.'});changed.append(prov)
checks_path=A/'文件校验清单.json';checks=read(checks_path);byfile={r['file']:r for r in checks['files']}
for f in changed:
 rel=f.relative_to(A).as_posix();byfile[rel]={'file':rel,'bytes':f.stat().st_size,'sha256':sha(f)}
checks['files']=list(byfile.values());dump(checks_path,checks);dump(OUT/'art-sync-report.json',report);print(json.dumps({'status':report['status'],'pages':len(report['pages']),'unchangedLayers':[r['unchangedLayersVerified'] for r in report['pages']]},ensure_ascii=False))
