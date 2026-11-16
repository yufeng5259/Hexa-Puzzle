from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import numpy as np,math
R=Path(__file__).resolve().parents[3]/'素材/UI';K=6
class Canvas:
 def __init__(self,w,h):self.w=w;self.h=h;self.im=Image.new('RGBA',(w*K,h*K))
 def mask(self,pts=None,box=None,r=0):
  m=Image.new('L',self.im.size);d=ImageDraw.Draw(m)
  if pts:d.polygon([(round(x*K),round(y*K)) for x,y in pts],fill=255)
  elif r:d.rounded_rectangle(tuple(round(v*K) for v in box),round(r*K),fill=255)
  else:d.ellipse(tuple(round(v*K) for v in box),fill=255)
  return m
 def layer(self,m,top,bot=None,ya=0,yb=None):
  a=np.array(Image.new('RGB',(1,1),top))[0,0].astype(float);b=np.array(Image.new('RGB',(1,1),bot or top))[0,0].astype(float)
  v=np.clip((np.arange(self.h*K)/K-ya)/((yb or self.h)-ya),0,1)[:,None];v=(a[None,:]*(1-v)+b[None,:]*v).astype('uint8');data=np.broadcast_to(v[:,None,:],(self.h*K,self.w*K,3));q=Image.fromarray(data.copy());q.putalpha(m);self.im.alpha_composite(q)
 def round(self,box,r,top,bot=None):self.layer(self.mask(box=box,r=r),top,bot,box[1],box[3])
 def poly(self,pts,top,bot=None):self.layer(self.mask(pts=pts),top,bot)
 def done(self):
  im=self.im.resize((self.w,self.h),Image.Resampling.LANCZOS);a=np.array(im);a[:6]=0;a[-6:]=0;a[:,:6]=0;a[:,-6:]=0;a[a[:,:,3]==0]=0;return Image.fromarray(a)
def curve(points):
 out=[points[0]];cur=points[0]
 for p in points[1:]:
  if len(p)==2:out.append(p);cur=p;continue
  x0,y0=cur;x1,y1,x2,y2,x3,y3=p
  for t in np.linspace(0,1,80)[1:]:
   u=1-t;out.append((u**3*x0+3*u*u*t*x1+3*u*t*t*x2+t**3*x3,u**3*y0+3*u*u*t*y1+3*u*t*t*y2+t**3*y3))
  cur=(x3,y3)
 return out
# Continuous native heart contour: center notch is actual empty canvas, never extracted RGB.
c=Canvas(240,202)
p=curve([(120,41),(94,0,32,1,15,42),(-5,89,47,146,120,191),(193,146,245,89,225,42),(208,1,146,0,120,41)])
c.poly(p,'#b91b47','#8f1234')
# inset consistent with original pink broad dome and red thickness
p2=[(120+(x-120)*.953,95+(y-95)*.94-3) for x,y in p];c.poly(p2,'#ff5889','#ed1b57')
p3=[(120+(x-120)*.88,94+(y-94)*.87-6) for x,y in p];c.poly(p3,'#ff6295','#f22a68')
# Small soft upper-left arc, out of the 60% digit region.
h=Image.new('RGBA',c.im.size);d=ImageDraw.Draw(h)
arc=curve([(26,65),(26,38,47,20,68,24),(81,24,89,28,97,34)])
d.line([(round(x*K),round(y*K)) for x,y in arc],fill=(255,215,231,235),width=3*K,joint='curve');alpha=h.getchannel('A').filter(ImageFilter.GaussianBlur(1.3*K)); h=Image.new('RGBA',h.size,(255,222,234,0)); h.putalpha(alpha); c.im.alpha_composite(h)
c.done().save(R/'图标/icon_energy.png')
# Large HUD-family blue square, unchanged alpha in both states; pressed face drops 12px.
for pressed in (False,True):
 c=Canvas(336,336);c.round((9,9,327,327),78,'#176eaf','#0c447c')
 c.round((13,11,323,320),74,'#48bde8','#0a69a8')
 shift=12 if pressed else 0
 c.round((18,15+shift,318,293+shift),69,'#3da9df','#14558f')
 c.round((24,21+shift,312,285+shift),62,'#298bc7','#175487')
 # Broad top and left highlights matching hud_btn_square_blue.
 hi=Image.new('RGBA',c.im.size);d=ImageDraw.Draw(hi)
 d.rounded_rectangle((22*K,(19+shift)*K,314*K,(289+shift)*K),radius=64*K,outline=(137,229,255,125),width=5*K)
 alpha=hi.getchannel('A').filter(ImageFilter.GaussianBlur(2*K)); hi=Image.new('RGBA',hi.size,(137,229,255,0)); hi.putalpha(alpha); c.im.alpha_composite(hi)
 im=c.done()
 if pressed:
  a=np.array(im);a[:,:,:3]=(a[:,:,:3].astype(float)*.92).round().astype('uint8');im=Image.fromarray(a)
 im.save(R/('主页/home_btn_square_large_'+('pressed' if pressed else 'normal')+'.png'))
# Start button: native full-resolution capsule geometry, use original row palette for exact visual family.
for pressed in (False,True):
 c=Canvas(600,296)
 # Gold edge, cream chamfer, bright mint shoulder and teal lower lip.
 for box,rad,top,bot in [((9,9,591,287),139,'#ffe05a','#d79b2d'),((12,11,588,282),136,'#fffde1','#ffe3a1'),((18,17,582,277),130,'#fffde6','#fff1c9'),((28,25,572,267),120,'#78ffe7','#00aa85'),((33,32,567,261),114,'#00e3b7','#009d79'),((40,39,560,251),105,'#02e5b7','#00b98f')]:c.round(box,rad,top,bot)
 im=c.done()
 if pressed:
  a=np.array(im);a[:,:,:3]=(a[:,:,:3].astype(float)*.8).round().astype('uint8');im=Image.fromarray(a)
 im.save(R/('主页/home_play_btn_'+('pressed' if pressed else 'normal')+'.png'))
# S02 arrow: preserve distinctive curved left shoulder and pointed right tip, blank center.
c=Canvas(396,256)
p=curve([(124,10),(274,10),(285,12,291,20,300,30),(382,119),(388,125,388,130,382,136),(283,241),(278,245,272,246,264,246),(124,246),(58,246,17,210,12,141),(6,83,47,10,124,10)])
c.poly(p,'#d17fff','#5220ac');q=[(198+(x-198)*.964,128+(y-128)*.93-2) for x,y in p];c.poly(q,'#e3a3ff','#7730d4');q=[(198+(x-198)*.93,128+(y-128)*.86-3) for x,y in p];c.poly(q,'#c078ff','#822ee7')
c.done().save(R/'主页/home_play_level_arrow.png')
print('P2-5: 6 files rendered')
