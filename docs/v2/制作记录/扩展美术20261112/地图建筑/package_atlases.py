from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib,subprocess,sys
import numpy as np
import cv2
V2=Path('F:/qiguobing/git/Hexa Puzzle/Project/docs/v2'); REC=V2/'制作记录/扩展美术20261112/地图建筑'
JOBS=json.loads((REC/'jobs.json').read_text(encoding='utf-8'))
FONT='C:/Windows/Fonts/msyhbd.ttc'
def font(s):return ImageFont.truetype(FONT,s)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rel(p):return p.relative_to(V2).as_posix()
builds=[]; backgrounds=[]
for j in JOBS:
 p=Path(j['out'])
 if j['kind']=='background':
  im=Image.open(p);backgrounds.append({'id':j['id'],'name':j['name'],'file':rel(p),'size':list(im.size),'sha256':sha(p)});continue
 original=Image.open(p)
 alpha=original.convert('RGBA')
 if original.mode!='RGBA' or original.getextrema()[-1][0]>0:
  # The generic dominance keyer can mistake lilac stone for magenta spill.
  # The requested key is saturated pure magenta, so preserve all neutral stone
  # as fully opaque and remove only strongly magenta pixels, with an edge ramp.
  rgb=np.asarray(original.convert('RGB')).astype(np.float32)
  dominance=np.minimum(rgb[:,:,0],rgb[:,:,2])-rgb[:,:,1]
  opacity=1-np.clip((dominance-70)/150,0,1)
  clean=np.clip((rgb-(1-opacity[:,:,None])*np.array([255,0,255]))/np.maximum(opacity[:,:,None],.001),0,255)
  keyed=np.dstack([clean,opacity*255]).astype(np.uint8)
  alpha=Image.fromarray(keyed,'RGBA')
 a=np.asarray(alpha).copy();a[:,:,3]=np.where(a[:,:,3]<5,0,np.minimum(255,a[:,:,3].astype(np.uint16)*255//254)).astype(np.uint8);alpha=Image.fromarray(a)
 cw,ch=alpha.width/3,alpha.height/2
 dense=np.asarray(alpha)[:,:,3]>128
 cuts=[]
 for c in range(3):
  proj=dense[:,round(c*cw):round((c+1)*cw)].sum(axis=1)
  lo,hi=round(alpha.height*.38),round(alpha.height*.58)
  window=proj[lo:hi]; candidates=np.where(window==window.min())[0]+lo
  cuts.append(int((candidates.min()+candidates.max())//2))
 tiles=[]
 for lev in range(6):
  col,row=lev%3,lev//3;box=(round(col*cw),0 if row==0 else cuts[col],round((col+1)*cw),cuts[col] if row==0 else alpha.height)
  tile=alpha.crop(box)
  pixels=np.asarray(tile).copy()
  seed=(pixels[:,:,3]>64).astype(np.uint8)
  nc,labels,stats,cent=cv2.connectedComponentsWithStats(seed,8)
  ids=[k for k in range(1,nc) if stats[k,cv2.CC_STAT_AREA]>80]
  assert ids,(j['id'],lev,'no foreground')
  valid=np.isin(labels,ids).astype(np.uint8)
  valid=cv2.dilate(valid,np.ones((3,3),np.uint8),iterations=1)
  pixels[:,:,3]*=valid
  tile=Image.fromarray(pixels)
  bb=tile.getbbox();assert bb,(j['id'],lev,'empty')
  assert bb[0]>0 and bb[1]>0 and bb[2]<tile.width and bb[3]<tile.height,(j['id'],lev,'crop touches cell edge',bb)
  tiles.append((tile,bb,box))
 maxw=max(bb[2]-bb[0] for _,bb,_ in tiles);maxh=max(bb[3]-bb[1] for _,bb,_ in tiles)
 common_scale=min(1.0,512/maxw,500/maxh)
 dest=V2/f'素材/建筑/{j["id"]}_{j["name"]}';dest.mkdir(parents=True,exist_ok=True)
 atlas=Image.new('RGBA',(1728,1420),(0,0,0,0));d=ImageDraw.Draw(atlas)
 d.rounded_rectangle((16,10,1712,105),radius=24,fill='#f6edda',outline='#68b8ca',width=3)
 d.text((864,36),f'{j["id"]}  {j["name"]} · 0—5级升级图集',font=font(33),fill='#173a64',anchor='mt')
 states=[]
 for lev,(tile,bb,box) in enumerate(tiles):
  crop=tile.crop(bb)
  if common_scale<1:crop=crop.resize((round(crop.width*common_scale),round(crop.height*common_scale)),Image.Resampling.LANCZOS)
  sprite=Image.new('RGBA',(576,576),(0,0,0,0));px=(576-crop.width)//2;py=544-crop.height;sprite.alpha_composite(crop,(px,py))
  # Remove visible chroma fringes using nearby solid material color, while
  # preserving geometry and all interior neutral stone pixels.
  if original.mode!='RGBA':
   pix=np.asarray(sprite).copy();rgb=pix[:,:,:3].astype(np.int16)
   edge=(pix[:,:,3]>0)&(cv2.erode((pix[:,:,3]>240).astype(np.uint8),np.ones((9,9),np.uint8))==0)
   bad=edge&(((np.minimum(rgb[:,:,0],rgb[:,:,2])-rgb[:,:,1])>15)|((rgb[:,:,1]-np.maximum(rgb[:,:,0],rgb[:,:,2]))>25))
   good=(pix[:,:,3]>250)&~edge
   if bad.any() and good.any():
    _,nearest=cv2.distanceTransformWithLabels((~good).astype(np.uint8),cv2.DIST_L2,5,labelType=cv2.DIST_LABEL_PIXEL)
    source_colors=pix[:,:,:3][good]
    pix[:,:,:3][bad]=source_colors[nearest[bad]-1]
    sprite=Image.fromarray(pix,'RGBA')
  outfile=dest/f'{j["id"]}_L{lev}.png';sprite.save(outfile)
  sx=(lev%3)*576;sy=120+(lev//3)*640;atlas.alpha_composite(sprite,(sx,sy))
  d.text((sx+288,sy+591),f'{j["id"]}-L{lev}  '+('地基' if lev==0 else f'{lev}级'),font=font(26),fill='#173a64',anchor='mt')
  states.append({'level':lev,'file':rel(outfile),'size':[576,576],'anchor':[0.5,544/576],'source_rect':list(box),'source_visible_bbox':list(bb),'source_common_scale':common_scale,'sha256':sha(outfile)})
 board=V2/f'图集/建筑/{j["id"]}_{j["name"]}_0至5级.png';atlas.save(board)
 # True white/dark visual evidence from actual final atlas.
 for label,bg in [('白底','#ffffff'),('深底','#142e4d')]:
  compos=Image.new('RGBA',atlas.size,bg);compos.alpha_composite(atlas);compos.convert('RGB').save(REC/f'{j["id"]}_{label}检查.jpg',quality=92)
 builds.append({'id':j['id'],'map':j['map'],'name':j['name'],'atlas':rel(board),'atlas_size':list(atlas.size),'atlas_sha256':sha(board),'source':rel(p),'source_sha256':sha(p),'states':states})
 print(j['id'],'packaged 6 states',flush=True)

anchors=[(.50,.36,.64),(.245,.505,.53),(.76,.505,.49),(.25,.725,.56),(.775,.71,.48)]
configs=[]
for bg in backgrounds:
 bs=[x for x in builds if x['map']==bg['id']]
 placements=[]
 for i,b in enumerate(bs):
  x,y,width=anchors[i]
  flip=False
  if bg['id']=='M02':
   # Creek is on the left lower edge, so functional water buildings must
   # use shoreline positions, rather than the generic right-hand slots.
   x,y,width={0:(.50,.36,.60),1:(.76,.51,.48),2:(.23,.735,.49),3:(.76,.72,.45),4:(.245,.89,.43)}[i]
   flip=i==2
  placements.append({'building':b['id'],'name':b['name'],'normalized_feet':[x,y],'anchor':[.5,544/576],'sprite_canvas':[576,576],'render_width_fraction':width,'flip_x':flip,'z_index':100+round(y*100),'stages':[{ 'level':s['level'],'file':s['file']} for s in b['states']]})
 cfg={'map':bg['id'],'name':bg['name'],'background':bg['file'],'background_size':bg['size'],'coordinate_system':'normalized image x left to right, y top to bottom; anchor is sprite feet','placements':placements,'notes':'Layout for v2 atlas composition; not written to runtime config. Original S03 is retained as style reference; this atlas defines new level-specific appearances.'}
 cf=V2/f'地图/{bg["id"]}_建筑布局.json';cf.write_text(json.dumps(cfg,ensure_ascii=False,indent=2),encoding='utf-8');configs.append(rel(cf))
 # actual L5 composition to validate assets against the saved bare background.
 for variant,levels in [('满级',[5]*5),('阶段',[3,2,1,2,1])]:
  im=Image.open(V2/bg['file']).convert('RGBA');w,h=im.size
  for pl,lev in sorted(zip(placements,levels),key=lambda pair:pair[0]['z_index']):
   sprite=Image.open(V2/pl['stages'][lev]['file']).convert('RGBA')
   if pl.get('flip_x'):sprite=sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
   rw=round(w*pl['render_width_fraction']);rh=round(sprite.height*rw/sprite.width);sprite=sprite.resize((rw,rh),Image.Resampling.LANCZOS)
   x=round(pl['normalized_feet'][0]*w-rw*.5);y=round(pl['normalized_feet'][1]*h-rh*pl['anchor'][1]);im.alpha_composite(sprite,(x,y))
  im.save(REC/f'{bg["id"]}_{variant}组合检查.png')
manifest={'date':'2026-11-12','status':'generated design atlas and extracted sprite candidates, not engine-imported or user-approved','model':'gpt-image-2','backgrounds':backgrounds,'buildings':builds,'layout_configs':configs,'counts':{'backgrounds':len(backgrounds),'building_atlases':len(builds),'stages':sum(len(x['states']) for x in builds)},'level_authority_note':'Existing S03 remains unchanged and is only the approved style reference; per-level visual identity is defined by these new atlases.','original_prompts':rel(REC/'prompts'),'generation_jobs':rel(REC/'jobs.json')}
(V2/'图集/建筑/atlas_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(manifest['counts'])
