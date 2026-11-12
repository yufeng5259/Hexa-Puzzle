"""P1 incremental integration; keeps 9515e71 PNGs and historical records immutable."""
from pathlib import Path
import json,hashlib,subprocess,sys,copy,re
from PIL import Image,ImageDraw,ImageFont,ImageOps,ImageChops
REC=Path(__file__).resolve().parent;V2=REC.parents[2];ROOT=V2.parents[1];A=V2/'素材'
BASE='9515e71';GROUPS=[['S05','S07','S08','S09','S10','S11','S12'],['S01','S24','S13','S14','S15','S16','S25'],['S18'],['S19','S20','S21','S22','S23']]
LANES=['characters','build_maps','signin_tasks','endless']
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def baseline(path):return subprocess.check_output(['git','show',BASE+':'+path],cwd=ROOT)
def nine(im,size,s):
 if not s:return im.resize(size,Image.Resampling.LANCZOS)
 l,t,r,b=s;w,h=im.size;W,H=size
 assert W>l+r and H>t+b,(size,s)
 xs=[0,l,w-r,w];ys=[0,t,h-b,h];X=[0,l,W-r,W];Y=[0,t,H-b,H];out=Image.new('RGBA',size)
 for y in range(3):
  for x in range(3):
   if X[x+1]<=X[x] or Y[y+1]<=Y[y]:continue
   out.paste(im.crop((xs[x],ys[y],xs[x+1],ys[y+1])).resize((X[x+1]-X[x],Y[y+1]-Y[y]),Image.Resampling.LANCZOS),(X[x],Y[y]))
 return out

def patch_existing(n):
 for sid in ['S02','S03','S04','S06','S17']:
  p=A/'布局'/f'{sid}.json';j=load(p);remaining=[];added=[];changed=False
  for e in j.get('deferredElements',[]):
   if e['id'].startswith('bee_') or (n>=3 and e['id'].startswith('signin_cell')):
    el={k:v for k,v in e.items() if k not in ['priority','reason']};el.setdefault('asset','角色/'+e['id']+'.png');added.append(el);changed=True
   else:remaining.append(e)
  if changed:
   # Background cells precede reward icons and text; characters remain foreground.
   cells=[e for e in added if e['id'].startswith('signin_cell')];bees=[e for e in added if e['id'].startswith('bee_')]
   j['elements'][2:2]=cells;j['elements']+=bees;j['deferredElements']=remaining
   j['p1Completion']='按本轮用户授权补齐角色/签到格引用；原P0 PNG与其他元素保持不变。'
   if sid=='S17' and n>=3:
    j['priorityNote']='P1-3补齐7日签到格和角色，原P0通用件保持不变。'
    if not any(e['id']=='signin_today_tag_bg' for e in j['elements']):j['elements'].insert(2+len(cells),{'id':'signin_today_tag_bg','asset':'UI/签到/signin_today_tag.png','rect':[141,994,126,58]})
   save(p,j)

def paths(a):
 result=list(a.get('states',{}).items())
 result += [(f'{i:02}',p) for i,p in enumerate(a.get('frames',[]),1)]
 return result

def integrate(n):
 patch_existing(n)
 base=json.loads(baseline('docs/v2/美术交付清单.json'));m=load(V2/'美术交付清单.json');items=copy.deepcopy(base['uiAssets'])
 for i in range(n):
  for a in load(REC/LANES[i]/'manifest.json'):
   a.setdefault('batch',f'P1-{i+1}');items.append(a)
 assert len({a['id'] for a in items})==len(items),'duplicate IDs'
 m['uiAssets']=items
 selected=['S02','S03','S04','S06','S17']+sum(GROUPS[:n],[]);layouts=[]
 for sid in sorted(selected):
  p=A/'布局'/f'{sid}.json';j=load(p)
  assert digest(V2/j['reference'])==j['referenceSha256'],sid
  ids=[e['id'] for e in j['elements']];assert len(ids)==len(set(ids)),(sid,'duplicate elements')
  for e in j['elements']:
   if 'asset' in e:assert (A/e['asset']).is_file(),(sid,e['asset'])
  layouts.append({'id':sid,'file':p.relative_to(V2).as_posix(),'sha256':digest(p),'priority':j.get('priority','P1'),'deferredElements':j.get('deferredElements',[])})
 m['uiLayouts']=layouts
 m.setdefault('uiDeliveries',{})[f'P1-{n}']={'date':'2026-11-12','newAssetGroups':len(load(REC/LANES[n-1]/'manifest.json')),'newPngFiles':len(set(p for a in load(REC/LANES[n-1]/'manifest.json') for _,p in paths(a))),'newLayouts':GROUPS[n-1],'verification':f'制作记录/切图20261112/P1/P1-{n}_verification.json'}
 p0paths={p for a in base['uiAssets'] for _,p in paths(a)}
 m['uiDeliveries'][f'P1-{n}']['reusedPngFiles']=len({p for a in load(REC/LANES[n-1]/'manifest.json') for _,p in paths(a)} & p0paths)
 m['uiDeliveries'][f'P1-{n}']['newPngFiles']-=m['uiDeliveries'][f'P1-{n}']['reusedPngFiles']
 m['counts']['p1UiAssetGroups']=len(items)-len(base['uiAssets']);m['counts']['p1UiPngs']=len({p for a in items if a.get('priority')=='P1' for _,p in paths(a)}-p0paths);m['counts']['p1NewLayouts']=len(selected)-5
 save(V2/'美术交付清单.json',m)
 # No historical asset or record may change; only five explicitly authorised layouts.
 changed=[]
 raw=subprocess.check_output(['git','ls-tree','-r','--name-only','-z',BASE,'--','docs/v2/素材','docs/v2/制作记录/切图20261112'],cwd=ROOT).decode().split('\0')
 allowed={f'docs/v2/素材/布局/{s}.json' for s in ['S02','S03','S04','S06','S17']}
 for p in filter(None,raw):
  assert (ROOT/p).is_file(),p
  if hashlib.sha256(baseline(p)).hexdigest()!=digest(ROOT/p):assert p in allowed,p;changed.append(p)
 checks=0;allfiles=set();newfiles=set()
 for a in items:
  sizes=[]
  if 'frames' in a:assert 0<a['fps']<=60 and len(a['frames'])>=2,a['id']
  for key,path in paths(a):
   p=A/path;im=Image.open(p);assert im.mode=='RGBA',(path,im.mode);assert list(im.size)==a['size'],path;sizes.append(im.size)
   assert digest(p)==a['sha256'][key],(path,'SHA');assert re.fullmatch(r'[a-z0-9_]+\.png',p.name),path
   al=im.getchannel('A');bb=al.getbbox()
   if not a.get('opaque') and a['id'] not in ['mask_black','bg_endless']:
    assert bb and bb[0]>=2 and bb[1]>=2 and bb[2]<=im.width-2 and bb[3]<=im.height-2,(path,bb)
   if a.get('slice'):
    l,t,r,b=a['slice'];w,h=im.size;assert l+r<w and t+b<h,path
    for W,H in [(2*w,h),(w,2*h),(2*w,2*h)]:
     out=nine(im,(W,H),a['slice'])
     for old,new in [((0,0,l,t),(0,0,l,t)),((w-r,0,w,t),(W-r,0,W,t)),((0,h-b,l,h),(0,H-b,l,H)),((w-r,h-b,w,h),(W-r,H-b,W,H))]:assert ImageChops.difference(im.crop(old),out.crop(new)).getbbox() is None,path
     checks+=1
   allfiles.add(path)
   if a.get('priority')=='P1':newfiles.add(path)
  assert len(set(sizes))<=1,a['id']
  if a.get('sourceFile'):
   expected=a.get('sourceSha256',a.get('sourceHash'))
   if expected:assert digest(V2/a['sourceFile'])==expected,(a['id'],'source SHA')
 for a in base['designImages']:assert digest(V2/a['file'])==a['sha256'],a['id']
 scopeDirs=[['角色'],['UI/地图选择','UI/建造/fx_build_scaffold','UI/建造/fx_build_dust','UI/建造/fx_build_sparkle'],['UI/签到','UI/任务'],['UI/无尽','UI/特效/fx_line_clear']][n-1]
 actualGroup={p.relative_to(A).as_posix() for d in scopeDirs for p in (A/d).rglob('*.png')}
 expectedGroup={p for a in load(REC/LANES[n-1]/'manifest.json') for _,p in paths(a)}-p0paths
 assert actualGroup==expectedGroup,('group orphans',actualGroup-expectedGroup,expectedGroup-actualGroup)
 # Whole-tree orphan check on final group; earlier groups can have uncommitted later work.
 if n==4:
  actual={p.relative_to(A).as_posix() for d in ['UI','背景','角色'] for p in (A/d).rglob('*.png')}
  assert actual==allfiles,('orphans',actual-allfiles,'missing',allfiles-actual)
 save(REC/f'P1-{n}_verification.json',{'result':'PASS','group':f'P1-{n}','assetGroups':len(items),'p1UniquePngs':len(newfiles-p0paths),'totalLayouts':len(layouts),'p0PngHashesUnchanged':103,'p0LayoutChangesAuthorized':changed,'nineSliceStretchCases':checks,'rgbaDimensionsHashesSafeEdges':'PASS','originalDesignImagesUnchanged':25,'noOrphanFiles':'PASS whole delivery' if n==4 else 'PASS selected group; later groups excluded from staged delivery'})
 return m

def render(m,sid,exclude=(),overrides=None):
 j=load(A/'布局'/f'{sid}.json');lookup={p:a for a in m['uiAssets'] for _,p in paths(a)}
 if j.get('underlay'):im=render(m,j['underlay'],j.get('underlayExcludeIds',[]),j.get('underlayOverrides',{}))
 else:im=Image.new('RGBA',tuple(j['size']),(14,42,92,255))
 for original in j['elements']:
  e={**original,**(overrides or {}).get(original['id'],{})}
  if e['id'] in exclude or e.get('visible') is False:continue
  if 'rect' in e:x,y,w,h=e['rect']
  elif e.get('anchor')=='building_feet':
   fx,fy=j['anchorContext'][e['buildingId']]['feet'];dx,dy=e['offset'];w,h=e['size'];x,y=fx+dx-w/2,fy+dy-h/2
  else:raise ValueError(e)
  x,y,w,h=map(round,(x,y,w,h))
  if 'asset' in e:
   source=Image.open(A/e['asset']).convert('RGBA');a=lookup.get(e['asset'],{})
   if e.get('fit')=='cover':pic=ImageOps.fit(source,(w,h),method=Image.Resampling.LANCZOS)
   elif e.get('slice'):pic=nine(source,(w,h),a.get('slice'))
   else:pic=source.resize((w,h),Image.Resampling.LANCZOS)
   if e.get('tint'):pic=ImageChops.multiply(pic,Image.new('RGBA',pic.size,e['tint']))
   if 'opacity' in e:pic.putalpha(pic.getchannel('A').point(lambda z:round(z*e['opacity'])))
   im.alpha_composite(pic,(x,y))
  elif e.get('type')=='label':
   f=ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc' if e.get('bold') else 'C:/Windows/Fonts/msyh.ttc',round(e['fontSize']));d=ImageDraw.Draw(im)
   d.multiline_text((x+w/2,y+h/2),str(e.get('text','')),font=f,fill=e.get('color','#ffffff'),anchor='mm',align=e.get('align','center'),stroke_width=round(e.get('outlineWidth',0)),stroke_fill=e.get('outlineColor','#0E2A5C'))
 return im

def compare(m,sids,folder):
 folder.mkdir(exist_ok=True,parents=True)
 for sid in sids:
  j=load(A/'布局'/f'{sid}.json');ref=Image.open(V2/j['reference']).convert('RGB');new=render(m,sid).convert('RGB');new.save(folder/f'{sid}_切图合成.png')
  sheet=Image.new('RGB',(1708,1922),'#152748');sheet.paste(ref,(0,80));sheet.paste(new,(854,80));d=ImageDraw.Draw(sheet);f=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',24)
  d.text((20,12),sid+' 原效果图',font=f,fill='white');d.text((874,12),'P1切图 + 布局合成',font=f,fill='white');sheet.save(folder/f'{sid}_原图对照.jpg',quality=94)
 # Maintain an aspect-correct contact sheet for review.
 sheet=Image.new('RGB',(1708,480*((len(sids)+3)//4)),'#152748')
 for i,sid in enumerate(sids):sheet.paste(Image.open(folder/f'{sid}_原图对照.jpg').resize((427,480),Image.Resampling.LANCZOS),((i%4)*427,(i//4)*480))
 sheet.save(folder/'contact.jpg',quality=94)
if __name__=='__main__':
 n=int(sys.argv[1]);m=integrate(n);compare(m,GROUPS[n-1]+(['S02','S03','S04','S06','S17'] if n in [1,3] else []),REC.parent/'对照'/'P1'/f'P1-{n}')
 print(f'P1-{n} PASS; integrated {len(m["uiAssets"])} groups, {len(m["uiLayouts"])} layouts')
