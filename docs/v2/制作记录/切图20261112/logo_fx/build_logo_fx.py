"""P0 logo extraction and static effects. Run from Project; never edits references."""
from pathlib import Path
import json, hashlib, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
R=Path('docs/v2'); OUT=R/'素材/UI/特效'; REC=R/'制作记录/切图20261112/logo_fx'
OUT.mkdir(parents=True,exist_ok=True); REC.mkdir(parents=True,exist_ok=True)
MAN=[]
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def save(im, id, name, source, path=None, scale=1, sourcefile=None):
    path=path or OUT/(id+'.png'); path.parent.mkdir(parents=True,exist_ok=True); im.save(path)
    entry={'id':id,'name':name,'states':{'normal':str(path.relative_to(R/'素材')).replace('\\','/')},'size':list(im.size),'scale':scale,'slice':None,'anchor':[.5,.5],'source':source,'priority':'P0','sha256':{'normal':sha(path)}}
    if sourcefile: entry['sourceFile']=str(sourcefile.relative_to(R)).replace('\\','/'); entry['sourceSha256']=sha(sourcefile)
    MAN.append(entry)
src=next((R/'效果图').glob('S01_*')); im=Image.open(src).convert('RGB'); a=np.asarray(im,dtype=float)
# White wordmark: solve foreground white against the locally sampled blue sky.
box=(208,54,645,299); c=a[box[1]:box[3],box[0]:box[2]].copy(); h,w=c.shape[:2]; alpha=np.zeros((h,w))
for y in range(h):
    yy=y+box[1]
    left=np.median(a[yy,170:205],axis=0); right=np.median(a[yy,650:685],axis=0)
    for x in range(w):
        r,g,b=c[y,x]
        bg=left*(1-(x+box[0]-187)/480)+right*((x+box[0]-187)/480)
        if yy>=200:
            aa=np.clip((r-bg[0])/(255-bg[0]),0,1)
            if aa>.04:
                alpha[y,x]=aa
                c[y,x]=[255,255,255]
        else:
            # The emblem has no blue surfaces: remove blue sky, preserve honey-gold/leaf/white highlights.
            bg_like=b>r*1.35 and b>g*1.15
            alpha[y,x]=0 if bg_like else 1
# Exclude all tiny isolated background fragments, retain original internal holes.
mask=Image.fromarray((alpha*255).astype('uint8'))
# emblem threshold has a 1px AA transition, text alpha is a true blue-unmatte.
upper=mask.crop((0,0,w,146)).filter(ImageFilter.GaussianBlur(.35)); mask.paste(upper,(0,0))
logo=Image.fromarray(np.uint8(np.clip(c,0,255))).convert('RGBA'); logo.putalpha(mask)
bb=logo.getbbox(); logo=logo.crop(bb); canvas=Image.new('RGBA',(logo.width+6,logo.height+6));canvas.alpha_composite(logo,(3,3))
save(canvas,'logo_title','蜂巢小镇标题与蜂巢叶片标志','S01 原像素透明抠图，文字特许；原框 [208,54,645,299]',R/'素材/UI/通用/logo_title.png',sourcefile=src)
# Physically soft, honey-gold radial burst: energy is alpha, no opaque dark border.
n=512; yy,xx=np.mgrid[0:n,0:n]; dx=(xx-(n-1)/2)/252;dy=(yy-(n-1)/2)/252; radius=np.sqrt(dx*dx+dy*dy);theta=np.arctan2(dy,dx)
beam=(.5+.5*np.cos(theta*18+.25))**16
halo=np.exp(-radius*radius*8)*.24
rays=beam*np.exp(-radius*radius*3)*(1-np.minimum(radius,1))*.36
al=np.clip(halo+rays,0,.5); al[radius>=.985]=0
rgba=np.zeros((n,n,4),dtype=np.uint8);rgba[:,:,:3]=[255,220,112];rgba[:,:,3]=np.uint8(al*255)
save(Image.fromarray(rgba),'fx_glow_burst','庆祝金色放射光','新增；匹配 S02/S04 蜂蜜金高光，18道柔和光束',sourcefile=next((R/'效果图').glob('S04_*')))
# Confetti is a single isolated thick ribbon per file, with subtle bevel and clean 3px safe edge.
colors=[('#ffe05a','#d88819'),('#6be8e5','#0799af'),('#b69aff','#6f42c9'),('#ffb6d1','#db5d91')]
for i,(hi,lo) in enumerate(colors,1):
    s=4; cf=Image.new('RGBA',(40*s,44*s));d=ImageDraw.Draw(cf)
    d.polygon([(5*s,9*s),(26*s,4*s),(35*s,31*s),(14*s,38*s)],fill=lo)
    d.polygon([(5*s,9*s),(25*s,4*s),(30*s,29*s),(11*s,34*s)],fill=hi)
    d.line([(6*s,9*s),(24*s,5*s)],fill='#fff4d4',width=2*s)
    cf=cf.resize((40,44),Image.Resampling.LANCZOS)
    # Zero only the nominal 3px external border.
    for y in range(44):
      for x in range(40):
       if x<3 or x>=37 or y<3 or y>=41: cf.putpixel((x,y),(0,0,0,0))
    save(cf,f'fx_confetti_{i:02}','彩带单片 '+str(i),'新增；匹配 S02/S04 饱和彩色宽倒角',sourcefile=next((R/'效果图').glob('S04_*')))
# Flying currency exactly reuses canonical round bee coin and canonical XP icon.
for id,source_id,name in [('fx_coin_fly','icon_coin','飞入小蜜蜂圆金币'),('fx_exp_fly','icon_exp','飞入经验')]:
    p=R/f'素材/UI/图标/{source_id}.png'
    if p.exists():
        icon=Image.open(p).convert('RGBA'); bb=icon.getbbox(); icon=icon.crop(bb); icon.thumbnail((42,42),Image.Resampling.LANCZOS)
        cf=Image.new('RGBA',(48,48));cf.alpha_composite(icon,((48-icon.width)//2,(48-icon.height)//2));save(cf,id,name,'复用 P0 唯一规范图标缩小',sourcefile=p)
# Contact sheet: all isolated assets on required white/navy/check backgrounds.
items=[]
for e in MAN:
 p=R/'素材'/e['states']['normal']; items.append((e['id'],Image.open(p).convert('RGBA')))
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',14)
cs=Image.new('RGB',(1050,len(items)*175),'#ddd');cd=ImageDraw.Draw(cs)
for row,(id,img) in enumerate(items):
 for col in range(3):
  tile=Image.new('RGBA',(350,175),'white' if col==0 else '#0E2A5C'); td=ImageDraw.Draw(tile)
  if col==2:
   for y in range(0,175,12):
    for x in range(0,350,12): td.rectangle((x,y,x+11,y+11),fill='#eeeeee' if (x//12+y//12)%2==0 else '#bbbbbb')
  small=img.copy();small.thumbnail((320,135),Image.Resampling.LANCZOS);tile.alpha_composite(small,((350-small.width)//2,22+(140-small.height)//2));cs.paste(tile.convert('RGB'),(col*350,row*175));cd.text((col*350+8,row*175+4),id,fill='red',font=font)
cs.save(REC/'三底检查.png')
(REC/'manifest.json').write_text(json.dumps(MAN,ensure_ascii=False,indent=2),encoding='utf-8')
print('Wrote',len(MAN),'assets')
