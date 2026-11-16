from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import numpy as np, json, hashlib, math

ROOT=Path(__file__).resolve().parents[3]/'素材/UI'
K=6

def rgb(c):
    if isinstance(c,str):return tuple(int(c[i:i+2],16) for i in (1,3,5))
    return tuple(c)

class Canvas:
    def __init__(self,size,coord=None):
        self.size=size;self.coord=coord or size
        self.sx=size[0]*K/self.coord[0];self.sy=size[1]*K/self.coord[1]
        self.im=Image.new('RGBA',(size[0]*K,size[1]*K))
    def box(self,b):return tuple(round(v*(self.sx if i%2==0 else self.sy)) for i,v in enumerate(b))
    def mask(self,kind,box=None,rad=0,pts=None,width=None):
        m=Image.new('L',self.im.size);d=ImageDraw.Draw(m)
        if kind=='round':d.rounded_rectangle(self.box(box),radius=round(rad*min(self.sx,self.sy)),fill=255)
        elif kind=='ellipse':d.ellipse(self.box(box),fill=255)
        elif kind=='poly':d.polygon([(round(x*self.sx),round(y*self.sy)) for x,y in pts],fill=255)
        elif kind=='line':
            pp=[(round(x*self.sx),round(y*self.sy)) for x,y in pts];ww=round(width*min(self.sx,self.sy));d.line(pp,fill=255,width=ww,joint='curve')
        return m
    def fill(self,m,top,bottom=None):
        top=rgb(top);bottom=rgb(bottom or top)
        bounds=m.getbbox()
        if not bounds:return
        x0,y0,x1,y1=bounds;h=y1-y0
        row=np.linspace(top,bottom,h).astype('uint8')
        arr=np.broadcast_to(row[:,None,:],(h,x1-x0,3)).copy()
        lay=Image.fromarray(arr,'RGB').convert('RGBA');lay.putalpha(m.crop(bounds));self.im.alpha_composite(lay,(x0,y0))
    def round(self,b,r,t,bottom=None):self.fill(self.mask('round',box=b,rad=r),t,bottom)
    def ell(self,b,t,bottom=None):self.fill(self.mask('ellipse',box=b),t,bottom)
    def poly(self,p,t,b=None):self.fill(self.mask('poly',pts=p),t,b)
    def line(self,p,col,width):self.fill(self.mask('line',pts=p,width=width),col)
    def curve(self,p,col,width):
        pts=[]
        for a,b,c,d in p:
            a,b,c,d=map(np.array,(a,b,c,d))
            for t in np.linspace(0,1,80):
                q=(1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d;pts.append(tuple(q))
        self.line(pts,col,width)
    def save(self,rel):
        # Supersampled coverage AA; use a box reconstruction to prevent Lanczos
        # ringing, then one restrained subpixel alpha transition. Edge RGB is
        # dilated from the actual design colors, never composited with a matte.
        im=self.im.resize(self.size,Image.Resampling.LANCZOS)
        a=np.array(im).copy(); alpha=a[:,:,3]
        alpha[alpha<4]=0
        # Remove invisible ringing and keep six fully transparent safety rows.
        alpha[:6]=0;alpha[-6:]=0;alpha[:,:6]=0;alpha[:,-6:]=0
        a[:,:,3]=alpha
        from scipy.ndimage import distance_transform_edt
        solid=alpha>=240
        _,idx=distance_transform_edt(~solid,return_indices=True)
        fringe=(alpha>0)&(alpha<240)
        a[fringe,:3]=a[idx[0][fringe],idx[1][fringe],:3]
        a[alpha==0,:3]=0
        im=Image.fromarray(a,'RGBA');p=ROOT/rel;p.parent.mkdir(parents=True,exist_ok=True);im.save(p)
        print(rel,im.size,im.getbbox(),int(((alpha>0)&(alpha<255)).sum()))
        return im

# Level badge: exact pointed hex geometry with warm gold outline and pale ring.
c=Canvas((320,352),(98,108))
hex0=[(49,4),(91,27),(91,78),(49,103),(7,78),(7,27)]
c.poly(hex0,'#f9c516','#db8d02')
c.poly([(49,7),(89,29),(89,76),(49,100),(9,76),(9,29)],'#fff294','#ffbd12')
c.poly([(49,10),(86,31),(86,74),(49,97),(12,74),(12,31)],'#ffc522','#ffd339')
c.poly([(49,14),(82,33),(82,72),(49,92),(16,72),(16,33)],'#fff3a0','#ffe470')
c.poly([(49,18),(78,35),(78,69),(49,87),(20,69),(20,35)],'#ffdf38','#ffdd36')
c.save('HUD/hud_level_badge.png')

# Lock: preserve grey-blue components while centering in the new square canvas.
c=Canvas((128,128),(64,64))
# Solid upper round arc with a truly transparent aperture.
m=c.mask('ellipse',box=(17,7,47,39));d=ImageDraw.Draw(m);d.ellipse(c.box((24,14,40,38)),fill=0);d.rectangle(c.box((14,29,50,43)),fill=0)
c.fill(m,'#a4b1cc','#7e8ca9')
c.round((11,27,53,58),9,'#6d7895','#626e8b')
c.round((13.7,29.7,50.3,55.3),6.6,'#e0e5ee','#c6cfdf')
c.line([(20,31),(44,31)],'#eff2f7',1.4)
c.ell((28.7,36,35.3,42.5),'#65718e')
c.round((30.4,40,33.7,48),1.2,'#65718e')
c.save('通用/mark_lock.png')

# Check: same angular tick, deeper green lower thickness, all edges supersampled.
c=Canvas((128,128),(64,64))
p=[(7,29),(15,21),(28,34),(51,7),(59,14),(29,51)]
c.poly([(x,y+5) for x,y in p],'#208c3e','#147a38')
c.poly(p,'#69ed66','#4bdc4c')
c.poly([(7,29),(15,21),(28,34),(51,7),(53,9),(28,38),(15,25),(9,31)],'#82f878','#71ee66')
c.save('通用/mark_check.png')

# Notification disc: circular alpha, white fine keyline, red convex fill.
c=Canvas((80,80))
c.ell((7,7,73,73),'#fff9f4','#fff4ef')
c.ell((9,9,71,71),'#ff7985','#cf2444')
c.ell((12,12,68,68),'#fb405e','#da274a')
c.curve([((19,32),(19,22),(28,17),(38,18))],'#ffc1c8',3.4)
c.save('通用/reddot.png')

# Today capsule: completely round caps including the lower dark blue lip.
c=Canvas((276,116))
c.round((6.5,6.5,269.5,109.5),51.5,'#8ceaff','#164878')
c.round((9,8,267,108),50,'#4a9fe9','#063d82')
c.round((11.5,9.5,264.5,105),47.7,'#138cff','#0062be')
c.round((14,11,262,98),43.5,'#208bf8','#0064c9')
c.curve([((48,15),(81,10),(196,10),(228,15))],'#9ddcff',2.2)
c.save('签到/signin_today_tag.png')

# Calendar bee: source-independent red header, gold bindings, paper bevel,
# and smiling honey bee face with small white/blue goggles above its forehead.
c=Canvas((188,212))
# Pages, all fully round and free from the old purple baseline.
c.round((7,77,181,201),19,'#bfa998','#a38c85')
c.round((7,73,181,197),18,'#fff2e6','#e7d4c6')
c.round((7,68,181,192),16,'#fffaf0','#fae9d9')
c.round((10,70,178,186),14,'#fffaf2','#fff0e1')
# Raised red calendar head behind the rings.
c.poly([(18,70),(33,51),(155,51),(171,70)],'#eb4c3f','#b92d2a')
c.line([(19,69),(170,69)],'#ff8d67',2)
# Ring sockets, gold binding bars with shaped highlights.
for x in (50,138):
    c.ell((x-14,43,x+14,62),'#d9b9a4','#fef6e6')
    c.ell((x-10,44,x+10,56),'#fffdf5','#ffe8cd')
    c.round((x-10,7,x+10,53),8.4,'#ffe963','#e79a0a')
    c.round((x-6.4,9.5,x+7,49),6,'#ffe946','#f4b20b')
    c.curve([((x-4,14),(x-5,20),(x-5,32),(x-4,37))],'#fff9c1',2.6)
    c.line([(x+7,14),(x+7,45)],'#e5a516',1)
# Honey face and dark outline, matching original round golden bee emblem.
c.ell((53,90,139,178),'#9a6012','#b36e17')
c.ell((56,92,136,175),'#ffe75d','#eda80b')
c.ell((60,97,132,171),'#ffe944','#ffc00c')
# Fine darker side stripes of the face.
c.curve([((59,112),(55,120),(55,130),(57,139))],'#4f3117',3)
c.curve([((132,111),(137,122),(137,131),(135,138))],'#4f3117',3)
# Forehead helmet rim and two goggles, gold/white/cool blue same family.
c.curve([((60,110),(65,88),(121,84),(134,111))],'#875012',6)
c.curve([((61,107),(70,86),(119,84),(132,107))],'#ffdc63',3)
for bx in (71,115):
    # tilted quadrilateral goggles
    pts=[(bx-12,99),(bx-8,84),(bx+5,86),(bx+11,96),(bx+3,105)]
    c.poly(pts,'#976226','#694422')
    pts2=[(bx-9,98),(bx-6,87),(bx+3,89),(bx+7,96),(bx+1,101)]
    c.poly(pts2,'#fcffff','#8ebad3')
    c.line([(bx-6,94),(bx+2,89)],'#ffffff',2)
# Closed happy eyes.
c.curve([((71,129),(74,117),(82,118),(86,127))],'#4f3114',3.2)
c.curve([((108,127),(113,117),(121,118),(123,128))],'#4f3114',3.2)
c.ell((65,132,80,144),'#ffc552','#ffb53b')
c.ell((116,132,131,144),'#ffc552','#ffb53b')
# Wide smile with curved jaw, red mouth and warm tongue.
mouth=[(79,139),(84,141),(91,143),(99,143),(107,140),(114,137),(113,147),(109,155),(102,160),(94,162),(86,158),(82,152)]
c.poly(mouth,'#87421b','#b34419')
c.ell((87,149,109,160),'#ff6356','#ef4c3d')
c.curve([((80,139),(90,146),(104,146),(114,137))],'#fff4bc',2.2)
c.save('图标/icon_signin.png')

# Crown: gold framed purple pill and three golden honeycomb cells. Rebuild
# the whole silhouette; no cropped source color remains behind the combs.
c=Canvas((1128,490),(400,180))
c.round((3,64,397,177),51,'#ffea69','#e6930f')
c.round((6,67,394,174),48,'#fff7a2','#ffc14c')
c.round((9,70,391,171),45,'#ffcb42','#f4a327')
c.round((15,77,385,166),42,'#6547db','#412ba8')
c.round((17,79,383,162),40,'#5c42d3','#5741d2')
c.curve([((53,78),(69,75),(121,77),(145,77))],'#8e68ed',1.2)
# Hexagons: one above, two below; transparent boundaries follow the combs.
def hexpoints(cx,cy,r):
    return [(cx+r*math.sin(a),cy-r*math.cos(a)) for a in [i*math.pi/3 for i in range(6)]]
def comb(cx,cy,r):
    c.poly(hexpoints(cx,cy,r),'#9b6209','#be7404')
    c.poly(hexpoints(cx,cy-1,r-1.5),'#fff28c','#ffc237')
    c.poly(hexpoints(cx,cy-1,r-4),'#ffe349','#f4a90e')
    c.poly(hexpoints(cx,cy-1,r-7),'#fff49b','#ffdc57')
    c.poly(hexpoints(cx,cy,r-10),'#cf8005','#f6b10a')
    c.poly(hexpoints(cx+1,cy+2,r-12),'#e49b06','#ffca19')
comb(200,29,24)
comb(178,57,25)
comb(222,57,25)
c.save('通用/panel_feature_crown.png')
