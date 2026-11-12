"""P1 endless UI extraction and single-cell clear frames. No runtime changes."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageOps,ImageFont
import numpy as np,cv2,hashlib,json,math
R=Path('docs/v2');OUT=R/'素材/UI/无尽';FX=R/'素材/UI/特效/fx_line_clear';REC=R/'制作记录/切图20261112/P1/endless'
for p in (OUT,FX,REC):p.mkdir(parents=True,exist_ok=True)
REF=next((R/'效果图').glob('S19_*.png'));src=Image.open(REF).convert('RGBA');manifest=[]
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def mask_round(size,box,r):
 m=Image.new('L',(size[0]*4,size[1]*4));ImageDraw.Draw(m).rounded_rectangle(tuple(round(v*4) for v in box),radius=r*4,fill=255);return m.resize(size,Image.Resampling.LANCZOS)
def register(id,name,files,slice=None,reuse=None,frames=False):
 p=next(iter(files.values()));im=Image.open(R/'素材'/p);e=dict(id=id,name=name,size=list(im.size),scale=1,anchor=[.5,.5],priority='P1',source='S19 边框原像素提取、无字内面重建',sourceFile=REF.relative_to(R).as_posix(),sourceSha256=h(REF),sha256={k:h(R/'素材'/v) for k,v in files.items()})
 if frames:e.update(frames=list(files.values()),fps=12,frameNames=list(files))
 else:e['states']=files
 if slice:e['slice']=slice
 if reuse:e.update(reuseFrom=reuse,source='4.7 允许与P0拼图背景共用，未修改源文件')
 manifest.append(e)
def save(id,name,im,state='normal',slice=None):
 namefile=id+('_'+state if state!='normal' else '')+'.png';p=OUT/namefile;im.save(p);entry=next((e for e in manifest if e['id']==id),None)
 if entry:
  assert entry['size']==list(im.size);entry['states'][state]=p.relative_to(R/'素材').as_posix();entry['sha256'][state]=h(p)
 else:register(id,name,{state:p.relative_to(R/'素材').as_posix()},slice)
# Reference palettes are rebuilt as blank broad bevel surfaces (no screenshot glyph pixels).
def blank_round(w,hh,r,top,bottom,edge,bevel):
 mask=mask_round((w,hh),(0,0,w-1,hh-1),r);al=np.array(mask);dist=cv2.distanceTransform(np.pad((al>127).astype('uint8'),2),cv2.DIST_L2,5)[2:-2,2:-2];dist=cv2.GaussianBlur(dist,(0,0),.7);gy,gx=np.gradient(dist);t=np.arange(hh)[:,None]/hh;rgb=np.zeros((hh,w,3),float)
 for k in range(3):rgb[:,:,k]=top[k]*(1-t)+bottom[k]*t
 amt=np.exp(-((dist-2)/bevel)**2);light=np.clip((gx+gy)*.4+.55,0,1)
 for k in range(3):rgb[:,:,k]=rgb[:,:,k]*(1-amt*.75)+edge[k]*amt*.75;rgb[:,:,k]+=(gx+gy)*amt*22
 arr=np.dstack([np.clip(rgb,0,255),al]).astype('uint8');c=Image.fromarray(arr);out=Image.new('RGBA',(w+6,hh+6));out.alpha_composite(c,(3,3));return out
panel=blank_round(240,161,49,(15,83,153),(11,67,127),(70,199,244),9);save('endless_score_panel','无尽积分蓝面板',panel,slice=[57,56,57,56])
panel=blank_round(260,129,39,(255,250,237),(242,227,202),(255,254,247),5);save('endless_stage_row','阶段奖励米白行',panel,slice=[45,44,45,44])
# Nodes: six-sided silhouette plus source bevels; dark threshold numbers inpainted.
def node(box,tint):
 c=src.crop(box);a=np.array(c);rgb=a[:,:,:3];rr,gg,bb=rgb.transpose(2,0,1)
 text=((rr<150)&(gg<126)&(np.indices(rr.shape)[0]>42)&(np.indices(rr.shape)[0]<104)&(np.indices(rr.shape)[1]>18)&(np.indices(rr.shape)[1]<124)).astype('uint8')*255
 # Replace the entire blank interior hex face rather than retaining inpainted digit ghosts.
 rgb=a[:,:,:3].copy();w,hh=c.size;fm=Image.new('L',(w*4,hh*4));fd=ImageDraw.Draw(fm);verts=[(w*.5,18),(w-20,hh*.29),(w-20,hh*.70),(w*.5,hh-20),(20,hh*.70),(20,hh*.29)];fd.polygon([(round(x*4),round(y*4)) for x,y in verts],fill=255);fm=fm.resize(c.size,Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(1.2));alpha=np.array(fm)/255
 top,bot=((255,220,80),(255,179,17)) if tint=='reached' else ((221,245,255),(151,197,234))
 for yy in range(hh):
  color=np.array(top)*(1-yy/hh)+np.array(bot)*yy/hh
  rgb[yy]=(rgb[yy]*(1-alpha[yy,:,None])+color*alpha[yy,:,None]).astype('uint8')
 c=Image.fromarray(rgb).convert('RGBA')
 m=Image.new('L',(w*4,hh*4));d=ImageDraw.Draw(m);pts=[(w*.5,2),(w-8,hh*.25),(w-8,hh*.73),(w*.5,hh-3),(3,hh*.73),(3,hh*.26)];d.polygon([(round(x*4),round(y*4)) for x,y in pts],fill=255);m=m.resize(c.size,Image.Resampling.LANCZOS);ar=np.array(c);rr,gg,bb=ar[:,:,:3].transpose(2,0,1).astype(float);edgeAlpha=np.clip((rr-80)/70,0,1) if tint=='reached' else np.clip((np.minimum(rr,gg)-65)/60,0,1);ar[:,:,3]=(np.array(m)*edgeAlpha).astype('uint8');c=Image.fromarray(ar);out=Image.new('RGBA',(w+6,hh+6));out.alpha_composite(c,(3,3));return out
# Equal 146x155 crop canvases; whole silhouette stays 3px inside their shared frame.
for state,box in [('reached',(59,574,205,731)),('unreached',(59,1032,205,1189))]:save('endless_stage_node','阶段六边节点',node(box,state),state)
# Vertical connective strip samples, each shares canvas dimensions and expandable vertical center.
for state,box in [('reached',(111,730,153,812)),('unreached',(111,1194,153,1235))]:
 c=src.crop(box);c=c.resize((42,110),Image.Resampling.LANCZOS);a=np.array(c);r,g,b=a[:,:,:3].transpose(2,0,1).astype(float);alpha=np.clip((r-70)/90,0,1) if state=='reached' else np.clip((g-90)/80,0,1);a[:,:,3]=(alpha*255).astype('uint8');c=Image.fromarray(a);c.putalpha(Image.fromarray(a[:,:,3]).filter(ImageFilter.GaussianBlur(.4)));out=Image.new('RGBA',(48,116));out.alpha_composite(c,(3,3));save('endless_stage_link','节点连接条',out,state,slice=[8,8,8,8])
# Reuse P0 background by reference; source hash is immutable.
register('bg_endless','无尽背景',{'normal':'背景/bg_puzzle.png'},reuse='背景/bg_puzzle.png')

for e in manifest:
 if e['id'] in ('endless_score_panel','endless_stage_row'):e['source']='S19原色参考，无字宽倒角九宫格重建'
manifest[-1]['sourceFile']='素材/背景/bg_puzzle.png';manifest[-1]['sourceSha256']=h(R/'素材/背景/bg_puzzle.png')
# Full-line clear: original 121x105 cell canvas, original mother files are never modified.
files={};W,H=121,105;K=4;xx,yy=np.meshgrid(np.arange(W*K)/K,np.arange(H*K)/K);cx,cy=60,52;r=np.sqrt(((xx-cx)/1.13)**2+(yy-cy)**2);theta=np.arctan2(yy-cy,xx-cx)
for i,(power,spread) in enumerate([(0.35,10),(.80,22),(1.0,39),(.76,45),(.40,48),(.12,50)],1):
 # Soft cyan hex edge pulse and warm central flash; corner alpha constrained to transparent safety border.
 hexr=np.maximum.reduce([np.abs(yy-cy),np.abs(.866*(xx-cx)+.5*(yy-cy)),np.abs(.866*(xx-cx)-.5*(yy-cy))]);ring=np.exp(-((hexr-spread)/3.4)**2);core=np.exp(-(r/(10+spread*.62))**2);rays=(np.maximum(np.cos(theta*6),0)**18)*np.exp(-r/35)
 alpha=np.clip(power*(ring*.70+core*.65+rays*.5),0,1);alpha[(xx<3)|(xx>W-4)|(yy<3)|(yy>H-4)]=0
 warm=np.clip(core*.9,0,1);a=np.zeros((H*K,W*K,4),np.uint8);a[:,:,0]=(100+155*warm).astype('uint8');a[:,:,1]=(225+30*warm).astype('uint8');a[:,:,2]=255;a[:,:,3]=(alpha*255).astype('uint8');im=Image.fromarray(a).resize((W,H),Image.Resampling.LANCZOS)
 # explicitly preserve three-pixel transparent edge after AA reduction
 ar=np.array(im);ar[:3,:,3]=0;ar[-3:,:,3]=0;ar[:,:3,3]=0;ar[:,-3:,3]=0;im=Image.fromarray(ar);p=FX/f'fx_line_clear_{i:02}.png';im.save(p);files[f'{i:02}']=p.relative_to(R/'素材').as_posix()
register('fx_line_clear','满线消除单格光效',files,frames=True);manifest[-1].update(source='新增柔和青蓝/暖白消除光；单格121x105，程序沿线实例播放',sourceFile=None,sourceSha256=None)
(REC/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
(REC/'decisions.json').write_text(json.dumps({'endless_board_frame':{'status':'not_applicable','source':'效果图/S20_无尽对局_BlockHexa风格.png','reason':'实图只有各空槽自带青蓝边沿，没有独立61格棋盘外圈，按4.7如效果图有条件不凭空增加。整棋盘由程序组合既有empty_well母件。'},'bg_endless':{'reuse':'背景/bg_puzzle.png','sourceSHA256':h(R/'素材/背景/bg_puzzle.png'),'modified':False}},ensure_ascii=False,indent=2),encoding='utf8')
print('endless ui manifest entries',len(manifest),'new PNG',len(list(OUT.glob('*.png')))+len(files))
