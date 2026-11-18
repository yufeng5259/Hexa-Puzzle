"""P2-13 A: analytic native geometry and vector retracing, never bitmap upscaling."""
from pathlib import Path
from io import BytesIO
import hashlib,json,subprocess,math,shutil,os
import numpy as np,cv2
from PIL import Image,ImageDraw,ImageFilter
from scipy import ndimage as ndi
from scipy.interpolate import RectBivariateSpline

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3];ART=ROOT/'素材'
BEFORE=HERE/'before';BEFORE.mkdir(exist_ok=True)
SPEC=[]
for col in ['green','blue','grey']:
 for state in ['normal','pressed','disabled']:SPEC.append(f'UI/通用/btn_{col}_{state}.png')
for stem,folder,states in [('btn_close','通用',['normal','pressed']),('hud_btn_square_blue','HUD',['normal','pressed']),('hud_btn_square_purple','HUD',['normal','pressed']),('toggle_knob','通用',['on','off','disabled']),('toggle_track','通用',['on','off','disabled'])]:
 for state in states:SPEC.append(f'UI/{folder}/{stem}_{state}.png')
SPEC += ['UI/主页/home_side_entry.png','UI/主页/home_side_label.png','UI/图标/icon_back.png','UI/通用/logo_title.png']
assert len(SPEC)==25
for rel in SPEC:
 p=BEFORE/rel;p.parent.mkdir(parents=True,exist_ok=True)
 if not p.exists():shutil.copyfile(ART/rel,p)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def old(rel):return Image.open(BEFORE/rel).convert('RGBA')
K=8
def gradient(size,a,b):
 w,h=size;ys=np.linspace(0,1,h)[:,None,None];c=np.asarray(a)[None,None,:]*(1-ys)+np.asarray(b)[None,None,:]*ys
 return Image.fromarray(np.uint8(np.broadcast_to(c,(h,w,3)).copy())).convert('RGBA')
def mask(size,box,r):
 im=Image.new('L',size);ImageDraw.Draw(im).rounded_rectangle(box,radius=r,fill=255);return im
def rounded(size,top,bottom,edge,r):
 w,h=size;sz=(w*K,h*K);im=gradient(sz,top,bottom);a=mask(sz,(3*K,3*K,(w-4)*K,(h-4)*K),r*K);im.putalpha(a);d=ImageDraw.Draw(im)
 for k,col in [(1,edge),(3,tuple(min(255,v+24) for v in edge)),(5,tuple(min(255,v+44) for v in top))]:
  d.rounded_rectangle(((3+k)*K,(3+k)*K,(w-4-k)*K,(h-4-k)*K),radius=max(2,r-k)*K,outline=tuple(col)+(255,),width=2*K)
 im.putalpha(a);return im
def finish(im,rel):
 size=old(rel).size;im=im.resize((size[0]*2,size[1]*2),Image.Resampling.LANCZOS)
 a=np.asarray(im).copy();a[:6]=0;a[-6:]=0;a[:,:6]=0;a[:,-6:]=0;a[a[:,:,3]==0]=0
 out=Image.fromarray(a);out.save(ART/rel);return out
def capsule(col,state):
 rel=f'UI/通用/btn_{col}_{state}.png'
 # Use the exact P2-2 palette authority before its analytic reconstruction.
 original=f'docs/v2/素材/{rel}'
 try:src=Image.open(BytesIO(subprocess.check_output(['git','show','ab4db64:'+original],stderr=subprocess.DEVNULL))).convert('RGBA')
 except subprocess.CalledProcessError:
  src=Image.open(BytesIO(subprocess.check_output(['git','show','ab4db64:docs/v2/素材/UI/通用/btn_grey_normal.png']))).convert('RGBA')
  a=np.array(src);rgb=a[:,:,:3].astype(float);lum=rgb@np.array([.2126,.7152,.0722]);a[:,:,:3]=np.uint8(np.clip(lum[:,:,None]*.52+np.array([65,70,81]),0,255));src=Image.fromarray(a)
 a=np.array(src).astype(float);h,w=a.shape[:2];center=a[:,w//2,:3];top=center[round(h*.32)];bottom=center[round(h*.67)]
 y,x=np.mgrid[:92*K,:240*K].astype(float);x=(x+.5)/K;y=(y+.5)/K
 nx=x-np.clip(x,46,194);ny=y-46;rad=np.hypot(nx,ny);inset=43-rad
 f=np.clip((y-10)/72,0,1)[:,:,None];color=top[None,None,:]*(1-f)+bottom[None,None,:]*f
 normal_y=ny/np.maximum(rad,1);normal_x=nx/np.maximum(rad,1);facing=np.clip(-normal_y*.90-normal_x*.18,0,1)
 rim=np.exp(-((inset-3)/2.3)**2)*facing*.72;color=color*(1-rim[:,:,None])+np.array([235,255,253])[None,None,:]*rim[:,:,None]
 lower=np.exp(-((inset-3)/2.7)**2)*np.clip(normal_y,0,1)*.35;outer=np.clip((2-inset)/2,0,1)*.28;color*=((1-lower)*(1-outer))[:,:,None]
 sheen=np.exp(-((inset-8)/4)**2)*facing*.12;color=color*(1-sheen[:,:,None])+255*sheen[:,:,None]
 im=Image.fromarray(np.uint8(np.clip(color,0,255))).convert('RGBA');im.putalpha(Image.fromarray(np.uint8(np.clip(inset*K+.5,0,1)*255)));return finish(im,rel)
def path_for(mask):
 contours,_=cv2.findContours(np.uint8(mask)*255,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE);parts=[]
 for c in contours:
  if cv2.contourArea(c)<.6:continue
  p=cv2.approxPolyDP(c,.22,True)[:,0,:].astype(float)+.5
  if len(p)<3:continue
  mid=(p+np.roll(p,-1,axis=0))/2
  s=f'M{mid[-1,0]:.3f},{mid[-1,1]:.3f}'
  for point,end in zip(p,mid):s+=f' Q{point[0]:.3f},{point[1]:.3f} {end[0]:.3f},{end[1]:.3f}'
  parts.append(s+'Z')
 return ' '.join(parts)
def retrace(rel):
 im=old(rel);a=np.array(im);rgb=a[:,:,:3];alpha=a[:,:,3];foreground=alpha>127
 _,idx=ndi.distance_transform_edt(~foreground,return_indices=True);rgb=rgb[idx[0],idx[1]]
 q=Image.fromarray(rgb).quantize(colors=64,method=Image.Quantize.MEDIANCUT);indices=np.array(q);pal=np.array(q.getpalette()).reshape(-1,3)
 # Native vector contours retain every material region; outer shape is independent.
 shape=path_for(foreground);dom=int(np.bincount(indices[foreground]).argmax());c=pal[dom];layers=[f'<path d="{shape}" fill="#{c[0]:02x}{c[1]:02x}{c[2]:02x}" fill-rule="evenodd"/>']
 for i in np.unique(indices[foreground]):
  d=path_for((indices==i)&foreground)
  if d:layers.append(f'<path d="{d}" fill="#{pal[i,0]:02x}{pal[i,1]:02x}{pal[i,2]:02x}" stroke="#{pal[i,0]:02x}{pal[i,1]:02x}{pal[i,2]:02x}" stroke-width="1.1" fill-rule="evenodd"/>')
 w,h=im.size;svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w*2}" height="{h*2}" viewBox="0 0 {w} {h}"><defs><clipPath id="sil"><path d="{shape}" fill-rule="evenodd"/></clipPath></defs><g clip-path="url(#sil)">'+''.join(layers)+'</g></svg>'
 source=HERE/(Path(rel).stem+'.svg');source.write_text(svg,encoding='utf8')
 return dict(source=source.name,out=Path(os.path.relpath(ART/rel,HERE)).as_posix(),width=w*2,height=h*2)

def fit_colour_fields():
 """Rebuild crop-derived art from traced geometry and continuous colour fields.

 The SVG defines the new antialiased silhouette. Lighting is a spline field
 fitted from original colour samples, independently evaluated on the new canvas;
 the old RGBA bitmap is never resized or embedded into the native master.
 """
 for rel in SPEC:
  if any(k in rel for k in ['btn_green','btn_blue','btn_grey','btn_close','toggle_']):continue
  im=old(rel);a=np.array(im);alpha=a[:,:,3];rgb=a[:,:,:3]
  # Outside samples receive their nearest foreground edge colour, not a matte.
  _,idx=ndi.distance_transform_edt(alpha<96,return_indices=True);rgb=rgb[idx[0],idx[1]]
  h,w=alpha.shape;xx=(np.arange(w*2)+.5)/2-.5;yy=(np.arange(h*2)+.5)/2-.5
  result=np.stack([RectBivariateSpline(np.arange(h),np.arange(w),rgb[:,:,c].astype(float),kx=3,ky=3,s=0)(yy,xx) for c in range(3)],axis=2)
  # Reconstruct the implicit outline from signed distances, including the logo's
  # tiny isolated highlights which an area-based vector contour can omit.
  solid=alpha>127;sdf=ndi.distance_transform_edt(solid)-ndi.distance_transform_edt(~solid)
  sdf=ndi.gaussian_filter(sdf,.55 if 'logo_title' in rel else .35)
  field=RectBivariateSpline(np.arange(h),np.arange(w),sdf,kx=3,ky=3,s=0)(yy,xx)
  coverage=np.clip((field+.7)/1.4,0,1);coverage=coverage*coverage*(3-2*coverage)
  ar=np.zeros((h*2,w*2,4),dtype=np.uint8);ar[:,:,:3]=np.uint8(np.clip(result,0,255));ar[:,:,3]=np.uint8(np.round(coverage*255));ar[ar[:,:,3]==0]=0;Image.fromarray(ar).save(ART/rel)

if __name__=='__main__':
 if len(__import__('sys').argv)>1 and __import__('sys').argv[1]=='fit-colour-fields':
  fit_colour_fields();print('8 vector silhouettes with continuous colour fields rebuilt');raise SystemExit
 for col in ['green','blue','grey']:
  for state in ['normal','pressed','disabled']:capsule(col,state)
 for state,top,bot in [('on',(60,232,182),(4,141,145)),('off',(191,205,224),(99,121,151)),('disabled',(181,188,200),(134,144,160))]:
  finish(rounded((186,78),top,bot,tuple(max(0,v-20) for v in bot),36),f'UI/通用/toggle_track_{state}.png')
  finish(rounded((68,68),(255,255,255),(226,234,244) if state!='disabled' else (193,201,214),(227,241,252),32),f'UI/通用/toggle_knob_{state}.png')
 for state in ['normal','pressed']:
  im=rounded((92,92),(152,110,253),(70,39,181),(121,109,231),42);d=ImageDraw.Draw(im);a=92*.37*K;b=92*.63*K;ww=round(92*.085)*K
  d.line((a,a+2*K,b,b+2*K),fill=(28,36,89,160),width=ww+2*K);d.line((b,a+2*K,a,b+2*K),fill=(28,36,89,160),width=ww+2*K);d.line((a,a,b,b),fill='white',width=ww);d.line((b,a,a,b),fill='white',width=ww)
  if state=='pressed':
   arr=np.array(im);arr[:,:,:3]=np.uint8(arr[:,:,:3].astype(float)*.8);im=Image.fromarray(arr)
  finish(im,f'UI/通用/btn_close_{state}.png')
 # Native original HUD bevel is reused through geometry-aware vector retracing of
 # crop-derived art, preserving its exact distinctive material contours.
 jobs=[]
 for rel in SPEC:
  if not any(k in rel for k in ['btn_green','btn_blue','btn_grey','btn_close','toggle_']):jobs.append(retrace(rel))
 (HERE/'render_jobs.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2),encoding='utf8')
 print('17 native analytic exports and 8 vector masters ready')
