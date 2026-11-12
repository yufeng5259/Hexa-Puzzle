"""P0 icons: reference-derived RGBA, no baked text; execute from repository root."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageOps,ImageFilter,ImageFont
import numpy as np,cv2,json,hashlib,math
R=Path('docs/v2');O=R/'素材/UI/图标';REC=R/'制作记录/切图20261112/icons';O.mkdir(parents=True,exist_ok=True)
manifest=[]; icons={};srcs={}
def ref(sid):
 p=next((R/'效果图').glob(sid+'*.png'));srcs[sid]=p;return Image.open(p).convert('RGBA')
def crop(sid,box):
 im=ref(sid);s=im.width/500;return im.crop(tuple(round(v*s) for v in box))
def cut(sid,box,kind,poly=None):
 im=crop(sid,box);a=np.array(im);rgb=a[:,:,:3].astype(float);r,g,b=rgb.transpose(2,0,1)
 if kind=='white':
  # Dark blue button is excluded by low blue-channel-independent luminance.
  al=np.clip((np.minimum(r,g)-120)/85,0,1);a[:,:,:3]=np.stack([np.maximum(r,238),np.maximum(g,242),np.maximum(b,246)],2);a[:,:,3]=(al*255).astype('uint8')
 elif kind=='heart':
  al=np.clip(np.minimum((r-g-35)/22,(r-b-32)/20),0,1)
  solid=(al>0.25).astype('uint8')*255;solid=cv2.morphologyEx(solid,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
  contours,_=cv2.findContours(solid,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);mask=np.zeros_like(solid);cv2.drawContours(mask,[max(contours,key=cv2.contourArea)],-1,255,-1)
  a[:,:,3]=np.array(Image.fromarray(mask).filter(ImageFilter.GaussianBlur(.4)))
 elif kind=='gold':
  al=np.clip((r-b-22)/35,0,1);a[:,:,3]=(al*255).astype('uint8')
 elif kind=='bulb':
  al=np.clip((r-b-3)/10,0,1)*np.clip((r-175)/25,0,1);a[:,:,3]=(al*255).astype('uint8')
 elif kind=='poly':
  mask=Image.new('L',(im.width*4,im.height*4));d=ImageDraw.Draw(mask);s=im.width/(box[2]-box[0]);d.polygon([(round((x-box[0])*s*4),round((y-box[1])*s*4)) for x,y in poly],fill=255);polyMask=np.array(mask.resize(im.size,Image.Resampling.LANCZOS))
  init=np.where(polyMask>100,cv2.GC_PR_FGD,cv2.GC_BGD).astype('uint8')
  sure=cv2.erode((polyMask>200).astype('uint8'),np.ones((7,7),np.uint8))>0
  if box[0]>300: # hammer: cream background must never become foreground
   sure &= ((b>r+8)|((r-g>25)&(r-b>30)))
  elif sid=='S18':sure &= ((b>g+25)|((r-b>30)&(r-g>15)))
  init[sure]=cv2.GC_FGD
  init[0,:]=cv2.GC_BGD;init[-1,:]=cv2.GC_BGD;init[:,0]=cv2.GC_BGD;init[:,-1]=cv2.GC_BGD
  bgModel=np.zeros((1,65),np.float64);fgModel=np.zeros((1,65),np.float64)
  cv2.grabCut(a[:,:,:3].copy(),init,None,bgModel,fgModel,5,cv2.GC_INIT_WITH_MASK)
  keep=((init==cv2.GC_FGD)|(init==cv2.GC_PR_FGD)).astype('uint8')*255
  # soften a fraction of a source pixel; bound by hand silhouette
  keep=np.minimum(np.array(Image.fromarray(keep).filter(ImageFilter.GaussianBlur(.35))),polyMask)
  a[:,:,3]=keep
 elif kind=='coin':
  mask=Image.new('L',(im.width*4,im.height*4));d=ImageDraw.Draw(mask);d.ellipse((3*4,2*4,(im.width-4)*4,(im.height-4)*4),fill=255);a[:,:,3]=np.array(mask.resize(im.size,Image.Resampling.LANCZOS))
 else:raise ValueError(kind)
 # tiny edge noise and retain genuine multiple glyph components (bulb rays / help dot).
 labels,n=cv2.connectedComponents((a[:,:,3]>30).astype('uint8'));out=a[:,:,3].copy()
 for i in range(1,labels):
  if (n==i).sum()<4:out[n==i]=0
 a[:,:,3]=out
 return Image.fromarray(a)
def save(id,name,im,sid,method,state='normal'):
 im=im.crop(im.getbbox());im=im.resize((im.width*2,im.height*2),Image.Resampling.LANCZOS);out=Image.new('RGBA',(im.width+6,im.height+6));out.alpha_composite(im,(3,3));p=O/(id+('_'+state if id=='icon_chest' else '')+'.png');out.save(p);icons[id+'_'+state]=out
 existing=next((e for e in manifest if e['id']==id),None)
 if existing:
  if list(out.size)!=existing['size']:raise ValueError('state size mismatch')
  existing['states'][state]=p.relative_to(R/'素材').as_posix();existing['sha256'][state]=hashlib.sha256(p.read_bytes()).hexdigest()
 else:
  manifest.append(dict(id=id,name=name,states={state:p.relative_to(R/'素材').as_posix()},size=list(out.size),scale=2,anchor=[.5,.5],source=sid+' '+method,sourceFile=srcs[sid].relative_to(R).as_posix() if sid in srcs else None,sourceSha256=hashlib.sha256(srcs[sid].read_bytes()).hexdigest() if sid in srcs else None,priority='P0',sha256={state:hashlib.sha256(p.read_bytes()).hexdigest()}))
 return out
specs=[
('icon_coin','圆形蜜蜂金币','S02',(295,24,342,70),'coin'),
('icon_energy','体力红心','S02',(179,27,220,65),'heart'),
('icon_settings','设置齿轮','S02',(442,28,482,66),'white'),
('icon_home','回家房子','S04',(31,33,66,65),'white'),
('icon_back','返回箭头','S19',(101,31,141,65),'white'),
('icon_help','帮助问号','S19',(438,30,468,67),'white'),
('icon_undo','撤销箭头','S04',(77,953,131,1003),'white'),
('icon_replay','重玩循环箭头','S04',(223,953,277,1002),'white'),
('icon_hint','提示灯泡','S04',(371,948,424,1006),'bulb'),
('icon_endless','蜂巢块','S02',(415,111,474,166),'gold'),
('icon_honeycomb_deco','双六角装饰','S04',(328,126,368,162),'gold'),
]
for id,name,sid,box,kind in specs:save(id,name,cut(sid,box,kind),sid,'原图精细去底；2倍采样')
poly_specs=[
('icon_signin','日历蜜蜂','S02',(25,100,82,165),[(26,126),(31,120),(35,120),(35,108),(39,102),(43,104),(43,119),(57,119),(58,106),(62,102),(66,105),(66,119),(73,120),(79,124),(81,150),(79,160),(72,164),(34,163),(27,158)]),
('icon_task','任务清单','S02',(25,200,82,265),[(27,221),(33,216),(38,216),(39,210),(45,208),(48,203),(53,203),(57,209),(64,209),(68,216),(76,216),(81,222),(80,255),(75,263),(32,263),(26,257)]),
('icon_build','建造锤子','S02',(352,1013,398,1060),[(355,1048),(369,1031),(360,1023),(368,1015),(376,1014),(393,1024),(395,1037),(390,1044),(379,1038),(365,1056),(359,1056)]),
('icon_coin_pile','金币堆','S19',(150,489,219,550),[(160,516),(164,510),(163,503),(171,496),(183,491),(196,492),(207,501),(209,510),(216,519),(216,534),(204,545),(186,547),(169,543),(157,541),(151,532),(152,523)]),
('icon_gift','紫金礼盒','S18',(190,749,267,826),[(192,781),(193,770),(203,768),(201,760),(207,754),(214,754),(224,759),(228,765),(236,755),(245,753),(252,758),(253,765),(262,768),(264,779),(260,784),(260,812),(245,821),(225,825),(198,818),(195,812),(195,785)]),
]
for id,name,sid,box,poly in poly_specs:
 if id=='icon_coin_pile':continue
 save(id,name,cut(sid,box,'poly',poly),sid,'原图轮廓蒙版去底；2倍采样')
coin=cut('S02',(295,24,342,70),'coin');pile=Image.new('RGBA',(132,112))
# Single S02 bee-coin authority even for stacked coins.
for xy,sz in [((37,56),(82,42)),((4,56),(82,42)),((11,48),(82,42)),((42,48),(82,42)),((30,31),(82,42)),((27,8),(82,82))]:pile.alpha_composite(coin.resize(sz,Image.Resampling.LANCZOS),xy)
save('icon_coin_pile','金币堆',pile,'S02','圆形蜜蜂金币堆叠，按3.1统一；未使用S19异形币')
# Approved new icon (map) drawn at 2x with the same golden outlines / cyan-teal facets.
def gradient_shape(size,points,top,bottom,outline,width=4):
 im=Image.new('RGBA',size);m=Image.new('L',size);ImageDraw.Draw(m).polygon(points,fill=255);a=np.zeros((size[1],size[0],4),dtype='uint8')
 for y in range(size[1]):
  t=y/(size[1]-1);a[y,:,:3]=[round(c*(1-t)+d*t) for c,d in zip(top,bottom)];a[y,:,3]=np.array(m)[y]
 im=Image.fromarray(a);ImageDraw.Draw(im).line(points+[points[0]],fill=outline,width=width,joint='curve');return im
im=Image.new('RGBA',(100,100));d=ImageDraw.Draw(im)
for pts,t,b in [([(9,27),(34,15),(34,79),(9,90)],(255,242,184),(220,167,84)), ([(34,15),(63,29),(63,91),(34,79)],(119,223,219),(16,137,161)), ([(63,29),(89,14),(89,78),(63,91)],(255,241,186),(235,186,103))]: im.alpha_composite(gradient_shape(im.size,pts,t,b,(135,103,62,255),3))
d=ImageDraw.Draw(im);d.line([(18,60),(27,47),(45,59),(55,51),(75,58)],fill='#fff4c0',width=4);d.ellipse((65,34,82,51),fill='#ef696b',outline='#b44759',width=2);d.polygon([(70,47),(77,48),(74,60)],fill='#e96369');save('icon_map','地图','' if False else im,'S02','同风格新增；折叠地图与定位标')
# Honey drop XP, explicitly allowed by 4.2.
im=Image.new('RGBA',(90,104));mask=Image.new('L',im.size);d=ImageDraw.Draw(mask);d.polygon([(45,7),(70,42),(79,61),(78,76),(69,90),(53,97),(35,97),(19,88),(12,75),(13,59),(22,41)],fill=255)
a=np.zeros((104,90,4),dtype='uint8')
for y in range(104):t=y/104;a[y,:,:3]=(255,round(235-92*t),round(100-78*t));a[y,:,3]=np.array(mask)[y]
im=Image.fromarray(a);d=ImageDraw.Draw(im);d.line([(45,7),(70,42),(79,61),(78,76),(69,90),(53,97),(35,97),(19,88),(12,75),(13,59),(22,41),(45,7)],fill='#c87c1c',width=3,joint='curve');d.arc((22,43,68,85),155,260,fill='#fff7b5',width=6);save('icon_exp','经验蜂蜜滴',im,'S02','按v2金色描边与上左光照新增')
# Task chest follows S18 purple/gold gift-box silhouette; state canvases match.
base=icons['icon_gift_normal'];canvas=Image.new('RGBA',(base.width+32,base.height+80));canvas.alpha_composite(base,(16,80));save('icon_chest','任务宝箱',canvas,'S18','紫金宝箱闭合；去底派生',state='closed')
# Work on the high-resolution gift cutout: keep base, lift lid, expose golden interior.
opened=Image.new('RGBA',canvas.size);bw,bh=base.size;split=int(bh*.46);body=base.crop((0,split,bw,bh));opened.alpha_composite(body,(16,80+split));d=ImageDraw.Draw(opened);d.ellipse((20,80+split-15,bw+10,80+split+16),fill='#54218b',outline='#efbe56',width=4)
lid=base.crop((0,0,bw,split+6)).rotate(-10,resample=Image.Resampling.BICUBIC,expand=True);opened.alpha_composite(lid,((canvas.width-lid.width)//2,24))
# Trim states with shared bounds, then save without independent cropping.
def chest_save():
 for item in list(manifest):
  if item['id']=='icon_chest':manifest.remove(item)
 # save() strips empty pixels so pad with identical tiny alpha silhouette extreme points (not needed: common canvas used directly).
 for state,im in [('closed',canvas),('open',opened)]:
  im=im.resize((canvas.width,canvas.height),Image.Resampling.LANCZOS);p=O/f'icon_chest_{state}.png';im.save(p);icons['icon_chest_'+state]=im
  entry=next((x for x in manifest if x['id']=='icon_chest'),None)
  if not entry:entry=dict(id='icon_chest',name='任务宝箱',states={},size=list(im.size),scale=2,anchor=[.5,.5],source='S18 紫金宝箱去底，开盖派生；统一状态画布',sourceFile=srcs['S18'].relative_to(R).as_posix(),sourceSha256=hashlib.sha256(srcs['S18'].read_bytes()).hexdigest(),priority='P0',sha256={});manifest.append(entry)
  entry['states'][state]=p.relative_to(R/'素材').as_posix();entry['sha256'][state]=hashlib.sha256(p.read_bytes()).hexdigest()
chest_save()
(REC/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',15)
for bg in ['white','navy','checker']:
 sheet=Image.new('RGB',(1000,5*210),'#eeeeee' if bg=='white' else '#0e2a5c');dd=ImageDraw.Draw(sheet)
 if bg=='checker':
  for y in range(0,sheet.height,14):
   for x in range(0,sheet.width,14):dd.rectangle((x,y,x+13,y+13),fill='#d9dfe5' if (x//14+y//14)%2 else '#fff')
 for i,(name,im) in enumerate(icons.items()):
  x=(i%5)*200;y=(i//5)*210;im=ImageOps.contain(im,(170,160));sheet.paste(im,(x+(200-im.width)//2,y+10),im);dd.text((x+4,y+177),name.replace('icon_',''),font=font,fill='black' if bg!='navy' else 'white')
 sheet.save(REC/f'contact_{bg}.png')
print('icons',len(manifest),'png',len(list(O.glob('*.png'))))

# Finish the newly drawn icons at 4x supersampling, preserving fixed canvases.
import runpy
runpy.run_path(str(REC/'polish_icons.py'),run_name='__main__')
