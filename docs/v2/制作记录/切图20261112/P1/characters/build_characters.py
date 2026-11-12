"""Normalize native RGBA character renders; source artwork and prompts remain immutable."""
from pathlib import Path
import hashlib,json
import numpy as np
from scipy import ndimage as nd
from PIL import Image,ImageDraw,ImageFont,ImageFilter
R=Path('docs/v2'); REC=R/'制作记录/切图20261112/P1/characters';OUT=R/'素材/角色';OUT.mkdir(parents=True,exist_ok=True)
SIZE=(384,400);ANCHOR=[.5,.95]
NAMES={'bee_wave':'护目镜蜜蜂挥手','bee_fly':'护目镜蜜蜂侧身飞行','bee_celebrate':'护目镜蜜蜂欢呼','bee_worry':'护目镜蜜蜂苦恼','bee_peek':'护目镜蜜蜂探头','bee_loading':'护目镜蜜蜂抱蜜罐','bee_builder':'安全帽蜜蜂敲打'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def clean(im):
 im=im.convert('RGBA');a=np.asarray(im.getchannel('A')).copy()
 # Clear disconnected alpha islands; opening removes 1px segmentation whiskers.
 support=a>25
 support=nd.binary_opening(support,structure=nd.generate_binary_structure(2,1),iterations=2)
 labels,n=nd.label(support)
 if n: support=labels==(np.argmax(np.bincount(labels.ravel())[1:])+1)
 # A small feather reproduces AA after the noise removal without retaining white fringe.
 mask=Image.fromarray(np.uint8(support)*255).filter(ImageFilter.GaussianBlur(.65))
 final=np.minimum(a,np.asarray(mask));im.putalpha(Image.fromarray(final))
 return im
MAN=[]; rendered=[]
def entry(id,paths,source,frames=False):
 raw=REC/(source+'_raw.png');prompt=REC/(source+'_prompt.txt')
 e={'id':id,'name':NAMES[id],'size':list(SIZE),'scale':1,'slice':None,'anchor':ANCHOR,'source':'S02护目镜蜜蜂统一身份，S01材质参考；gpt-image-2逐姿态重绘，保留原生RGBA并清理alpha噪点','sourceFile':str(raw.relative_to(R)).replace('\\','/'),'sourceSha256':sha(raw),'priority':'P1','batch':'P1-1','referenceFiles':[{ 'file':str(next((R/'效果图').glob(s+'_*')).relative_to(R)).replace('\\','/'),'sha256':sha(next((R/'效果图').glob(s+'_*')))} for s in ['S02','S01']],'promptFile':str(prompt.relative_to(R)).replace('\\','/'),'promptSha256':sha(prompt),'nativeAlpha':True,'feetBaseline':380,'alphaProcessing':'largest connected silhouette; 2px binary opening at raw resolution; 0.65px feather; no RGB key replacement'}
 if frames:
  e['frames']=[str(p.relative_to(R/'素材')).replace('\\','/') for p in paths];e['fps']=8;e['sha256']={str(i+1).zfill(2):sha(p) for i,p in enumerate(paths)};e['frameOrder']=['锤子抬起','锤子下挥','锤子落下'];e['loop']=True
 else:e['states']={'normal':str(paths[0].relative_to(R/'素材')).replace('\\','/')};e['sha256']={'normal':sha(paths[0])}
 MAN.append(e)
for id in NAMES:
 raw=Image.open(REC/(id+'_raw.png')).convert('RGBA')
 if id=='bee_builder':
  assert raw.width==raw.height*3,raw.size
  ims=[clean(raw.crop((i*raw.height,0,(i+1)*raw.height,raw.height))) for i in range(3)]
  bbs=[im.getbbox() for im in ims];fac=min(348/max(b[2]-b[0] for b in bbs),360/max(b[3]-b[1] for b in bbs))
 else:
  ims=[clean(raw)];bbs=[ims[0].getbbox()];b=bbs[0];fac=min(348/(b[2]-b[0]),360/(b[3]-b[1]))
 paths=[]
 for i,(im,b) in enumerate(zip(ims,bbs)):
  # Use lower-foot alpha center so varying hammer extent cannot shift builder's feet.
  a=np.asarray(im.getchannel('A'));ys,xs=np.where((a>100)&(np.indices(a.shape)[0]>b[3]-max(5,int((b[3]-b[1])*.055))))
  footcenter=(xs.min()+xs.max())/2 if len(xs) and id=='bee_builder' else (b[0]+b[2])/2
  crop=im.crop(b);crop=crop.resize((round(crop.width*fac),round(crop.height*fac)),Image.Resampling.LANCZOS)
  x=round(192-(footcenter-b[0])*fac);y=380-crop.height
  canvas=Image.new('RGBA',SIZE);canvas.alpha_composite(crop,(x,y))
  path=OUT/('bee_builder/'+f'bee_builder_{i+1:02}.png' if id=='bee_builder' else id+'.png');path.parent.mkdir(parents=True,exist_ok=True);canvas.save(path);paths.append(path);rendered.append((path.stem,canvas))
 entry(id,paths,id,id=='bee_builder')
(REC/'manifest.json').write_text(json.dumps(MAN,ensure_ascii=False,indent=2),encoding='utf-8')
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16)
cs=Image.new('RGB',(1152,len(rendered)*420),'#ddd');d=ImageDraw.Draw(cs)
for row,(id,im) in enumerate(rendered):
 for col in range(3):
  tile=Image.new('RGBA',(384,420),'white' if col==0 else '#0E2A5C');td=ImageDraw.Draw(tile)
  if col==2:
   for y in range(0,420,16):
    for x in range(0,384,16):td.rectangle((x,y,x+15,y+15),fill='#ddd' if (x//16+y//16)%2==0 else '#aaa')
  tile.alpha_composite(im,(0,20));cs.paste(tile.convert('RGB'),(col*384,row*420));d.text((col*384+8,row*420+2),id,fill='#e52a2a',font=font)
cs.save(REC/'三底检查.png')
# One-row small contact sheet for rapid identity review, not a replacement for the full edge checks.
contact=Image.new('RGB',(384*len(rendered),430),'#0E2A5C');d=ImageDraw.Draw(contact)
for i,(id,im) in enumerate(rendered):contact.paste(im,(i*384,24),im);d.text((i*384+8,4),id,fill='white',font=font)
contact.resize((len(rendered)*192,215),Image.Resampling.LANCZOS).save(REC/'姿态总览.jpg')
frames=[Image.open(p).convert('RGBA') for p in OUT.glob('bee_builder/*.png')]
checks=[]
for im in frames:
 bg=Image.new('RGBA',SIZE,'#0E2A5C');bg.alpha_composite(im);checks.append(bg.convert('RGB'))
checks[0].save(REC/'builder_animation.gif',save_all=True,append_images=checks[1:]+checks[-2:0:-1],duration=125,loop=0,disposal=2)
results=[]
for name,im in rendered:
 bb=im.getbbox();assert im.mode=='RGBA' and im.size==SIZE
 assert bb[0]>=3 and bb[1]>=3 and SIZE[0]-bb[2]>=3 and SIZE[1]-bb[3]>=3,(name,bb)
 results.append({'id':name,'mode':im.mode,'size':list(SIZE),'alphaBBox':list(bb),'safeBorder':'PASS','text':'none'})
(REC/'verification.json').write_text(json.dumps({'status':'technical PASS; visual pending','count':len(rendered),'uniformCanvas':list(SIZE),'anchor':ANCHOR,'results':results,'referenceIdentity':'S02 goggles bee; S01 materials','generation':'bundled image_gen.py fallback CLI with configured provider; gpt-image-2; returned native RGBA despite prompt chroma key request'},ensure_ascii=False,indent=2),encoding='utf-8')
print(len(MAN),'asset records;',len(rendered),'RGBA PNG; technical checks pass')
