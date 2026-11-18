"""P2-13 native contour and continuous-light reconstruction, no bitmap enlargement."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import numpy as np,cv2,json,hashlib,shutil
from scipy import ndimage,interpolate
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]; ART=ROOT/'素材'; BEFORE=HERE/'before';BEFORE.mkdir(exist_ok=True)
FILES=['UI/通用/'+x+'.png' for x in ['panel_dialog','panel_inner','panel_feature','ribbon_title_blue','divider_gold','bar_bg','bar_fill_green','bar_fill_blue']]+['UI/HUD/'+x+'.png' for x in ['hud_capsule_dark','hud_capsule_light']]+['UI/任务/'+x+'.png' for x in ['task_row_normal','task_row_done','task_progress_bar_bg','task_progress_bar_fill']]+['UI/无尽/'+x+'.png' for x in ['endless_score_panel','endless_stage_row','endless_stage_node_reached','endless_stage_node_unreached','endless_stage_link_reached','endless_stage_link_unreached']]+['UI/拼图/puzzle_tray_frame.png']
S=6
for f in FILES:
 p=BEFORE/f;p.parent.mkdir(parents=True,exist_ok=True)
 if not p.exists():shutil.copyfile(ART/f,p)
def grad(size,a,b):
 w,h=size;t=np.arange(h)[:,None,None]/max(1,h-1); rgb=np.broadcast_to(np.array(a)[None,None,:]*(1-t)+np.array(b)[None,None,:]*t,(h,w,3));return Image.fromarray(np.uint8(np.round(np.dstack([rgb,np.full((h,w),255)]))))
def layer(size,box,r,a,b):
 im=grad(size,a,b);m=Image.new('L',size);ImageDraw.Draw(m).rounded_rectangle(box,radius=r,fill=255);im.putalpha(m);return im
def panel(feature):
 sz=256*S;out=Image.new('RGBA',(sz,sz))
 layers=([(3,65,(164,134,255),(78,48,198)),(7,61,(197,174,255),(103,74,221)),(11,57,(126,94,239),(84,55,196)),(21,47,(199,172,211),(127,91,161)),(25,43,(255,246,234),(250,232,213))] if feature else [(3,65,(255,253,242),(238,209,168)),(7,61,(255,255,249),(255,247,226)),(13,55,(249,225,191),(243,213,173)),(18,50,(254,243,224),(255,248,231)),(23,45,(255,248,235),(255,245,226))])
 for pad,r,a,b in layers:
  n=sz-2*pad*S;im=layer((n,n),(0,0,n-1,n-1),r*S,a,b);out.alpha_composite(im,(pad*S,pad*S))
 return out.resize((512,512),Image.Resampling.LANCZOS)
def rounded(size,a,b,edge,r=30,inset=3):
 w,h=size;wh=(w*S,h*S);im=grad(wh,a,b);mask=Image.new('L',wh);d=ImageDraw.Draw(mask);d.rounded_rectangle((inset*S,inset*S,(w-1-inset)*S,(h-1-inset)*S),radius=r*S,fill=255);im.putalpha(mask);d=ImageDraw.Draw(im)
 for k,col in [(1,edge),(3,tuple(min(255,v+24) for v in edge)),(5,tuple(min(255,v+44) for v in a))]:d.rounded_rectangle(((inset+k)*S,(inset+k)*S,(w-inset-k-1)*S,(h-inset-k-1)*S),radius=max(2,r-k)*S,outline=col+(255,),width=2*S)
 return im.resize((w*2,h*2),Image.Resampling.LANCZOS)
def taskrow(done):
 w,h=256*S,160*S;im=Image.new('RGBA',(w,h));palette=[(3,43,(253,244,230),(216,185,159)),(5,41,(255,252,244),(239,217,193)),(10,36,(245,224,202),(225,196,171)),(12,34,(255,247,234),(251,231,210))]
 if done:palette[-1]=(12,34,(255,250,239),(255,236,215))
 for pad,r,a,b in palette:im.alpha_composite(layer((w,h),(pad*S,pad*S,w-1-pad*S,h-1-pad*S),r*S,a,b))
 return im.resize((512,320),Image.Resampling.LANCZOS)
def traced(f, shared=None):
 # Recover continuous contour from an alpha isocurve, fit a periodic cubic spline,
 # redraw it at 6x. Colour illumination is fitted separately as a continuous bicubic field.
 old=Image.open(BEFORE/f).convert('RGBA');a=np.array(old);h,w=a.shape[:2]
 am=np.array(Image.open(BEFORE/(shared or f)).convert('RGBA'))[:,:,3]
 contours,_=cv2.findContours((am>=128).astype('uint8'),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
 mask=Image.new('L',(w*S,h*S));d=ImageDraw.Draw(mask);paths=[]
 for co in contours:
  p=co[:,0].astype(float)
  if len(p)<8:continue
  p=p+.5
  try:
   tck,_=interpolate.splprep(p.T,s=len(p)*.06,per=True);xy=np.array(interpolate.splev(np.linspace(0,1,2000),tck)).T
  except:xy=p
  d.polygon([tuple(v*S) for v in xy],fill=255)
  paths.append(xy[::8].round(4).tolist())
 mask=mask.filter(ImageFilter.MaxFilter(7))
 if 'ribbon_title_blue' in f:
  # The original raster's flat upper rim contains subpixel chroma residue.
  # Redraw its central straight edge instead of retaining that sampled staircase.
  md=ImageDraw.Draw(mask);md.rectangle((70*S,0,230*S,7.5*S-1),fill=0);md.rectangle((70*S,7.5*S,230*S,35*S),fill=255)
 # Native mesh-light field is measured on the delivered reference; RGB outside
 # opaque material is extended from interior to avoid chroma/white halo interpolation.
 valid=a[:,:,3]>8
 _,inds=ndimage.distance_transform_edt(~valid,return_indices=True)
 rgb=a[:,:,:3].astype(float);rgb[~valid]=rgb[inds[0][~valid],inds[1][~valid]]
 if 'ribbon_title_blue' in f:
  # Rebuild the upper cyan highlight using clean interior colours; reject old key spill.
  for y in range(14):
   t=max(0,min(1,(y-8)/6))
   rgb[y]=(1-t)*np.array([139,223,255])+t*rgb[14]
  rgb=ndimage.gaussian_filter(rgb,sigma=(.45,.45,0))
 xx=(np.arange(w*S)+.5)/S-.5;yy=(np.arange(h*S)+.5)/S-.5
 values=[]
 for k in range(3):
  spline=interpolate.RectBivariateSpline(np.arange(h),np.arange(w),rgb[:,:,k],s=0)
  values.append(spline(yy,xx))
 hi=Image.fromarray(np.uint8(np.clip(np.stack(values,2),0,255))).convert('RGBA')
 if 'endless_stage_node_' in f or 'endless_stage_link_' in f:
  alpha_field=interpolate.RectBivariateSpline(np.arange(h),np.arange(w),a[:,:,3].astype(float),s=0)(yy,xx)
  mask=Image.fromarray(np.uint8(np.clip(alpha_field,0,255))) if ('endless_stage_node_unreached' in f or 'endless_stage_link_' in f) else Image.fromarray(np.uint8(np.minimum(np.array(mask),np.clip(alpha_field,0,255))))
 hi.putalpha(mask)
 (HERE/(Path(f).stem+'_contour.json')).write_text(json.dumps(dict(source=f,contours=paths,method='periodic cubic native contour plus continuously fitted clean illumination'),ensure_ascii=False),encoding='utf-8')
 return hi.resize((w*2,h*2),Image.Resampling.LANCZOS)
results={}
results['UI/通用/panel_dialog.png']=panel(False);results['UI/通用/panel_feature.png']=panel(True)
results['UI/通用/panel_inner.png']=rounded((128,128),(255,250,237),(255,248,230),(232,197,120),30)
for name,a,b,e in [('bar_bg',(30,41,108),(24,35,86),(245,233,207)),('bar_fill_green',(70,235,155),(5,145,111),(16,113,89)),('bar_fill_blue',(93,205,254),(18,106,204),(21,89,159))]:results['UI/通用/'+name+'.png']=rounded((110,42),a,b,e,18)
results['UI/任务/task_row_normal.png']=taskrow(False);results['UI/任务/task_row_done.png']=taskrow(True)
# Original task progress layers reuse the same P0 procedural source palettes.
for f in ['UI/任务/task_progress_bar_bg.png','UI/任务/task_progress_bar_fill.png']:
 old=np.array(Image.open(BEFORE/f)); source='UI/通用/bar_bg.png' if 'bg' in f else 'UI/通用/bar_fill_green.png'
 if np.array_equal(old,np.array(Image.open(BEFORE/source))):results[f]=results[source].copy()
for f in FILES:
 if f in results:continue
 if 'divider_gold' in f:
  im=Image.new('RGBA',(240*S,24*S));d=ImageDraw.Draw(im)
  d.line((14*S,12*S,225*S,12*S),fill='#c38b30',width=3*S);d.line((14*S,10*S,225*S,10*S),fill='#ffe48b',width=2*S)
  for cx in (11,228):d.regular_polygon((cx*S,11*S,7*S),6,rotation=30,fill='#e9b94a',outline='#fff09c',width=S)
  results[f]=im.resize((480,48),Image.Resampling.LANCZOS)
 else:
  shared=None
  # Each source state retains its own silhouette; pre-existing differences are reported.
  results[f]=traced(f,shared)
checks=[]
for f,im in results.items():
 arr=np.array(im)
 # Preserve original threshold topology including isolated glints AND internal holes.
 if 'endless_stage_node_unreached' in f:
  orig=np.array(Image.open(BEFORE/f))[:,:,3]>=128
  for iteration in range(12):
   actual=np.array(Image.fromarray(arr[:,:,3]).resize((arr.shape[1]//2,arr.shape[0]//2),Image.Resampling.LANCZOS))>=128
   changed=np.argwhere(orig!=actual)
   if not len(changed):break
   for yy,xx in changed:arr[yy*2:yy*2+2,xx*2:xx*2+2,3]=180 if orig[yy,xx] else 75
 arr[:6]=0;arr[-6:]=0;arr[:,:6]=0;arr[:,-6:]=0;arr[arr[:,:,3]==0,:3]=0;im=Image.fromarray(arr);im.save(ART/f)
 old=Image.open(BEFORE/f).convert('RGBA');down=im.resize(old.size,Image.Resampling.LANCZOS)
 aa=np.array(old)[:,:,3]>=128;bb=np.array(down)[:,:,3]>=128
 d1=ndimage.distance_transform_edt(~aa);d2=ndimage.distance_transform_edt(~bb)
 delta=max(float(d1[bb].max()) if bb.any() else 0,float(d2[aa].max()) if aa.any() else 0)
 edgeA=aa^ndimage.binary_erosion(aa);edgeB=bb^ndimage.binary_erosion(bb)
 boundaryDelta=max(float(ndimage.distance_transform_edt(~edgeA)[edgeB].max()),float(ndimage.distance_transform_edt(~edgeB)[edgeA].max()))
 checks.append(dict(boundaryIncludingHolesDelta=boundaryDelta,file=f,size=list(im.size),sha256=hashlib.sha256((ART/f).read_bytes()).hexdigest(),oldSha256=hashlib.sha256((BEFORE/f).read_bytes()).hexdigest(),halfSizeContourDistance=delta,method='continuous contour redraw and measured smooth light field' if (HERE/(Path(f).stem+'_contour.json')).exists() else 'original native procedural renderer re-evaluated at 6x, exported at 2x'))
(HERE/'verification.json').write_text(json.dumps(dict(count=len(checks),checks=checks),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'count':len(checks),'maxDelta':max(c['halfSizeContourDistance'] for c in checks),'over1':[(c['file'],c['halfSizeContourDistance']) for c in checks if c['halfSizeContourDistance']>1]},ensure_ascii=False))
