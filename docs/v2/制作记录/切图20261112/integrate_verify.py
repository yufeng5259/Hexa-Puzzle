"""Integrate P0 ownership manifests and reproduce section 7 verification evidence.
Run from any directory with Python 3 + Pillow. Never writes runtime assets.
"""
from pathlib import Path
import json,hashlib,math,re,subprocess
from PIL import Image,ImageDraw,ImageFont
REC=Path(__file__).resolve().parent
V2=REC.parents[1]; A=V2/'素材'; CHECK=REC/'对照'; CHECK.mkdir(exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
items=[]
for lane in ['common','icons','hud_puzzle','backgrounds','logo_fx']:items+=load(REC/lane/'manifest.json')
assert len({x['id'] for x in items})==len(items)
lookup={p:x for x in items for p in x['states'].values()}
errors=[]; files=[]
for a in items:
 sizes=[]
 for state,path in a['states'].items():
  p=A/path; assert p.is_file(),path
  im=Image.open(p);sizes.append(im.size);assert im.mode=='RGBA',(path,im.mode)
  assert list(im.size)==a['size'],(path,im.size,a['size'])
  assert sha(p)==a['sha256'][state],path
  if not a.get('opaque') and a['id']!='mask_black':
   al=im.getchannel('A');bb=al.getbbox();assert bb and bb[0]>=2 and bb[1]>=2 and bb[2]<=im.width-2 and bb[3]<=im.height-2,(path,bb)
  if a.get('slice'):
   l,t,r,b=a['slice'];assert l+r<im.width and t+b<im.height,(path,a['slice'])
  files.append(path)
 assert len(set(sizes))==1,a['id']
actual={p.relative_to(A).as_posix() for folder in ['UI','背景'] for p in (A/folder).rglob('*.png')}
assert actual==set(files),('unlisted',actual-set(files),'missing',set(files)-actual)
manifest=load(V2/'美术交付清单.json');manifest['uiAssets']=items
layouts=[]
for p in sorted((A/'布局').glob('S*.json')):
 j=load(p);assert sha(V2/j['reference'])==j['referenceSha256']
 for e in j['elements']:
  if 'asset' in e: assert (A/e['asset']).is_file(),(j['page'],e['asset'])
 layouts.append({'id':j['page'],'file':p.relative_to(V2).as_posix(),'sha256':sha(p),'priority':j['priority'],'deferredElements':j.get('deferredElements',[])})
manifest['uiLayouts']=layouts
manifest['counts']['p0UiAssetGroups']=len(items);manifest['counts']['p0UiPngs']=len(files);manifest['counts']['p0Layouts']=4
manifest['uiDelivery']={'batch':'P0','date':'2026-11-12','runtimeModified':False,'verification':'制作记录/切图20261112/verification.json','comparisons':'制作记录/切图20261112/对照/','notes':['S17为第7节附加对照布局，签到格与角色按P1清单保留deferredElements，未伪造交付。','背景允许不透明；4x4黑遮罩按规范保持实色。','P0包含4.10静态特效，序列补充仍属后续批次。']}
save(V2/'美术交付清单.json',manifest)
def nine(im,size,s):
 if not s:return im.resize(size,Image.Resampling.LANCZOS)
 l,t,r,b=s;w,h=im.size;W,H=size
 # preserve caps; scale down caps only when target is smaller than their sum
 if W<=l+r or H<=t+b:return im.resize(size,Image.Resampling.LANCZOS)
 xs=[0,l,w-r,w];ys=[0,t,h-b,h];X=[0,l,W-r,W];Y=[0,t,H-b,H]
 out=Image.new('RGBA',size)
 for y in range(3):
  for x in range(3):
   if X[x+1]>X[x] and Y[y+1]>Y[y]:out.paste(im.crop((xs[x],ys[y],xs[x+1],ys[y+1])).resize((X[x+1]-X[x],Y[y+1]-Y[y]),Image.Resampling.LANCZOS),(X[x],Y[y]))
 return out
cache={}
def render(sid, exclude=()):
 key=(sid,tuple(exclude))
 if key in cache:return cache[key].copy()
 j=load(A/'布局'/f'{sid}.json');im=render(j['underlay'],j.get('underlayExcludeIds',[])) if j.get('underlay') else Image.new('RGBA',tuple(j['size']),(14,42,92,255))
 for e in j['elements']:
  if e['id'] in exclude:continue
  if 'rect' in e:x,y,w,h=e['rect']
  elif e.get('anchor')=='building_feet':
   fx,fy=j['anchorContext'][e['buildingId']]['feet'];dx,dy=e['offset'];w,h=e['size'];x,y=round(fx+dx-w/2),round(fy+dy-h/2)
  else:raise ValueError(e)
  x,y,w,h=map(round,(x,y,w,h))
  if 'asset' in e:
   source=Image.open(A/e['asset']).convert('RGBA');a=lookup.get(e['asset'],{});pic=nine(source,(w,h),a.get('slice') if e.get('slice') else None)
   if 'opacity' in e:pic.putalpha(pic.getchannel('A').point(lambda z:round(z*e['opacity'])))
   im.alpha_composite(pic,(x,y))
  elif e.get('type')=='label':
   font=ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc' if e.get('bold') else 'C:/Windows/Fonts/msyh.ttc',e['fontSize']);d=ImageDraw.Draw(im)
   sw=e.get('outlineWidth',0);sw=round(sw) if isinstance(sw,(int,float)) else 0
   d.text((x+w/2,y+h/2),e.get('text',''),font=font,fill=e.get('color','#ffffff'),anchor='mm',stroke_width=sw,stroke_fill=e.get('outlineColor','#0E2A5C'))
 cache[key]=im.copy();return im
for sid in ['S02','S03','S04','S06','S17']:
 j=load(A/'布局'/f'{sid}.json');ref=Image.open(V2/j['reference']).convert('RGB');new=render(sid).convert('RGB');new.save(CHECK/f'{sid}_切图合成.png')
 sheet=Image.new('RGB',(1708,1922),'#152748');sheet.paste(ref,(0,80));sheet.paste(new,(854,80));d=ImageDraw.Draw(sheet);f=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',24)
 d.text((20,12),sid+' 原效果图',font=f,fill='white');d.text((874,12),'P0切图+布局（P1角色/签到格待交付）',font=f,fill='white');sheet.save(CHECK/f'{sid}_原图对照.jpg',quality=94)
 # technical reconstruction cannot establish full visual signoff where P1 content is absent
save(REC/'verification.json',{'batch':'P0','uiAssetGroups':len(items),'pngFiles':len(files),'layouts':len(layouts),'checks':{'rgba':'PASS','sizeAndStateConsistency':'PASS','sha256':'PASS','transparentSafetyMargin':'PASS, mask/background exceptions per specification','sliceBounds':'PASS','noOrphanPngs':'PASS','layoutReferences':'PASS','referenceHashes':'PASS'},'visual':'See per-lane three-background and nine-slice evidence and 对照/. Visual limits recorded in 03 task 问题反馈; no claim of complete P1 S17 reconstruction.','files':files})
print(f'PASS: {len(items)} groups / {len(files)} PNG / {len(layouts)} layouts')
