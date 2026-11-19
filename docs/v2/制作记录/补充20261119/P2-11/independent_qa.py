"""Read-only independent P2-11 file, manifest and alpha-geometry audit.

Reports and the immutable pre-batch baseline are stored beside this script.
No imports from production packaging/verification code; no API access.
"""
from pathlib import Path
import argparse, hashlib, json, subprocess, re
import numpy as np
from PIL import Image, ImageDraw, ImageOps
from scipy import ndimage

ROOT=Path(__file__).resolve().parents[5]
V=ROOT/'docs/v2'
T=Path(__file__).resolve().parent
BASE=T/'independent_baseline.json'
REPORT=T/'independent_report.json'
MUTABLE={'美术交付清单.json','图集/建筑/atlas_manifest.json','图集/建筑/Building_Catalog.csv','美术交付说明.md'}
TEMPLATES={21:'A',22:'B',23:'A',24:'B',25:'A',26:'A',27:'B',28:'A',29:'B',30:'A'}
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def read(p): return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def dump(p,obj): p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT).decode('utf-8')
def snapshot():
 if BASE.exists():raise FileExistsError('Refusing to overwrite the pre-batch baseline')
 files=[x for x in git('ls-files','-z','docs/v2').split('\0') if x]
 files={str(Path(x).relative_to('docs/v2')).replace('\\','/'):sha(ROOT/x) for x in files}
 state={'head':git('rev-parse','HEAD').strip(),'files':files,'manifest':read(V/'美术交付清单.json'),'atlas':read(V/'图集/建筑/atlas_manifest.json'),'catalog':(V/'图集/建筑/Building_Catalog.csv').read_text(encoding='utf-8-sig'),'description':(V/'美术交付说明.md').read_text(encoding='utf-8'),'git_status':git('status','--porcelain','-z')}
 dump(BASE,state)
 print('Baseline saved:',len(files),'existing tracked docs/v2 files; head',state['head'])
def verify():
 base=read(BASE); errors=[]; warnings=[]; maps=[]; oldchanges=[]
 def check(ok,msg):
  if not ok:errors.append(msg)
 for name,digest in base['files'].items():
  if name in MUTABLE:continue
  p=V/name
  if not p.exists() or sha(p)!=digest:oldchanges.append(name)
 check(not oldchanges,f'Existing delivered files changed: {oldchanges}')
 man=read(V/'美术交付清单.json');atlas=read(V/'图集/建筑/atlas_manifest.json')
 for title,old,new in [('manifest',base['manifest'],man),('atlas',base['atlas'],atlas)]:
  for key,value in old.items():
   if key=='counts':continue
   if isinstance(value,list):check(new.get(key,[])[:len(value)]==value,f'{title}.{key}: existing array entries changed')
   else:check(new.get(key)==value,f'{title}.{key}: existing metadata changed')
 check((V/'图集/建筑/Building_Catalog.csv').read_text(encoding='utf-8-sig').startswith(base['catalog']),'Existing building catalog changed')
 nowlines=iter((V/'美术交付说明.md').read_text(encoding='utf-8').splitlines())
 check(all(any(line==candidate for candidate in nowlines) for line in base['description'].splitlines()),'Description removed or edited existing lines')
 idx={e['file']:e for e in man['independentPNGs']+man['p2Extensions']}
 uiidx={e['id']:e for e in man['uiAssets']}
 atlasidx={e['id']:e for e in atlas['buildings']}
 allrun=[]
 for num,template in TEMPLATES.items():
  mid=f'M{num:02}'; row={'map':mid,'template':template,'buildings':[]}; maps.append(row)
  lp=V/f'地图/{mid}_建筑布局.json';check(lp.exists(),f'{mid}: layout absent')
  if not lp.exists():continue
  cfg=read(lp);orig=read(V/f'地图/M0{1 if template=="A" else 2}_建筑布局.json')
  check(cfg.get('map')==mid and len(cfg.get('placements',[]))==5,f'{mid}: invalid layout identity/count')
  bgp=V/cfg['background']; extp=bgp.with_name(bgp.stem+'_扩展.png'); tp=V/f'素材/UI/地图选择/map_thumb_{mid.lower()}.png'
  required=[(bgp,(854,1842),'RGB'),(extp,(1120,2040),'RGB'),(tp,(768,350),'RGBA')]
  layers={0:[],5:[]}; spritehashes=[]
  for slot,(pl,op) in enumerate(zip(cfg['placements'],orig['placements'])):
   bid=f'B{(num-1)*5+slot+1}';br={'building':bid,'states':[]};row['buildings'].append(br)
   check(pl['building']==bid,f'{mid} slot{slot}: wrong building')
   check(pl['anchor']==[.5,544/576] and pl['sprite_canvas']==[576,576],f'{bid}: invalid anchor/canvas')
   check(all(abs(a-b)<=.0300001 for a,b in zip(pl['normalized_feet'],op['normalized_feet'])),f'{bid}: feet exceed template tolerance')
   check(abs(pl['render_width_fraction']-op['render_width_fraction'])<=.0500001,f'{bid}: width exceeds template tolerance')
   if slot==0:check(.6<=pl['render_width_fraction']<=.64,f'{bid}: primary width outside .6-.64')
   check([s['level'] for s in pl['stages']]==list(range(6)),f'{bid}: stage levels invalid')
   bottoms=[];heights=[];hashes=[]
   for level,st in enumerate(pl['stages']):
    sp=V/st['file'];required.append((sp,(576,576),'RGBA'))
    if not sp.exists():continue
    im=Image.open(sp).convert('RGBA');p=np.asarray(im);a=p[:,:,3];mask=a>8
    box=Image.fromarray((mask*255).astype(np.uint8)).getbbox();check(bool(box),f'{bid}L{level}: empty sprite')
    if not box:continue
    check(min(box[0],box[1],576-box[2],576-box[3])>=2,f'{bid}L{level}: less than 2px transparent margin')
    bottoms.append(box[3]);heights.append(box[3]-box[1]);hashes.append(sha(sp))
    br['states'].append({'level':level,'bbox':box,'sha256':sha(sp),'alpha_range':[int(a.min()),int(a.max())]})
    if level in layers:
     if pl.get('flip_x'):im=ImageOps.mirror(im)
     width=round(854*pl['render_width_fraction']);im=im.resize((width,width),Image.Resampling.LANCZOS)
     xy=(round(pl['normalized_feet'][0]*854-width*.5),round(pl['normalized_feet'][1]*1842-width*544/576))
     can=Image.new('RGBA',(854,1842));can.alpha_composite(im,xy);layers[level].append(can)
   check(len(bottoms)==6 and max(bottoms)-min(bottoms)<=4 and all(abs(y-544)<=4 for y in bottoms),f'{bid}: anchor alpha deviation exceeds4px')
   check(len(set(hashes))==6,f'{bid}: duplicate six-state files')
   if len(heights)==6 and any(heights[i]>heights[i+1]+4 for i in range(1,5)):warnings.append(f'{bid}: outline heights non-monotone {heights}')
   if len(heights)==6 and heights[5]<max(heights[1:])-4:warnings.append(f'{bid}: L5 outline not largest {heights}')
   entry=atlasidx.get(bid);check(entry is not None and entry.get('batch')=='P2-11',f'{bid}: atlas registration absent')
   if entry:
    check((V/entry['atlas']).exists() and sha(V/entry['atlas'])==entry['atlas_sha256'],f'{bid}: atlas hash mismatch')
  check(len(required)==33,f'{mid}: expected33 runtime files, found{len(required)}')
  for path,size,mode in required:
   rel=path.relative_to(V).as_posix();allrun.append(rel)
   check(path.exists(),f'{rel}: absent')
   if not path.exists():continue
   with Image.open(path) as im:im.load();check(im.size==size and im.mode==mode,f'{rel}: invalid size/mode')
   if path==tp:
    ent=uiidx.get(f'map_thumb_{mid.lower()}');check(ent is not None,f'{mid}: thumbnail registration absent')
    if ent:
     check(ent.get('sha256',{}).get('normal')==sha(path),f'{mid}: thumbnail hash mismatch')
     for source in ent.get('sources',[]):check(sha(V/source['file'])==source['sha256'],f'{mid}: source hash mismatch {source["file"]}')
   else:
    ent=idx.get(rel);check(ent is not None,f'{rel}: registration absent')
    if ent:check(ent.get('sha256')==sha(path),f'{rel}: registered hash mismatch')
   if ent:check(ent.get('batch')=='P2-11' and ent.get('priority')=='P1' and ent.get('source'),f'{rel}: batch/priority/source invalid')
  if bgp.exists() and extp.exists():
   bg=np.asarray(Image.open(bgp));ex=np.asarray(Image.open(extp).crop((133,99,987,1941)));diff=np.abs(bg.astype(int)-ex.astype(int))
   row['extension_changed_pixels']=int(np.any(diff,axis=2).sum());check(not diff.any(),f'{mid}: extension center is not pixel-identical')
  ordered=sorted(cfg['placements'],key=lambda p:p['z_index']);check([p['normalized_feet'][1] for p in ordered]==sorted(p['normalized_feet'][1] for p in ordered),f'{mid}: zorder invalid')
  row['geometry']={}
  for lev,canvases in layers.items():
   masks=[np.asarray(c)[:,:,3]>128 for c in canvases];met=[]
   for i,mask in enumerate(masks):
    hud=int(mask[:round(1842*.18)].sum()+mask[round(1842*.88):].sum());core=ndimage.binary_erosion(mask,iterations=5)
    others=np.zeros_like(mask)
    for j,m in enumerate(masks):
     if cfg['placements'][j]['z_index']>cfg['placements'][i]['z_index']:others|=m
    overlap=int((mask&others).sum());corefraction=float((core&others).sum()/max(1,core.sum()))
    check(hud==0,f'{mid}L{lev} slot{i}: {hud} opaque pixels beneath HUD bands')
    check(corefraction<=.03,f'{mid}L{lev} slot{i}: core occlusion {corefraction:.3%}')
    met.append({'building':cfg['placements'][i]['building'],'hud_pixels':hud,'overlap_pixels':overlap,'core_occluded_fraction':corefraction})
   row['geometry'][f'L{lev}']=met
  ent=uiidx.get(f'map_thumb_{mid.lower()}')
  if len(layers[5])==5 and ent and tp.exists():
   scene=Image.open(bgp).convert('RGBA')
   for i in sorted(range(5),key=lambda i:cfg['placements'][i]['z_index']):scene.alpha_composite(layers[5][i])
   expected=scene.crop(ent['cropRect']).resize((768,350),Image.Resampling.LANCZOS)
   rounding=Image.new('L',(3072,1400));ImageDraw.Draw(rounding).rounded_rectangle((0,0,3071,1399),radius=80,fill=255);expected.putalpha(rounding.resize((768,350),Image.Resampling.LANCZOS))
   check(np.array_equal(np.asarray(expected),np.asarray(Image.open(tp))),f'{mid}: thumbnail not exact scene derivation')
 check(len(allrun)==330 and len(set(allrun))==330,f'Expected330 distinct runtime files, found{len(allrun)}')
 out={'status':'PASS' if not errors else 'FAIL','baseline_head':base['head'],'protected_files':len(base['files'])-len(MUTABLE),'runtime_png_count':len(allrun),'errors':errors,'warnings':warnings,'maps':maps,'manual_review_required':['style and same camera','bee motifs and no prohibited objects','architectural growth and L5 richness','three-background edge cleanliness','background-site alignment']}
 dump(REPORT,out);print(json.dumps({k:out[k] for k in ['status','protected_files','runtime_png_count','errors','warnings']},ensure_ascii=False))
 return bool(errors)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('action',choices=['snapshot','verify']);a=p.parse_args()
 if a.action=='snapshot':snapshot()
 else:raise SystemExit(verify())
