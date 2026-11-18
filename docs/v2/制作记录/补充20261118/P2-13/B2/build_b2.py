"""P2-13 B2: rerender original parametric shapes at double resolution.

Procedural source geometry is evaluated at 8x original coordinates, then reduced
to the requested 2x output. Crop-derived puzzle button colours use monotone cubic
palette gradients on a rounded-rectangle signed-distance bevel field.
No complete low resolution PNG is resized into the new runtime asset.
"""
from pathlib import Path
import ast, hashlib,json,math,shutil,colorsys
import numpy as np
from PIL import Image,ImageDraw,ImageFilter,ImageOps,ImageChops
from scipy import ndimage as ndi
from scipy.interpolate import PchipInterpolator
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
ART=ROOT/'素材'
S=8
RECORD=[]
SRC=ROOT/'制作记录/切图20261112'
FILES=[]
for col in ['blue','purple','teal']:
 for st in ['normal','pressed','disabled']:FILES.append(f'UI/拼图/puzzle_btn_{col}_{st}.png')
FILES+=['UI/拼图/puzzle_badge_count.png']+[f'UI/拼图/puzzle_steps_plate_{s}.png' for s in ['normal','warning']]
FILES+=['UI/主页/home_bottom_bar.png']+[f'UI/主页/home_btn_home_{s}.png' for s in ['normal','pressed']]
FILES +=[f'UI/地图选择/map_card_{s}.png' for s in ['current','done','locked']]+['UI/地图选择/map_tag_current.png','UI/建造/build_dot_bar.png']+[f'UI/建造/build_cost_capsule_{s}.png' for s in ['normal','insufficient']]
FILES +=[f'UI/签到/{id}_{st}.png' for id in ['signin_cell','signin_cell_big'] for st in ['normal','today','claimed','locked']]

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def backup():
 for file in FILES:
  dest=HERE/'before'/file;dest.parent.mkdir(parents=True,exist_ok=True)
  if not dest.exists():shutil.copyfile(ART/file,dest)
def old(file):return Image.open(HERE/'before'/file).convert('RGBA')
def rgb(v):return tuple(int(v[i:i+2],16) for i in (1,3,5))
def mask(size,r,pad=3,scale=S):
 w,h=size;im=Image.new('L',(w*scale,h*scale));ImageDraw.Draw(im).rounded_rectangle((pad*scale,pad*scale,(w-pad)*scale-1,(h-pad)*scale-1),radius=r*scale,fill=255)
 return im
def finish(im,size):
 im=im.resize((size[0]*2,size[1]*2),Image.Resampling.LANCZOS)
 a=np.array(im);a[a[:,:,3]==0,:3]=0
 return Image.fromarray(a)
def bevel(size,top,bottom,r,edge,pad=3):
 w,h=size;W,H=w*S,h*S
 a,b=np.array(rgb(top)),np.array(rgb(bottom))
 yy=np.linspace(0,1,H)[:,None,None];xx=np.linspace(0,math.pi,W)[None,:,None]
 col=np.clip(np.round((a[None,None,:]*(1-yy)+b[None,None,:]*yy)*(.91+.09*np.sin(xx))),0,255).astype('uint8')
 im=Image.fromarray(col,'RGB').convert('RGBA');im.putalpha(mask(size,r,pad));d=ImageDraw.Draw(im)
 d.rounded_rectangle(((pad+1)*S,(pad+1)*S,(w-pad-2)*S,(h-pad-2)*S),radius=(r-1)*S,outline=edge,width=3*S)
 hi=Image.new('RGBA',(W,H));hd=ImageDraw.Draw(hi)
 hd.rounded_rectangle(((pad+5)*S,(pad+5)*S,(w-pad-6)*S,(h-pad-8)*S),radius=(r-5)*S,outline=(194,247,255,52),width=7*S)
 hd.line((r*S,(pad+6)*S,(w-r)*S,(pad+6)*S),fill=(225,255,255,130),width=4*S)
 im.alpha_composite(hi.filter(ImageFilter.GaussianBlur(2*S)));im.putalpha(mask(size,r,pad))
 return finish(im,size)
def recolor(im,mode):
 a=np.asarray(im).copy();v=a[:,:,:3].astype(float)
 if mode=='pressed':v=np.round(v*.8)
 elif mode=='disabled':v=np.round((v[:,:,0]*.21+v[:,:,1]*.72+v[:,:,2]*.07)[:,:,None]*.48+np.array([52,65,82]))
 elif mode=='insufficient':v=np.round(v*np.array([.65,.6,.65])+np.array([80,25,30]))
 a[:,:,:3]=np.clip(v,0,255).astype('uint8');return Image.fromarray(a)
def emit(file,im,source):
 a=np.asarray(im).copy();a[a[:,:,3]==0,:3]=0;im=Image.fromarray(a)
 target=ART/file;im.save(target)
 before=old(file);small=im.resize(before.size,Image.Resampling.LANCZOS)
 a=np.asarray(before.getchannel('A'))>127;b=np.asarray(small.getchannel('A'))>127
 da=ndi.distance_transform_edt(~a);db=ndi.distance_transform_edt(~b)
 haus=max(float(da[b].max()),float(db[a].max()))
 oa=np.asarray(before);na=np.asarray(small);valid=(oa[:,:,3]>240)&(na[:,:,3]>240)
 delta=np.abs(oa[:,:,:3].astype(float)-na[:,:,:3])
 RECORD.append(dict(file=file,size=list(im.size),sha256=sha(target),beforeSha256=sha(HERE/'before'/file),source=source,contourDeviationAt1xPx=haus,alphaPartialPixels=sum(im.getchannel('A').histogram()[1:255]),opaqueRgbMeanAbsoluteDifference=float(delta[valid].mean()),opaqueRgbMedianAbsoluteDifference=float(np.median(delta[valid]))))
def grad(size,top,bot):
 out=Image.new('RGBA',size);d=ImageDraw.Draw(out)
 for y in range(size[1]):
  t=y/max(1,size[1]-1);d.line((0,y,size[0],y),fill=tuple(round(a+(b-a)*t) for a,b in zip(top,bot))+(255,))
 return out
def mapcard(state):
 n=180;edge,inner={'current':((255,254,244),(255,246,220)),'done':((187,244,213),(246,255,230)),'locked':((234,233,224),(255,247,234))}[state]
 shadow=Image.new('RGBA',(n*S,n*S));d=ImageDraw.Draw(shadow);d.rounded_rectangle((5*S,8*S,(n-6)*S,(n-5)*S),radius=42*S,fill=(30,63,59,105));shadow=shadow.filter(ImageFilter.GaussianBlur(1.6*S))
 face=grad((n*S,n*S),(255,250,241),(255,230,205));face.putalpha(mask((n,n),43,4))
 hi=Image.new('RGBA',(n*S,n*S));d=ImageDraw.Draw(hi)
 d.rounded_rectangle((5*S,4*S,(n-6)*S,(n-9)*S),radius=41*S,outline=edge+(255,),width=5*S)
 d.rounded_rectangle((11*S,10*S,(n-12)*S,(n-15)*S),radius=35*S,outline=inner+(200,),width=2*S)
 face.alpha_composite(hi);shadow.alpha_composite(face)
 # The original exporter clears a 3px outer safety band.
 a=np.asarray(shadow).copy();a[:3*S]=0;a[-3*S:]=0;a[:,:3*S]=0;a[:,-3*S:]=0
 return finish(Image.fromarray(a),(n,n))
def signin(big,state):
 source=SRC/'P1/signin_tasks/build_signin_tasks.py';tree=ast.parse(source.read_text(encoding='utf8'))
 names={'grad','rr_mask','polygon_mask','insetpts','polygrad','badge','signin'}
 code='\n\n'.join(ast.get_source_segment(source.read_text(encoding='utf8'),node) for node in tree.body if isinstance(node,ast.FunctionDef) and node.name in names)
 code=code.replace('s=AA;W,H=w*s,h*s','s=AA*2;W,H=w*s,h*s').replace('im=im.resize(size,Image.Resampling.LANCZOS)','im=im.resize((w*2,h*2),Image.Resampling.LANCZOS)').replace('b=badge(state,60);im.alpha_composite(b,((w-60)//2,h-63))','b=badge(state,120);im.alpha_composite(b,((w*2-120)//2,h*2-126))')
 env=dict(Image=Image,ImageDraw=ImageDraw,ImageFilter=ImageFilter,ImageOps=ImageOps,ART=ART,AA=3)
 exec(compile(code,str(source),'exec'),env)
 return env['signin'](big,state)
def puzzle(col):
 file=f'UI/拼图/puzzle_btn_{col}_normal.png';im=old(file);a=np.asarray(im);w,h=im.size
 # Cubic gradient mesh sampled from the original clean surface; colour-only
 # nearest foreground extension prevents backdrop contamination at the new rim.
 # The old crop's semiopaque rim contains navy background. Derive continuous
 # body and bevel palettes only from fully opaque reference positions, then
 # evaluate them on a native rounded-rectangle signed-distance field.
 gx=np.linspace(0,w-1,w*2)[None,:];gy=np.linspace(0,h-1,h*2)[:,None]
 stops=np.array([10,15,20,30,43,60,80,100,115,125,132])
 cols=a[stops,w//2,:3].astype(float)
 base=np.stack([PchipInterpolator(stops,cols[:,c])(np.clip(gy,10,132)) for c in range(3)],axis=2)
 qx=np.abs(gx-(w-1)/2)-((w-6)/2-40);qy=np.abs(gy-(h-1)/2)-((h-6)/2-40)
 dist=40-(np.hypot(np.maximum(qx,0),np.maximum(qy,0))+np.minimum(np.maximum(qx,qy),0))
 depth=np.clip(dist,1,12)
 topweight=np.clip((43-gy)/40,0,1)
 bottomweight=np.clip((gy-(h-43))/24,0,1)
 sideweight=1-np.maximum(topweight,bottomweight)
 xpos=np.arange(4,16)
 side=np.stack([PchipInterpolator(xpos,a[73,xpos,c].astype(float))(np.clip(3+depth,4,15)) for c in range(3)],axis=2)
 top=np.stack([PchipInterpolator(np.arange(6,22),a[6:22,w//2,c].astype(float))(np.clip(3+depth,6,21)) for c in range(3)],axis=2)
 # Keep the original shaded lower lip, including its very dark final outline.
 # This is authored shadow colour (not a removed backdrop); the earlier fit
 # truncated it at y139 and made the button look flatter than the reference.
 bottom=np.stack([PchipInterpolator(np.arange(124,143),a[124:143,w//2,c].astype(float))(np.clip(h-3-depth,124,142)) for c in range(3)],axis=2)
 # The lower-facing bevel receives less light than the face. Restore the
 # undercut's original broad value contrast, without changing hue or geometry.
 bottom*=1-.10*np.exp(-((depth-5)/3.5)**2)[:,:,None]
 rim=top*topweight[:,:,None]+bottom*bottomweight[:,:,None]+side*sideweight[:,:,None]
 influence=np.clip((12-dist)/7,0,1)[:,:,None]
 out=base*(1-influence)+rim*influence
 out=np.uint8(np.clip(np.round(out),0,255));out=Image.fromarray(out,'RGB').convert('RGBA')
 ma=mask((w,h),40).resize((w*2,h*2),Image.Resampling.LANCZOS)
 # Source exporter has a 3px hard safety border, retained as a 6px clear band.
 md=ImageDraw.Draw(ma);md.rectangle((0,0,w*2-1,5),fill=0);md.rectangle((0,h*2-6,w*2-1,h*2-1),fill=0);md.rectangle((0,0,5,h*2-1),fill=0);md.rectangle((w*2-6,0,w*2-1,h*2-1),fill=0)
 out.putalpha(ma);return out
def main():
 backup()
 procedural=[('UI/主页/home_bottom_bar.png',(200,115),'#fff8ed','#ffe8d3',48,'#ffffff'),('UI/主页/home_btn_home_normal.png',(136,100),'#51b1ff','#0764d6',27,'#9ee4ff'),('UI/建造/build_dot_bar.png',(148,38),'#fff4dd','#ead6b8',16,'#fffbe9'),('UI/建造/build_cost_capsule_normal.png',(150,70),'#fff8e7','#ffe6c6',32,'#fffef1'),('UI/拼图/puzzle_badge_count.png',(42,42),'#f9fff2','#d2f9d8',18,'#ffffff'),('UI/拼图/puzzle_steps_plate_normal.png',(166,62),'#fffbe9','#ffecc6',28,'#ffd75f')]
 for file,size,top,bot,r,edge in procedural:
  im=bevel(size,top,bot,r,edge);emit(file,im,'hud_puzzle/build_hud_puzzle.py:bevel geometry and palette at 8x')
  if file.endswith('home_normal.png'):emit(file.replace('_normal','_pressed'),recolor(im,'pressed'),'same geometry; original pressed colour transform')
  if 'capsule_normal' in file:emit(file.replace('_normal','_insufficient'),recolor(im,'insufficient'),'same geometry; original insufficient colour transform')
  if 'plate_normal' in file:emit(file.replace('_normal','_warning'),recolor(im,'insufficient'),'same geometry; original warning colour transform')
 for col in ['blue','purple','teal']:
  im=puzzle(col)
  for state in ['normal','pressed','disabled']:emit(f'UI/拼图/puzzle_btn_{col}_{state}.png',im if state=='normal' else recolor(im,state),'native rounded SDF bevel; original fully-opaque palette control points evaluated by monotone cubic gradients')
 for state in ['current','done','locked']:emit(f'UI/地图选择/map_card_{state}.png',mapcard(state),'P1/build_maps/build_assets.py native geometry and palette at 8x')
 size=(174,54);im=grad((174*S,54*S),(255,184,51),(255,139,6));im.putalpha(mask(size,24));d=ImageDraw.Draw(im);d.rounded_rectangle((4*S,4*S,169*S,49*S),radius=22*S,outline='#ed8b03',width=2*S)
 hi=Image.new('RGBA',im.size);ImageDraw.Draw(hi).line((28*S,7*S,145*S,7*S),fill=(255,242,163,180),width=3*S);im.alpha_composite(hi.filter(ImageFilter.GaussianBlur(S)))
 emit('UI/地图选择/map_tag_current.png',finish(im,size),'P1/build_maps/build_assets.py native geometry and palette at 8x')
 for big,id in [(False,'signin_cell'),(True,'signin_cell_big')]:
  for state in ['normal','today','claimed','locked']:emit(f'UI/签到/{id}_{state}.png',signin(big,state),'P1/signin_tasks/build_signin_tasks.py original polygon/gradient rerender at 2x')
 assert len(RECORD)==30
 sources=[SRC/'hud_puzzle/build_hud_puzzle.py',SRC/'P1/build_maps/build_assets.py',SRC/'P1/signin_tasks/build_signin_tasks.py']
 (HERE/'verification.json').write_text(json.dumps(dict(count=30,files=RECORD,sourcePrograms=[dict(path=p.relative_to(ROOT).as_posix(),sha256=sha(p)) for p in sources]),ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print('B2: 30 native redraws written; maximum contour deviation',max(e['contourDeviationAt1xPx'] for e in RECORD))
if __name__=='__main__':main()
