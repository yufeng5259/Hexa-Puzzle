"""P2-9 source-sheet packaging; outputs only new art files beneath docs/v2.
Run with the bundled Python: package_art.py --maps M04 M05.
No API calls, runtime import, or shared manifest mutation.
"""
from pathlib import Path
import argparse, copy, hashlib, json
import numpy as np
import cv2
from scipy import ndimage
from PIL import Image, ImageDraw, ImageFont, ImageOps

REC = Path(__file__).resolve().parent
V2 = REC.parents[2]
DATE = REC.parent
PROOFS = DATE / '对照'
COMPOSITES = DATE / '地图建筑'
FONT = 'C:/Windows/Fonts/msyhbd.ttc'
MAPS = {
 'M04': ('风车花海', 'B', ['花田蜂舍','花蜜榨坊','球根温室','运河花船','大风车']),
 'M05': ('蜂蜜港湾', 'A', ['灯塔蜂屋','装瓶工坊','码头货仓','起重吊臂','远航蜂船']),
 'M06': ('竹林茶山', 'A', ['竹楼蜂舍','制茶坊','茶叶仓','竹索缆车','六角宝塔']),
 'M07': ('樱花古町', 'B', ['町屋蜂舍','蜜饼工坊','米仓','红木拱桥','樱花天守阁']),
 'M08': ('水上花市', 'B', ['高脚蜂屋','椰糖工坊','水上货仓','长尾船码头','莲花观景台']),
 'M09': ('沙漠驿站', 'A', ['圆顶土屋','枣蜜作坊','香料仓','骆驼驿站','风塔']),
 'M10': ('香料宫苑', 'A', ['宫苑蜂舍','香料磨坊','丝绸库','花车驿站','镜湖凉亭']),
}

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def rel(p): return Path(p).relative_to(V2).as_posix()
def dump(p, obj):
 p.parent.mkdir(parents=True, exist_ok=True)
 p.write_text(json.dumps(obj, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
def font(size): return ImageFont.truetype(FONT, size)
def save(im, p):
 p.parent.mkdir(parents=True, exist_ok=True)
 im.save(p)
def info(p):
 with Image.open(p) as im: return dict(file=rel(p), size=list(im.size), mode=im.mode, sha256=sha(p))

def key_sheet(im):
 """Remove saturated magenta, unmix matte, and decontaminate edge RGB."""
 rgb = np.asarray(im.convert('RGB')).astype(np.float32)
 dominance = np.minimum(rgb[:,:,0], rgb[:,:,2])-rgb[:,:,1]
 alpha = 1-np.clip((dominance-65)/155, 0, 1)
 clean = np.clip((rgb-(1-alpha[:,:,None])*[255,0,255])/np.maximum(alpha[:,:,None],.001),0,255)
 pix = np.dstack([clean,alpha*255]).astype(np.uint8)
 pix[:,:,3][pix[:,:,3]<8] = 0
 return Image.fromarray(pix)

def cut_tiles(raw, bid):
 # Native alpha from the actual response takes precedence over a requested chroma key.
 if raw.mode=='RGBA' and raw.getextrema()[3][0]==0:
  pixels=np.asarray(raw).copy()
  maximum=int(pixels[:,:,3].max())
  if maximum==254:
   pixels[:,:,3]=np.minimum(255,np.rint(pixels[:,:,3].astype(float)*255/254)).astype(np.uint8)
  keyed=Image.fromarray(pixels)
 else:
  keyed = key_sheet(raw)
 dense = np.asarray(keyed)[:,:,3]>128
 def gap(proj,lo,hi):
  candidates=np.where(proj[lo:hi]==proj[lo:hi].min())[0]+lo
  assert proj[candidates[0]]==0, f'{bid}: no empty sheet separation'
  groups=np.split(candidates,np.where(np.diff(candidates)>1)[0]+1)
  longest=max(groups,key=len)
  return int((longest[0]+longest[-1])//2)
 rowcut=gap(dense.sum(axis=1),round(keyed.height*.38),round(keyed.height*.62))
 rows=[(0,rowcut),(rowcut,keyed.height)]
 columns=[]
 for top,bottom in rows:
  proj=dense[top:bottom].sum(axis=0)
  columns.append([0,gap(proj,round(keyed.width*.23),round(keyed.width*.44)),gap(proj,round(keyed.width*.56),round(keyed.width*.77)),keyed.width])
 tiles=[]
 for level in range(6):
  c,r=level%3,level//3
  rect=(columns[r][c],rows[r][0],columns[r][c+1],rows[r][1])
  pix=np.asarray(keyed.crop(rect)).copy()
  n,labels,stats,_=cv2.connectedComponentsWithStats((pix[:,:,3]>64).astype(np.uint8),8)
  ids=[i for i in range(1,n) if stats[i,cv2.CC_STAT_AREA]>=64]
  assert ids, f'{bid} L{level}: no extracted foreground'
  keep=cv2.dilate(np.isin(labels,ids).astype(np.uint8),np.ones((3,3),np.uint8))
  pix[:,:,3]*=keep
  # Only replace contaminated perimeter RGB; preserve the alpha and all interior materials.
  opaque=(pix[:,:,3]>248)
  edge=(pix[:,:,3]>0)&~ndimage.binary_erosion(opaque,iterations=3)
  dom=np.minimum(pix[:,:,0].astype(float),pix[:,:,2])-pix[:,:,1]
  bad=edge&(dom>12)
  good=ndimage.binary_erosion(opaque,iterations=1)&(dom<=12)
  if bad.any() and good.any():
   nearest=ndimage.distance_transform_edt(~good,return_distances=False,return_indices=True)
   pix[:,:,:3][bad]=pix[:,:,:3][tuple(nearest[:,bad])]
  tile=Image.fromarray(pix); bb=tile.getbbox()
  assert bb and bb[0]>0 and bb[1]>0 and bb[2]<tile.width and bb[3]<tile.height, f'{bid} L{level}: object touches cell edge: {bb}'
  tiles.append((tile.crop(bb),list(rect),list(bb)))
 return tiles

def package_building(mid,bid,name,slot):
 source=REC/mid/'raw'/f'{bid}_key.png'
 with Image.open(source) as raw:
  assert raw.width*2==raw.height*3, f'{source}: expected exact 3:2 sheet; got {raw.size}'
  source_size=list(raw.size)
  native_alpha=raw.mode=='RGBA' and raw.getextrema()[3][0]==0
  tiles=cut_tiles(raw,bid)
 # Maintain ONE common scale across six genuinely different architectural states.
 maxh=430 if slot==0 else 480
 scale=min(1.,512/max(t[0].width for t in tiles),maxh/max(t[0].height for t in tiles))
 states=[]; sprites=[]
 for level,(tile,rect,bb) in enumerate(tiles):
  tile=tile.resize((max(1,round(tile.width*scale)),max(1,round(tile.height*scale))),Image.Resampling.LANCZOS)
  pix=np.asarray(tile).copy();pix[:,:,3][pix[:,:,3]<8]=0;tile=Image.fromarray(pix)
  # Align the actual remaining matte, rather than a resampling-only transparent fringe.
  tile=tile.crop(tile.getbbox())
  sprite=Image.new('RGBA',(576,576));sprite.alpha_composite(tile,((576-tile.width)//2,544-tile.height))
  target=V2/f'素材/建筑/{bid}_{name}/{bid}_L{level}.png';save(sprite,target);sprites.append(sprite)
  states.append(dict(level=level,file=rel(target),size=[576,576],anchor=[.5,544/576],source_rect=rect,source_visible_bbox=bb,source_common_scale=scale,visible_bbox=list(sprite.getbbox()),sha256=sha(target)))
 atlas=Image.new('RGBA',(1728,1420));d=ImageDraw.Draw(atlas)
 d.rounded_rectangle((16,10,1712,105),24,fill='#F6EDDA',outline='#68B8CA',width=3)
 d.text((864,36),f'{bid} {name} · 0—5级升级图集',font=font(33),fill='#173A64',anchor='mt')
 for level,sprite in enumerate(sprites):
  x,y=(level%3)*576,120+(level//3)*640;atlas.alpha_composite(sprite,(x,y))
  d.text((x+288,y+591),f'{bid}-L{level} '+('地基' if level==0 else f'{level}级'),font=font(26),fill='#173A64',anchor='mt')
 target=V2/f'图集/建筑/{bid}_{name}_0至5级.png';save(atlas,target)
 # Three backgrounds, all six actual delivered sprites at half scale.
 proof=Image.new('RGB',(1728,3*320),'white');pd=ImageDraw.Draw(proof)
 for row,(label,color) in enumerate([('白底','#FFFFFF'),('深蓝','#0E2A5C'),('草绿','#7CC44E')]):
  pd.rectangle((0,row*320,1728,(row+1)*320),fill=color)
  for level,sprite in enumerate(sprites):
   small=sprite.resize((288,288),Image.Resampling.LANCZOS);proof.paste(small,(level*288,row*320),small)
   pd.text((level*288+144,row*320+288),f'{bid} L{level}',font=font(20),fill='#111111' if row!=1 else '#FFFFFF',anchor='mt')
 save(proof,PROOFS/f'{bid}_三底六态对照.png')
 overlay=Image.new('RGBA',(576,576));colors=[(255,90,30),(40,180,230),(240,170,20),(210,30,160),(30,220,120),(100,90,240)]
 for sprite,color in zip(sprites,colors):
  a=np.asarray(sprite)[:,:,3];edge=(a>100)&~ndimage.binary_erosion(a>100)
  lay=np.zeros((576,576,4),dtype=np.uint8);lay[edge]=[*color,200];overlay.alpha_composite(Image.fromarray(lay))
 od=ImageDraw.Draw(overlay);od.line((0,544,576,544),fill='#FF0000',width=1);save(overlay,PROOFS/f'{bid}_六态锚点叠放.png')
 return dict(id=bid,map=mid,name=name,atlas=rel(target),atlas_size=[1728,1420],atlas_sha256=sha(target),source=rel(source),source_sha256=sha(source),source_size=source_size,native_alpha_preserved=native_alpha,states=states,source_common_scale=scale,height_limit=maxh)

def sprite_layer(pl,level=5):
 sprite=Image.open(V2/pl['stages'][level]['file']).convert('RGBA')
 if pl.get('flip_x'):sprite=sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
 width=round(854*pl['render_width_fraction']);sprite=sprite.resize((width,width),Image.Resampling.LANCZOS)
 x=round(pl['normalized_feet'][0]*854-width*.5);y=round(pl['normalized_feet'][1]*1842-width*pl['anchor'][1])
 layer=Image.new('RGBA',(854,1842));layer.alpha_composite(sprite,(x,y));return layer

_layout_masks={}
def layout_score(placements):
 # Search at quarter resolution; the separate verifier measures final full-resolution masks.
 masks=[]
 for pl in placements:
  key=(pl['stages'][5]['file'],tuple(pl['normalized_feet']),pl['render_width_fraction'],pl.get('flip_x'))
  if key not in _layout_masks:
   alpha=sprite_layer(pl).getchannel('A').resize((214,461),Image.Resampling.BOX)
   _layout_masks[key]=np.asarray(alpha)>128
  masks.append(_layout_masks[key])
 score=0.
 for i,m in enumerate(masks):
  total=max(1,m.sum());hud=m[:83].sum()+m[405:].sum()
  score+=float(hud/total)*30
  for j in range(i):score+=float((m&masks[j]).sum()/min(total,max(1,masks[j].sum())))
 return score

def full_layout_score(placements):
 masks=[np.asarray(sprite_layer(pl).getchannel('A'))>128 for pl in placements]
 score=sum(int(m[:332].sum()+m[1621:].sum())*30 for m in masks)
 score+=sum(int((masks[i]&masks[j]).sum()) for i in range(len(masks)) for j in range(i))
 return score

def make_layout(mid,buildings):
 _layout_masks.clear()
 name,template,_=MAPS[mid]
 cfg=json.loads((V2/f'地图/M0{1 if template=="A" else 2}_建筑布局.json').read_text(encoding='utf-8'))
 original=copy.deepcopy(cfg['placements'])
 for i,(pl,b) in enumerate(zip(cfg['placements'],buildings)):
  pl.update(building=b['id'],name=b['name'],stages=[dict(level=s['level'],file=s['file']) for s in b['states']])
  if i==0:pl['normalized_feet'][1]=.39;pl['render_width_fraction']=.6
  if template=='B' and i==4:pl['normalized_feet'][1]=.86
 # Bounded coordinate descent only within the exact original-template tolerances.
 # Score uses actual alpha intersections, not bounding-box intersections.
 best=layout_score(cfg['placements'])
 for _ in range(2):
  for i,pl in enumerate(cfg['placements']):
   base=original[i];chosen=copy.deepcopy(pl)
   for dx in [-.03,0,.03]:
    for dy in [-.03,0,.03]:
     for dw in [-.05,0,.05]:
      width=round(base['render_width_fraction']+dw,6)
      if i==0 and not .6<=width<=.64:continue
      pl['normalized_feet']=[round(base['normalized_feet'][0]+dx,6),round(base['normalized_feet'][1]+dy,6)]
      pl['render_width_fraction']=width
      trial=layout_score(cfg['placements'])
      if trial<best-1e-8:best=trial;chosen=copy.deepcopy(pl)
   pl.clear();pl.update(chosen)
   if best==0:break
  if best==0:break
 # Resolve subpixel-scale overlaps hidden by the coarse search, using small bounded moves.
 exact=full_layout_score(cfg['placements'])
 if exact:
  for _ in range(2):
   for i,pl in enumerate(cfg['placements']):
    chosen=copy.deepcopy(pl);base=original[i]
    for axis in [0,1]:
     for step in [-.005,.005,-.01,.01]:
      trial=copy.deepcopy(chosen)
      value=round(trial['normalized_feet'][axis]+step,6)
      if abs(value-base['normalized_feet'][axis])>.03000001:continue
      trial['normalized_feet'][axis]=value
      pl.clear();pl.update(trial)
      score=full_layout_score(cfg['placements'])
      if score<exact:exact=score;chosen=copy.deepcopy(pl)
    pl.clear();pl.update(chosen)
    if exact==0:break
   if exact==0:break
 for rank,pl in enumerate(sorted(cfg['placements'],key=lambda p:p['normalized_feet'][1])):pl['z_index']=100+rank
 cfg.update(map=mid,name=name,background=f'地图/{mid}_{name}_背景.png',background_size=[854,1842],notes=f'P2-9; template {template}; bounded per-slot adjustment; quarter-resolution alpha search objective={best:.8f}; full-resolution overlap/HUD weighted pixels={exact}; independent validation recorded separately. No runtime config mutation.')
 return cfg,best

def compose(cfg,level):
 canvas=Image.open(V2/cfg['background']).convert('RGBA')
 for pl in sorted(cfg['placements'],key=lambda p:p['z_index']):canvas.alpha_composite(sprite_layer(pl,level))
 return canvas

def package(mid):
 assert mid in MAPS,'Only P2-9 maps may be packaged'
 name,template,names=MAPS[mid];start=5*int(mid[1:])-4
 required=[REC/mid/'raw/background.png']+[REC/mid/'raw'/f'B{start+i}_key.png' for i in range(5)]
 missing=[str(p) for p in required if not p.exists()]
 if missing:raise FileNotFoundError('Incomplete map source set: '+', '.join(missing))
 raw=Image.open(required[0]).convert('RGB')
 source_size=list(raw.size)
 cover_scale=max(1120/raw.width,2040/raw.height)
 crop_width,crop_height=1120/cover_scale,2040/cover_scale
 source_crop=[(raw.width-crop_width)/2,(raw.height-crop_height)/2,(raw.width+crop_width)/2,(raw.height+crop_height)/2]
 ext=ImageOps.fit(raw,(1120,2040),method=Image.Resampling.LANCZOS,centering=(.5,.5))
 bg=ext.crop((133,99,987,1941))
 ep=V2/f'地图/{mid}_{name}_背景_扩展.png';bp=V2/f'地图/{mid}_{name}_背景.png';save(ext,ep);save(bg,bp)
 buildings=[package_building(mid,f'B{start+i}',b,i) for i,b in enumerate(names)]
 cfg,overlap=make_layout(mid,buildings);cp=V2/f'地图/{mid}_建筑布局.json';dump(cp,cfg)
 for level,title in [(5,'满级'),(0,'L0地基')]:
  c=compose(cfg,level);save(c,COMPOSITES/f'{mid}_{title}组合检查.png')
  overlay=Image.new('RGBA',c.size);d=ImageDraw.Draw(overlay)
  d.rectangle((0,0,854,332),fill=(220,40,40,75));d.rectangle((0,1621,854,1842),fill=(30,70,220,75))
  c.alpha_composite(overlay);c=c.resize((853,round(1842*853/854)),Image.Resampling.LANCZOS);save(c,PROOFS/f'{mid}_{title}组合检查.png')
 # Center the genuine 5th-slot landmark, preserving the original map composition.
 full=compose(cfg,5)
 landmark_box=sprite_layer(cfg['placements'][4],5).getbbox()
 assert landmark_box, f'{mid}: fifth-slot landmark is empty'
 crop_height=round(854*350/768)
 center_y=(landmark_box[1]+landmark_box[3])/2
 crop_y=max(0,min(1842-crop_height,round(center_y-crop_height/2)))
 crop=[0,crop_y,854,crop_y+crop_height]
 thumb=full.crop(crop).resize((768,350),Image.Resampling.LANCZOS)
 mask=Image.new('L',(768*4,350*4));ImageDraw.Draw(mask).rounded_rectangle((0,0,3071,1399),radius=80,fill=255);thumb.putalpha(mask.resize((768,350),Image.Resampling.LANCZOS))
 tp=V2/f'素材/UI/地图选择/map_thumb_{mid.lower()}.png';save(thumb,tp)
 diff=np.abs(np.asarray(bg).astype(int)-np.asarray(ext.crop((133,99,987,1941))).astype(int))
 evidence=dict(map=mid,original=rel(bp),extended=rel(ep),offset=[133,99],max_channel_difference=int(diff.max()),changed_pixels=int(np.any(diff,axis=2).sum()),exact=True)
 dump(PROOFS/f'{mid}_扩展逐像素比对.json',evidence)
 dp=Image.fromarray(diff.astype(np.uint8)).resize((427,921));save(dp,PROOFS/f'{mid}_扩展差异图.png')
 result=dict(batch='P2-9',map=mid,name=name,template=template,background=info(bp),extension={**info(ep),'original':rel(bp),'originalOffset':[133,99]},layout={**info_json(cp),'template':template},buildings=buildings,thumbnail={**info(tp),'cropRect':crop,'sourceSize':[854,1842],'landmarkBBox':list(landmark_box),'landmarkFullyInsideCrop':landmark_box[1]>=crop[1] and landmark_box[3]<=crop[3]},extensionComparison=evidence,layoutAlphaObjective=overlap,observations=['Main hive height capped at 430 px to respect template plus top 18% HUD; all six levels keep one common extraction scale. Height is recorded rather than falsely claiming 85% occupancy.'])
 result['backgroundDerivation']=dict(source=rel(required[0]),source_sha256=sha(required[0]),source_size=source_size,cover_scale=cover_scale,source_crop_rect=source_crop,extended_output_size=[1120,2040],central_crop_rect=[133,99,987,1941],method='One generated full scene proportionally cover-fitted to extended canvas, then central map cropped pixel-identically. Not an outpaint of a pre-existing map; source dimensions and any upsampling are explicitly recorded.')
 if landmark_box[3]-landmark_box[1]>crop_height:
  result['observations'].append(f'Fifth-slot landmark height {landmark_box[3]-landmark_box[1]}px exceeds thumbnail source crop height {crop_height}px; visual review required.')
 dump(REC/mid/'packaged.json',result);print(mid,'packaged',len(buildings)*6+3,'runtime PNGs',flush=True)
 return result

def info_json(p):return dict(file=rel(p),sha256=sha(p))

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--maps',nargs='+',required=True,choices=list(MAPS));args=parser.parse_args()
 PROOFS.mkdir(parents=True,exist_ok=True);COMPOSITES.mkdir(parents=True,exist_ok=True)
 for mid in args.maps:package(mid)
