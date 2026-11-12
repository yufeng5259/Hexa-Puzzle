"""P1 construction overlays and map-selection parts; never rewrites P0 assets.

Map thumbnail compositions reuse the shipped maps and L5 building placements.
Construction frames are original deterministic 2.5D drawing, upper-left lit,
transparent and aligned to the existing 576x576 building canvas/feet.
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageOps,ImageFont
import json,math,hashlib,random,colorsys
ROOT=Path(__file__).resolve().parents[4]
REC=Path(__file__).resolve().parent
ASSET=ROOT/'素材'
REF=next((ROOT/'效果图').glob('S16_*.png'))
S16=Image.open(REF).convert('RGBA')
OUT=ASSET/'UI'/'地图选择'
OUT.mkdir(parents=True,exist_ok=True)
K=3
MAN=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def smooth(size,draw):
    m=Image.new('L',(size[0]*K,size[1]*K));draw(ImageDraw.Draw(m))
    return m.resize(size,Image.Resampling.LANCZOS)
def rounded(size,r,pad=3):
    return smooth(size,lambda d:d.rounded_rectangle((pad*K,pad*K,(size[0]-pad)*K-1,(size[1]-pad)*K-1),radius=r*K,fill=255))
def clear(im):
    im=im.copy();p=im.load()
    for y in range(im.height):
        for x in range(im.width):
            if x<3 or y<3 or x>=im.width-3 or y>=im.height-3 or p[x,y][3]==0:p[x,y]=(0,0,0,0)
    return im
def save(im,path):
    path.parent.mkdir(parents=True,exist_ok=True);im=clear(im);im.save(path);return sha(path)
def gradient(size,top,bottom,r,pad=3):
    im=Image.new('RGBA',size);d=ImageDraw.Draw(im)
    for y in range(size[1]):
        t=y/max(1,size[1]-1);d.line((0,y,size[0],y),fill=tuple(round(top[i]*(1-t)+bottom[i]*t) for i in range(3))+(255,))
    im.putalpha(rounded(size,r,pad));return im
def add_state(id,name,states,size,slice=None,source='S16 参考重建',sources=None):
    paths={};hashes={}
    for state,im in states.items():
        p=OUT/(id+('_'+state if len(states)>1 else '')+'.png');hashes[state]=save(im,p);paths[state]=p.relative_to(ASSET).as_posix()
    a={'id':id,'name':name,'states':paths,'size':list(size),'scale':1,'anchor':[.5,.5],'source':source,'sourceFile':REF.relative_to(ROOT).as_posix(),'sourceHash':sha(REF),'priority':'P1','sha256':hashes}
    if slice:a['slice']=slice
    if sources:a['sources']=sources
    MAN.append(a)
    return a

# Small stretchable cream card; the edge and inner bevel follow S16, keeping the
# thumbnail and all labels separate. State differentiation is by frame tint only.
def card(state):
    n=180
    if state=='current':edge=(255,254,244);inner=(255,246,220)
    elif state=='done':edge=(187,244,213);inner=(246,255,230)
    else:edge=(234,233,224);inner=(255,247,234)
    shadow=Image.new('RGBA',(n,n));d=ImageDraw.Draw(shadow)
    d.rounded_rectangle((5,8,n-6,n-5),radius=42,fill=(30,63,59,105));shadow=shadow.filter(ImageFilter.GaussianBlur(1.6))
    face=gradient((n,n),(255,250,241),(255,230,205),43,4)
    # A soft 9px cream porcelain bevel, anti-aliased at 3x.
    hi=Image.new('RGBA',(n*K,n*K));d=ImageDraw.Draw(hi)
    d.rounded_rectangle((5*K,4*K,(n-6)*K,(n-9)*K),radius=41*K,outline=edge+(255,),width=5*K)
    d.rounded_rectangle((11*K,10*K,(n-12)*K,(n-15)*K),radius=35*K,outline=inner+(200,),width=2*K)
    face.alpha_composite(hi.resize((n,n),Image.Resampling.LANCZOS));shadow.alpha_composite(face)
    return shadow
add_state('map_card','地图选择卡片底',{s:card(s) for s in ['current','done','locked']},(180,180),[48,48,48,48])

# Orange current-map tag; no baked title.
im=gradient((174,54),(255,184,51),(255,139,6),24)
d=ImageDraw.Draw(im);d.rounded_rectangle((4,4,169,49),radius=22,outline='#ed8b03',width=2)
hi=Image.new('RGBA',im.size);hd=ImageDraw.Draw(hi);hd.line((28,7,145,7),fill=(255,242,163,180),width=3)
im.alpha_composite(hi.filter(ImageFilter.GaussianBlur(1)))
add_state('map_tag_current','当前地图橙色角标底',{'normal':im},im.size,[28,18,28,18])

# Compose only from approved existing backgrounds/buildings/JSON, and record
# every source hash. Crop after composition; do not repaint or use S16 raster.
for mid in ['M01','M02','M03']:
    cfgpath=ROOT/'地图'/(mid+'_建筑布局.json');cfg=json.loads(cfgpath.read_text(encoding='utf-8'))
    bgpath=ROOT/cfg['background'];im=Image.open(bgpath).convert('RGBA');w,h=im.size
    sources=[{'file':bgpath.relative_to(ROOT).as_posix(),'sha256':sha(bgpath)},{'file':cfgpath.relative_to(ROOT).as_posix(),'sha256':sha(cfgpath)}]
    for pl in sorted(cfg['placements'],key=lambda a:a['z_index']):
        path=ROOT/next(s['file'] for s in pl['stages'] if s['level']==5)
        sp=Image.open(path).convert('RGBA')
        if pl.get('flip_x'):sp=ImageOps.mirror(sp)
        rw=round(w*pl['render_width_fraction']);rh=round(sp.height*rw/sp.width)
        sp=sp.resize((rw,rh),Image.Resampling.LANCZOS)
        x=round(pl['normalized_feet'][0]*w-rw*pl['anchor'][0]);y=round(pl['normalized_feet'][1]*h-rh*pl['anchor'][1])
        im.alpha_composite(sp,(x,y));sources.append({'file':path.relative_to(ROOT).as_posix(),'sha256':sha(path)})
    im.save(REC/(mid.lower()+'_full_l5_composition.png'))
    # A true 768x350 landscape crop of the original portrait map. Keep source
    # coordinates, proportions and building positions intact. The main landmark
    # identifies each map; a landscape thumbnail need not show all five houses.
    top={'M01':256,'M02':276,'M03':224}[mid]
    cropbox=(0,top,w,top+round(w*350/768))
    feature=im.crop(cropbox)
    thumb=feature.resize((768,350),Image.Resampling.LANCZOS)
    thumb.putalpha(rounded(thumb.size,28))
    a=add_state('map_thumb_'+mid.lower(),cfg['name']+'满级地图缩略图',{'normal':thumb},thumb.size,source=mid+' 既有背景+全部L5建筑按原落位JSON合成，裁切并等比缩放，无重绘',sources=sources)
    a['cropRect']=list(cropbox);a['sourceSize']=[w,h];a['recommendedDisplayMode']='landscape thumbnail, directly display; genuine landmark crop without relocating buildings'

# Drawing primitives at 3x for toy-like construction equipment with clean edges.
def canvas():return Image.new('RGBA',(576*K,576*K))
def pt(v):return tuple(round(x*K) for x in v)
def poly(d,points,fill):d.polygon([pt(p) for p in points],fill=fill)
def beam(im,a,b,width=15):
    d=ImageDraw.Draw(im);ax,ay=a;bx,by=b;dx=bx-ax;dy=by-ay;ln=math.hypot(dx,dy);nx=-dy/ln*width/2;ny=dx/ln*width/2
    points=[(ax+nx,ay+ny),(bx+nx,by+ny),(bx-nx,by-ny),(ax-nx,ay-ny)]
    poly(d,[(x+4,y+5) for x,y in points],'#9b4e19');poly(d,points,'#c17b32')
    poly(d,[(ax+nx,ay+ny),(bx+nx,by+ny),(bx+nx*.50,by+ny*.50),(ax+nx*.50,ay+ny*.50)],'#f5ca78')
    d.line([pt((ax-nx*.6,ay-ny*.6)),pt((bx-nx*.6,by-ny*.6))],fill='#b56c27',width=max(1,2*K))
def joint(im,x,y):
    d=ImageDraw.Draw(im);d.ellipse(pt((x-9,y-8,x+9,y+10)),fill='#0d838e');d.ellipse(pt((x-8,y-9,x+8,y+7)),fill='#27bac3');d.ellipse(pt((x-3,y-5,x+3,y+1)),fill='#bff5e7')
def platform(im,y):
    d=ImageDraw.Draw(im)
    poly(d,[(84,y),(469,y),(492,y+17),(107,y+17)],'#f2c778')
    poly(d,[(107,y+17),(492,y+17),(492,y+28),(107,y+28)],'#bb7a30')
    poly(d,[(84,y),(107,y+17),(107,y+28),(84,y+10)],'#e5b45d')
    for x in range(137,470,53):d.line([pt((x,y+2)),pt((x+19,y+15))],fill='#cc994d',width=K)
    d.line([pt((87,y+2)),pt((467,y+2))],fill='#ffe7ac',width=2*K)
def scaffold(frame):
    im=canvas();d=ImageDraw.Draw(im)
    # Four freestanding upright posts. Open centre never contains a fake building.
    for x,y in [(135,205),(440,205),(108,245),(476,245)]:
        beam(im,(x,y),(x,536),16)
        d.rounded_rectangle(pt((x-18,529,x+20,544)),radius=4*K,fill='#bd803d')
        d.line([pt((x-16,531)),pt((x+16,531))],fill='#f8d79a',width=2*K)
    platform(im,497)
    if frame>=1:
        platform(im,363)
        for a,b in [((111,491),(135,380)),((441,380),(475,491)),((135,375),(440,491)),((135,491),(440,375))]:beam(im,a,b,9)
        for x,y in [(111,497),(476,497),(135,371),(440,371)]:joint(im,x,y)
    if frame>=2:
        platform(im,231)
        beam(im,(137,236),(137,175),11);beam(im,(441,236),(441,175),11);beam(im,(137,176),(441,176),10)
        for x in [136,440]:joint(im,x,234)
        # Small honey-gold safety flag, blank and independent of the building.
        poly(d,[(147,182),(237,182),(226,211),(147,211)],'#ffc63e')
        poly(d,[(147,185),(171,185),(155,208),(147,208)],'#ef9c1e')
        poly(d,[(190,185),(211,185),(194,208),(173,208)],'#ef9c1e')
    # Side ladder, consistent feet and perspective in every frame.
    beam(im,(485,282),(485,533),9);beam(im,(523,293),(523,544),9)
    for y in range(303,535,31):beam(im,(485,y),(523,y+11),7)
    return im.resize((576,576),Image.Resampling.LANCZOS)

def puff(size,opacity):
    w,h=size;im=Image.new('RGBA',size);p=im.load()
    for y in range(h):
        for x in range(w):
            rx=(x-w*.45)/(w*.49);ry=(y-h*.45)/(h*.49);r=math.hypot(rx,ry)
            a=max(0,min(1,(1-r)*3.2))*opacity
            lit=max(0,min(1,1-math.hypot((x-w*.30)/(w*.9),(y-h*.2)/(h*.9))))
            p[x,y]=(round(217+35*lit),round(196+42*lit),round(155+66*lit),round(a*255))
    return im
def dust(frame):
    im=Image.new('RGBA',(576,576));t=frame/4
    rng=random.Random(80913);fade=[.38,.82,.92,.65,.19][frame]
    points=[]
    for side in [-1,1]:
        for n in range(10):
            vx=side*(30+n*12+rng.uniform(-9,9));vy=rng.uniform(0,50)
            x=288+vx*(.45+t*.9);y=522-vy-(t*48)
            radius=(17+n%4*9)*(0.70+t*.45)
            points.append((y,x,radius,fade))
    for y,x,r,a in sorted(points):
        cloud=puff((round(r*2),round(r*1.45)),a)
        im.alpha_composite(cloud,(round(x-r),round(y-r*.7)))
    # Small ground wisps are airy and do not turn into an opaque floor tile.
    wisps=Image.new('RGBA',im.size);d=ImageDraw.Draw(wisps)
    d.ellipse((120-t*40,512-t*9,456+t*40,545-t*9),fill=(255,235,189,round(45*fade)))
    wisps=wisps.filter(ImageFilter.GaussianBlur(7));im.alpha_composite(wisps)
    return im

def diamond(d,x,y,r,fill):poly(d,[(x,y-r),(x+r*.26,y-r*.25),(x+r*.65,y),(x+r*.20,y+r*.21),(x,y+r),(x-r*.25,y+r*.24),(x-r*.65,y),(x-r*.25,y-r*.24)],fill)
def sparkle(frame):
    im=canvas();t=frame/4;power=[.28,.75,1,.64,.16][frame]
    halo=canvas();hd=ImageDraw.Draw(halo)
    for rr in range(100,0,-5):
        a=round((1-rr/110)*power*9);hd.ellipse(pt((288-rr,343-rr,288+rr,343+rr)),fill=(255,214,75,a))
    im.alpha_composite(halo.filter(ImageFilter.GaussianBlur(15*K)))
    d=ImageDraw.Draw(im)
    # Opening ring follows the building footprint, then expands and fades.
    rx=75+t*155;ry=rx*.28;cy=525-t*12
    ring=canvas();rd=ImageDraw.Draw(ring);rd.ellipse(pt((288-rx,cy-ry,288+rx,cy+ry)),outline=(255,224,110,round(210*power)),width=3*K)
    im.alpha_composite(ring.filter(ImageFilter.GaussianBlur(1*K)))
    for n in range(10):
        angle=2*math.pi*n/10-.7;rad=90+t*126
        x=288+math.cos(angle)*rad;y=340+math.sin(angle)*rad*.78
        r=(10+(n%3)*4)*power
        glow=canvas();gd=ImageDraw.Draw(glow);diamond(gd,x,y,r*1.9,(255,213,54,round(85*power)))
        im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(5*K)))
        star=canvas();sd=ImageDraw.Draw(star);diamond(sd,x+1.5,y+2,r,(243,153,24,round(255*power)));diamond(sd,x,y,r,(255,224,86,round(255*power)));diamond(sd,x-1,y-1,r*.56,(255,255,223,round(255*power)));im.alpha_composite(star)
    return im.resize((576,576),Image.Resampling.LANCZOS)

for id,name,count,fn,fps in [('fx_build_scaffold','蜂巢施工脚手架空心覆盖层',3,scaffold,6),('fx_build_dust','施工烟尘',5,dust,12),('fx_build_sparkle','落成金色闪光',5,sparkle,12)]:
    dest=ASSET/'UI'/'建造'/id;dest.mkdir(parents=True,exist_ok=True);frames=[];hashes={}
    for i in range(count):
        p=dest/(id+f'_{i+1:02d}.png');hashes[f'{i+1:02d}']=save(fn(i),p);frames.append(p.relative_to(ASSET).as_posix())
    MAN.append({'id':id,'name':name,'frames':frames,'fps':fps,'size':[576,576],'scale':1,'anchor':[.5,544/576],'source':'P1 新绘，S02/S03 2.5D蜂巢木构、金色与青绿配色；上左光照；独立透明覆盖层','sourceFile':'效果图/S03_建造页_BlockHexa风格.png','sourceHash':sha(next((ROOT/'效果图').glob('S03_*.png'))),'priority':'P1','sha256':hashes,'loop':id=='fx_build_dust','playbackNote':'scaffold grows once, hold last frame until construction ends' if id=='fx_build_scaffold' else 'transparent overlay frames; stop and destroy with owning building view'})

(REC/'manifest.json').write_text(json.dumps(MAN,ensure_ascii=False,indent=2),encoding='utf-8')

def nine(im,sl,size):
    l,t,r,b=sl;w,h=im.size;ww,hh=size;o=Image.new('RGBA',size);xs=[0,l,w-r,w];ys=[0,t,h-b,h];xx=[0,l,ww-r,ww];yy=[0,t,hh-b,hh]
    for a in range(3):
        for b in range(3):
            p=im.crop((xs[a],ys[b],xs[a+1],ys[b+1])).resize((xx[a+1]-xx[a],yy[b+1]-yy[b]),Image.Resampling.LANCZOS);o.alpha_composite(p,(xx[a],yy[b]))
    return o
FONT=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
def tile(im,bg,size=(380,360)):
    out=Image.new('RGBA',size,'#d5d9df' if bg=='checker' else bg)
    if bg=='checker':
        d=ImageDraw.Draw(out)
        for y in range(0,size[1],14):
            for x in range(0,size[0],14):
                if (x//14+y//14)%2:d.rectangle((x,y,x+13,y+13),fill='#a8b3c4')
    p=ImageOps.contain(im,(size[0]-12,size[1]-12),Image.Resampling.LANCZOS);out.alpha_composite(p,((size[0]-p.width)//2,(size[1]-p.height)//2));return out.convert('RGB')
items=[]
for a in MAN:
    if 'frames' in a:
        for i,f in enumerate(a['frames']):items.append((a['id']+f' {i+1:02d}',Image.open(ASSET/f)))
    else:
        for s,f in a['states'].items():items.append((a['id']+' '+s,Image.open(ASSET/f)))
sheet=Image.new('RGB',(1140,len(items)*390),'#e8edf2');d=ImageDraw.Draw(sheet)
for i,(name,im) in enumerate(items):
    d.text((8,i*390+5),name,fill='#143057',font=FONT)
    for j,bg in enumerate(['white','#0e2a5c','checker']):sheet.paste(tile(im,bg),(j*380,i*390+27))
sheet.save(REC/'three_backgrounds.jpg',quality=94)
cards=Image.new('RGB',(900,3*420),'#0e2a5c');d=ImageDraw.Draw(cards)
a=MAN[0]
for i,(s,f) in enumerate(a['states'].items()):
    im=Image.open(ASSET/f);p=nine(im,a['slice'],(360,360));cards.paste(p,(20,i*420+35),p);d.text((20,i*420+8),'map_card '+s+' / 2x W + H',fill='white',font=FONT)
    if i==0:
        tag=Image.open(ASSET/MAN[1]['states']['normal']);tag=nine(tag,MAN[1]['slice'],(348,108));cards.paste(tag,(430,120),tag);d.text((430,78),'current tag 2x W + H',fill='white',font=FONT)
cards.save(REC/'nine_slice_double.jpg',quality=94)
frames=Image.new('RGB',(5*260,3*295),'#0e2a5c');d=ImageDraw.Draw(frames)
for row,a in enumerate([a for a in MAN if 'frames'in a]):
    for col,f in enumerate(a['frames']):
        im=Image.open(ASSET/f);frames.paste(tile(im,'#0e2a5c',(260,260)),(col*260,row*295+28));d.text((col*260+8,row*295+5),a['id'].replace('fx_build_','')+f' {col+1:02d}',fill='white',font=FONT)
frames.save(REC/'frames_contact.jpg',quality=94)
# Building overlay sanity checks at the exact shared feet anchor.
base=Image.open(next((ASSET/'建筑').glob('B01_*/B01_L2.png'))).convert('RGBA')
overlay=Image.new('RGB',(576*3,576),'#0e2a5c')
for i in range(3):
    im=base.copy();im.alpha_composite(scaffold(i));overlay.paste(im,(i*576,0),im)
overlay.save(REC/'scaffold_building_anchor_check.jpg',quality=94)

files=[]
for a in MAN:
    values=a.get('states') or {f'{i+1:02d}':f for i,f in enumerate(a['frames'])}
    for state,f in values.items():
        p=ASSET/f;im=Image.open(p);bb=im.getchannel('A').getbbox()
        assert im.mode=='RGBA' and list(im.size)==a['size']
        assert sha(p)==a['sha256'][state]
        assert bb and bb[0]>=3 and bb[1]>=3 and bb[2]<=im.width-3 and bb[3]<=im.height-3
        files.append({'file':f,'sha256':sha(p),'alphaBBox':bb})
report={'priority':'P1','groups':len(MAN),'pngFiles':len(files),'RGBA_size_sha_safetyMargin':'PASS','safetyMarginPx':3,'constructionAnchor':[.5,544/576],'visualReview':'Author inspected all 20 PNGs on white/navy/checker backgrounds using alpha_review_01..04, all frames contact sheet, 3x scaffold-on-B01-L2 shared-anchor overlay, all three thumbnails at native size and nine-slice 2x width/height sheet. No baked labels, digits or background found. Not runtime or user approval.','checks':files,'mapThumbnailNote':'768x350 genuine landscape crop of background + L5 layout composite; records source size/crop rect and every source hash. Landmark crop does not relocate or distort buildings and does not claim to contain all five.'}
(REC/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'groups':len(MAN),'pngFiles':len(files)},ensure_ascii=False))
