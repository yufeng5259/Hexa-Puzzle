"""Independent file/geometry QA for P2-9. Does not register or import resources."""
from pathlib import Path
import argparse,json,hashlib
import numpy as np
from PIL import Image,ImageOps,ImageDraw
from scipy import ndimage

REC=Path(__file__).resolve().parent
V2=REC.parents[2]
ALLOWED={'M04':'B','M05':'A','M06':'A','M07':'B','M08':'B','M09':'A','M10':'A'}

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads(p.read_text(encoding='utf-8'))
def verify(mid,require_manifest=False):
 assert mid in ALLOWED
 errors=[];warnings=[];checks=[];state_rows=[];mask_rows=[]
 def check(ok,detail):
  checks.append(dict(pass_check=bool(ok),detail=detail))
  if not ok:errors.append(detail)
 packed=load(REC/mid/'packaged.json');cfg=load(V2/packed['layout']['file'])
 template=load(V2/f'地图/M0{1 if ALLOWED[mid]=="A" else 2}_建筑布局.json')
 check(cfg['map']==mid and len(cfg['placements'])==5,'Map identity and five placements')
 runtime=[packed['background']['file'],packed['extension']['file'],packed['thumbnail']['file']]
 runtime += [s['file'] for b in packed['buildings'] for s in b['states']]
 check(len(runtime)==33 and len(set(runtime))==33,'33 distinct runtime PNG files')
 targets=[(packed['background']['file'],(854,1842),'RGB'),(packed['extension']['file'],(1120,2040),'RGB'),(packed['thumbnail']['file'],(768,350),'RGBA')]
 targets += [(s['file'],(576,576),'RGBA') for b in packed['buildings'] for s in b['states']]
 for file,size,mode in targets:
  p=V2/file
  check(p.exists(),f'{file}: exists')
  if not p.exists():continue
  with Image.open(p) as im:
   im.load();check(im.size==size and im.mode==mode,f'{file}: {size} {mode}')
 for key in ['background','extension','thumbnail']:
  check(sha(V2/packed[key]['file'])==packed[key]['sha256'],f'{key}: packaged SHA')
 derivation=packed.get('backgroundDerivation')
 if derivation:
  check(sha(V2/derivation['source'])==derivation['source_sha256'],'Background raw source SHA preserved')
 bg=np.asarray(Image.open(V2/packed['background']['file']).convert('RGB'))
 ext=np.asarray(Image.open(V2/packed['extension']['file']).convert('RGB'))[99:1941,133:987]
 delta=np.abs(bg.astype(int)-ext.astype(int))
 check(not delta.any(),'Extended central crop is pixel-identical at (133,99)')
 masks=[];cores=[];layers=[]
 for i,(pl,base,b) in enumerate(zip(cfg['placements'],template['placements'],packed['buildings'])):
  check(pl['building']==b['id'] and pl['name']==b['name'],f'{b["id"]}: identity')
  check(sha(V2/b['source'])==b['source_sha256'],f'{b["id"]}: raw source SHA preserved')
  check(pl['anchor']==[.5,544/576] and pl['sprite_canvas']==[576,576],f'{b["id"]}: anchor/canvas')
  check(all(abs(x-y)<=.03000001 for x,y in zip(pl['normalized_feet'],base['normalized_feet'])),f'{b["id"]}: template feet delta <=0.03')
  check(abs(pl['render_width_fraction']-base['render_width_fraction'])<=.05000001,f'{b["id"]}: template width delta <=0.05')
  if i==0:check(.6<=pl['render_width_fraction']<=.64,f'{b["id"]}: main hive width 0.6..0.64')
  check([s['level'] for s in pl['stages']]==list(range(6)),f'{b["id"]}: six levels')
  heights=[];widths=[];feet=[];hashes=[];source_scales=[]
  for level,s in enumerate(b['states']):
   file=V2/s['file'];sprite=Image.open(file).convert('RGBA');pix=np.asarray(sprite);a=pix[:,:,3]
   check(pl['stages'][level]['file']==s['file'],f'{b["id"]} L{level}: layout reference')
   check(sha(file)==s['sha256'],f'{b["id"]} L{level}: packaged SHA')
   box=Image.fromarray(np.where(a>8,255,0).astype(np.uint8)).getbbox()
   check(bool(box),f'{b["id"]} L{level}: nonempty')
   if not box:continue
   feet.append(box[3]);heights.append(box[3]-box[1]);widths.append(box[2]-box[0]);hashes.append(sha(file));source_scales.append(s['source_common_scale'])
   check(box[0]>0 and box[1]>0 and box[2]<576 and box[3]<576,f'{b["id"]} L{level}: transparent canvas margin')
   key=(np.minimum(pix[:,:,0].astype(int),pix[:,:,2])-pix[:,:,1]>80)&(a>128)
   if not b.get('native_alpha_preserved'):
    check(int(key.sum())==0,f'{b["id"]} L{level}: no opaque saturated-magenta key spill')
   elif key.any():
    warnings.append(f'{b["id"]} L{level}: {int(key.sum())} magenta-like pixels in native-alpha art; color alone is not proof of key spill, inspect visually')
   edge=(a>0)&(a<255)
   state_rows.append(dict(building=b['id'],level=level,visible_bbox=list(box),semi_transparent_pixels=int(edge.sum()),opaque_key_pixels=int(key.sum()),sha256=sha(file)))
  check(len(set(hashes))==6,f'{b["id"]}: six distinct PNGs')
  check(max(feet)-min(feet)<=4 and all(abs(y-544)<=4 for y in feet),f'{b["id"]}: actual alpha feet deviation <=4px at y544')
  check(len(set(source_scales))==1,f'{b["id"]}: one common extraction scale')
  if not all(heights[k]<=heights[k+1]+4 for k in range(1,5)):warnings.append(f'{b["id"]}: non-monotone outline height {heights}; inspect architectural progression')
  if max(heights[1:])>heights[5]+4:warnings.append(f'{b["id"]}: L5 not tallest outline {heights}')
  if heights[1] and not .4<=heights[1]/heights[5]<=.8:warnings.append(f'{b["id"]}: L1/L5 height ratio {heights[1]/heights[5]:.3f}')
  if i==0 and heights[5]<460:warnings.append(f'{b["id"]}: main-hive HUD clearance yields L5 height {heights[5]}px; requirement approximate 85% is not claimed exactly')
  sprite=Image.open(V2/pl['stages'][5]['file']).convert('RGBA')
  if pl.get('flip_x'):sprite=ImageOps.mirror(sprite)
  width=round(pl['render_width_fraction']*854);sprite=sprite.resize((width,width),Image.Resampling.LANCZOS)
  xy=(round(pl['normalized_feet'][0]*854-width*.5),round(pl['normalized_feet'][1]*1842-width*544/576))
  canvas=Image.new('RGBA',(854,1842));canvas.alpha_composite(sprite,xy);mask=np.asarray(canvas)[:,:,3]>128
  layers.append(canvas)
  masks.append(mask);cores.append(ndimage.binary_erosion(mask,iterations=5))
  hud=int(mask[:round(1842*.18)].sum()+mask[round(1842*.88):].sum())
  check(hud==0,f'{b["id"]}: no opaque L5 pixels under HUD/button bands')
  mask_rows.append(dict(building=b['id'],hud_pixels=hud,opaque_pixels=int(mask.sum()),placement=pl['normalized_feet'],render_width_fraction=pl['render_width_fraction'],heights=heights,widths=widths))
 order=sorted(range(5),key=lambda i:cfg['placements'][i]['z_index'])
 check([cfg['placements'][i]['normalized_feet'][1] for i in order]==sorted(pl['normalized_feet'][1] for pl in cfg['placements']),'Z-order follows feet Y')
 for pos,i in enumerate(order):
  occluder=np.zeros(masks[i].shape,dtype=bool)
  for j in order[pos+1:]:occluder|=masks[j]
  overlap=int((masks[i]&occluder).sum());core=int((cores[i]&occluder).sum());fraction=core/max(1,int(cores[i].sum()))
  mask_rows[i].update(overlap_pixels=overlap,core_occluded_pixels=core,core_occluded_fraction=fraction)
  check(fraction<=.03,f'{mask_rows[i]["building"]}: main silhouette occlusion <=3% (actual {fraction:.4%})')
  if overlap:warnings.append(f'{mask_rows[i]["building"]}: {overlap} opaque overlap pixels ({core} core); requires visual review')
 thumb=np.asarray(Image.open(V2/packed['thumbnail']['file']))
 check(int(thumb[0,0,3])==0 and int(thumb[175,384,3])==255,'Thumbnail has genuine rounded alpha and opaque center')
 full=Image.open(V2/packed['background']['file']).convert('RGBA')
 for i in order:full.alpha_composite(layers[i])
 expected=full.crop(packed['thumbnail']['cropRect']).resize((768,350),Image.Resampling.LANCZOS)
 rounded=Image.new('L',(3072,1400));ImageDraw.Draw(rounded).rounded_rectangle((0,0,3071,1399),radius=80,fill=255)
 expected.putalpha(rounded.resize((768,350),Image.Resampling.LANCZOS))
 check(np.array_equal(np.asarray(expected),thumb),'Thumbnail pixels derive exactly from recorded L5 scene crop without repainting or relocation')
 if require_manifest:
  manifest=load(V2/'美术交付清单.json')
  lookup={e['file']:e for e in manifest['independentPNGs']}
  lookup.update({e['file']:e for e in manifest['p2Extensions']})
  ui=next((a for a in manifest['uiAssets'] if a['id']==f'map_thumb_{mid.lower()}'),None)
  for file in runtime:
   if file==packed['thumbnail']['file']:
    check(bool(ui) and ui['sha256']['normal']==sha(V2/file) and ui['batch']=='P2-9' and ui['priority']=='P1',f'{file}: manifest SHA/batch/priority')
   else:
    e=lookup.get(file);check(bool(e) and e['sha256']==sha(V2/file) and e['batch']=='P2-9' and e['priority']=='P1' and bool(e.get('source')),f'{file}: manifest SHA/batch/priority/source')
 report=dict(batch='P2-9',map=mid,status='technical-pass-visual-review-required' if not errors else 'technical-failure',runtime_png_count=len(runtime),extension_pixel_max_difference=int(delta.max()),extension_changed_pixels=int(np.any(delta,axis=2).sum()),checks=checks,errors=errors,warnings=warnings,states=state_rows,composition=mask_rows,visual_review_required=['same camera and lighting across all six states','architectural growth, L5 richness and recognizable bee motifs','no text, numbers, flags, religious symbols, real persons','ground landing alignment and no main-body occlusion','clean three-background transparency and style match with M01–M03'])
 path=REC/mid/'verification.json';path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(mid,report['status'],'errors',len(errors),'warnings',len(warnings),flush=True)
 return report

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--maps',nargs='+',required=True,choices=list(ALLOWED));p.add_argument('--require-manifest',action='store_true');a=p.parse_args()
 reports=[verify(mid,a.require_manifest) for mid in a.maps]
 raise SystemExit(1 if any(r['errors'] for r in reports) else 0)
