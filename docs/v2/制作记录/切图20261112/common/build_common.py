"""P0 common pieces: source-pixel extraction and exact deterministic state derivation.
Run from Project root. No original reference is modified.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageOps
import json, hashlib, colorsys, math

ROOT=Path('docs/v2'); OUT=ROOT/'素材/UI/通用'; REC=ROOT/'制作记录/切图20261112/common'
OUT.mkdir(parents=True,exist_ok=True); REC.mkdir(parents=True,exist_ok=True)
OLD=ROOT/'制作记录/扩展美术20261112/弹窗'; S17=next((ROOT/'效果图').glob('S17_*.png'))
manifest=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def mask_round(size,box,r):
    s=4;m=Image.new('L',(size[0]*s,size[1]*s));ImageDraw.Draw(m).rounded_rectangle(tuple(int(v*s) for v in box),radius=int(r*s),fill=255)
    return m.resize(size,Image.Resampling.LANCZOS)
def gradient(size,top,bottom):
    im=Image.new('RGBA',size);d=ImageDraw.Draw(im)
    for y in range(size[1]):
        t=y/max(1,size[1]-1);d.line((0,y,size[0],y),fill=tuple(round(a+(b-a)*t) for a,b in zip(top,bottom))+(255,))
    return im
def rounded(size,top,bottom,edge,r=30,inset=3):
    im=gradient(size,top,bottom);im.putalpha(mask_round(size,(inset,inset,size[0]-1-inset,size[1]-1-inset),r));d=ImageDraw.Draw(im)
    # Multiple broad bevel rings, rather than a flat placeholder stroke.
    for k,col in [(1,edge),(3,tuple(min(255,v+24) for v in edge)),(5,tuple(min(255,v+44) for v in top))]:
        b=(inset+k,inset+k,size[0]-inset-k-1,size[1]-inset-k-1);d.rounded_rectangle(b,radius=max(2,r-k),outline=col+(255,),width=2)
    return im
def patch(im,sl,target):
    l,t,r,b=sl;w,h=im.size;W,H=target;out=Image.new('RGBA',target)
    xs=[0,l,w-r,w];ys=[0,t,h-b,h];xx=[0,l,W-r,W];yy=[0,t,H-b,H]
    for j in range(3):
        for i in range(3):
            tile=im.crop((xs[i],ys[j],xs[i+1],ys[j+1]));tile=tile.resize((xx[i+1]-xx[i],yy[j+1]-yy[j]),Image.Resampling.LANCZOS);out.alpha_composite(tile,(xx[i],yy[j]))
    return out
def recolor(im,hue=None,saturation=1,value=1):
    p=im.copy();pix=p.load()
    for y in range(p.height):
        for x in range(p.width):
            r,g,b,a=pix[x,y];h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255);h=h if hue is None else hue;s*=saturation;v*=value
            q=colorsys.hsv_to_rgb(h,min(1,s),min(1,v));pix[x,y]=tuple(round(v*255) for v in q)+(a,)
    return p
def panel_texture(feature=False):
    """Compact smooth bevel sampled to the reference's cream/purple palette.
    Source corners cannot simply be cropped: bee and landscape overlap them.
    Keep all curvature inside the seventy-pixel nine-slice corner.
    """
    s=3;sz=256*s;out=Image.new('RGBA',(sz,sz))
    layers=([(3,65,(164,134,255),(78,48,198)),(7,61,(197,174,255),(103,74,221)),(11,57,(126,94,239),(84,55,196)),(21,47,(199,172,211),(127,91,161)),(25,43,(255,246,234),(250,232,213))] if feature else [(3,65,(255,253,242),(238,209,168)),(7,61,(255,255,249),(255,247,226)),(13,55,(249,225,191),(243,213,173)),(18,50,(254,243,224),(255,248,231)),(23,45,(255,248,235),(255,245,226))])
    for pad,r,top,bot in layers:
        wh=sz-2*pad*s;part=gradient((wh,wh),top,bot);part.putalpha(mask_round(part.size,(0,0,wh-1,wh-1),r*s));out.alpha_composite(part,(pad*s,pad*s))
    return out.resize((256,256),Image.Resampling.LANCZOS)
def register(id,name,images,source,slice=None,extra=None):
    states={};hashes={}
    for state,im in images.items():
        # Lanczos can ring alpha into the padded border. Enforce exactly three
        # fully transparent pixels without changing the intended image size.
        if id!='mask_black':
            im=im.copy();dd=ImageDraw.Draw(im);w,h=im.size
            dd.rectangle((0,0,w-1,2),fill=(0,0,0,0));dd.rectangle((0,h-3,w-1,h-1),fill=(0,0,0,0));dd.rectangle((0,0,2,h-1),fill=(0,0,0,0));dd.rectangle((w-3,0,w-1,h-1),fill=(0,0,0,0))
        f=OUT/(id+('' if state=='default' else '_'+state)+'.png');im.save(f);states[state]=f.relative_to(ROOT/'素材').as_posix();hashes[state]=sha(f)
    e={'id':id,'name':name,'states':states,'size':list(next(iter(images.values())).size),'scale':1,'slice':slice or [0,0,0,0],'anchor':[.5,.5],'source':source,'priority':'P0','sha256':hashes}
    if extra:e.update(extra)
    manifest.append(e)

raw=Image.open(OLD/'panel_alpha.png').convert('RGBA')
# Old extraction retained chroma RGB at zero alpha; remove all chroma-key pixels,
# including the key's soft edge, and preserve original cream/blue pixels.
p=raw.load()
for y in range(raw.height):
    for x in range(raw.width):
        r,g,b,a=p[x,y]
        if r>g+40 and b>g+40:p[x,y]=(0,0,0,0)

# The body is independent from the title. Recover hidden top edge by reflecting
# the unobstructed lower rim. The entire interior is already text-free.
body=raw.crop((0,104,raw.width,raw.height));body.paste(ImageOps.flip(body.crop((0,body.height-160,body.width,body.height))),(0,0))
body=body.resize((710,900),Image.Resampling.LANCZOS)
body=patch(body,[70,70,70,70],(256,256))
body=panel_texture(False)
register('panel_dialog','标准米白弹窗面板',{'default':body},'S06 参考米白母件的配色、圆角及宽倒角重建可拉伸空白面板',[70,70,70,70],{'sourceFile':(OLD/'panel_alpha.png').relative_to(ROOT).as_posix(),'sourceSha256':sha(OLD/'panel_alpha.png')})

ribbon=raw.crop((112,0,857,205)).resize((540,140),Image.Resampling.LANCZOS)
ribbon.putalpha(ImageChops.multiply(ribbon.getchannel('A'),mask_round(ribbon.size,(3,3,536,136),65)))
ribbon=patch(ribbon,[100,8,100,18],(300,140))
register('ribbon_title_blue','蓝色标题飘带金色底沿',{'default':ribbon},'S06 同源无字标题母件裁切',[100,8,100,18])

inner=rounded((128,128),(255,250,237),(255,248,230),(232,197,120),30)
register('panel_inner','浅色奖励内框',{'default':inner},'S06 奖励框按其圆角和配色重建',[34,34,34,34])

# Feature panel sampled from the unoccluded original bottom corners. Build a
# compact nine-slice: corner art and side art retained, only interior sampled.
feature_src=Image.open(S17).convert('RGBA').crop((42,453,812,1529))
feature_src=ImageOps.flip(feature_src)
feature=Image.new('RGBA',(256,256),(255,239,218,255))
for left in (True,False):
    sx=0 if left else feature_src.width-100
    corner=feature_src.crop((sx,0,sx+100,100))
    for top in (True,False):
        tile=corner if top else ImageOps.flip(corner)
        feature.paste(tile,(0 if left else 156,0 if top else 156))
# Connect original violet side border through a clean single-pixel sample.
for left in (True,False):
    sx=0 if left else feature_src.width-65
    strip=feature_src.crop((sx,160,sx+65,161)).resize((65,116))
    feature.paste(strip,(0 if left else 191,70))
# Matching center top/bottom rim; sampled bottom center has no content.
strip=feature_src.crop((370,0,371,42)).resize((116,42))
feature.paste(strip,(70,0));feature.paste(ImageOps.flip(strip),(70,214))
filler=gradient((212,212),(255,241,223),(255,238,217));filler.putalpha(mask_round(filler.size,(0,0,211,211),36));feature.alpha_composite(filler,(22,22))
feature=panel_texture(True)
register('panel_feature','紫色粗边功能面板',{'default':feature},'S17 紫色宽倒角、米白空底重建，消除原图角色与场景对边角的遮挡',[70,70,70,70],{'sourceFile':S17.relative_to(ROOT).as_posix(),'sourceSha256':sha(S17)})

# Crown plate: original honeycomb crown retained, title region replaced with
# sampled blank violet stripes so no baked Chinese survives.
src=Image.open(S17).convert('RGBA');crown=src.crop((213,315,642,522));cp=crown.load()
for y in range(69,crown.height):
    for x in range(65):cp[x,y]=cp[crown.width-1-x,y]
for y in range(97,crown.height):
    l=cp[64,y];r=cp[365,y]
    for x in range(65,365):
        f=(x-64)/301;cp[x,y]=tuple(round(a+(b-a)*f) for a,b in zip(l,r))
cm=Image.new('L',crown.size);cd=ImageDraw.Draw(cm)
cd.rounded_rectangle((3,69,425,202),radius=65,fill=255)
cd.polygon([(151,84),(151,37),(178,22),(178,13),(206,0),(235,13),(235,28),(264,43),(264,84)],fill=255)
crown.putalpha(cm);crown=ImageOps.expand(crown,3).resize((400,180),Image.Resampling.LANCZOS)
cp=crown.load()
for y in range(crown.height):
    for x in range(crown.width):
        r,g,b,a=cp[x,y]
        if g>r*1.15 and g>b*1.05:cp[x,y]=(0,0,0,0)
register('panel_feature_crown','蜂巢顶饰与无字标题底',{'default':crown},'S17 原图蜂巢顶饰裁切，标题字区域以两侧空白像素逐行插值清除',[120,100,120,24])

button=Image.open(OLD/'button_blank_from_S17.png').convert('RGBA')
button=patch(button,[64,22,64,25],(240,92));button.putalpha(ImageChops.multiply(button.getchannel('A'),mask_round(button.size,(3,3,236,88),44)))
for id,name,hue,sat,states in [('btn_green','青绿主按钮',None,1,['normal','pressed','disabled']),('btn_blue','蓝色次要按钮',.59,1,['normal','pressed','disabled']),('btn_grey','灰蓝次级按钮',.61,.12,['normal','pressed']),('btn_small_green','列表领取按钮',None,1,['normal','pressed','disabled'])]:
    base=recolor(button,hue,sat)
    if id=='btn_small_green':base=base.resize((180,72),Image.Resampling.LANCZOS)
    images={}
    for state in states:
        images[state]=recolor(base,None,.15,.76) if state=='disabled' else recolor(base,None,1,.84) if state=='pressed' else base
    register(id,name,images,'S17 无字原按钮母件，蓝/灰与按下禁用状态用确定性HSV派生',[55,18,55,22] if id=='btn_small_green' else [70,20,70,24])

for id,name,top,bot in [('tag_claimed','已领取灰底胶囊',(216,225,238),(149,163,190)),('tag_locked','未解锁灰底胶囊',(184,195,212),(107,123,155))]:
    register(id,name,{'default':rounded((140,60),top,bot,(98,117,154),27)},'S19 灰色标签空底按风格派生',[30,20,30,20])

def closebutton(size,purple):
    im=rounded((size,size),(152,110,253) if purple else (57,123,190),(70,39,181) if purple else (32,72,131),(121,109,231) if purple else (171,223,255),size//2-4)
    d=ImageDraw.Draw(im);a=size*.37;b=size*.63;ww=max(3,round(size*.085))
    d.line((a,a+2,b,b+2),fill=(28,36,89,160),width=ww+2);d.line((b,a+2,a,b+2),fill=(28,36,89,160),width=ww+2)
    d.line((a,a,b,b),fill='white',width=ww);d.line((b,a,a,b),fill='white',width=ww)
    return im
for id,name,size,purp in [('btn_close','紫底白叉关闭按钮',92,True),('btn_close_dialog','标准弹窗小关闭按钮',50,False)]:
    normal=closebutton(size,purp);register(id,name,{'normal':normal,'pressed':recolor(normal,None,1,.8)},'S17/S08 关闭形状与配色分离绘制')

tracks={};knobs={}
for state,top,bot in [('on',(60,232,182),(4,141,145)),('off',(191,205,224),(99,121,151)),('disabled',(181,188,200),(134,144,160))]:
    track=rounded((186,78),top,bot,tuple(max(0,v-20) for v in bot),36);tracks[state]=track
    knob=rounded((68,68),(255,255,255),(226,234,244) if state!='disabled' else (193,201,214),(227,241,252),32);knobs[state]=knob
register('toggle_track','开关底轨',tracks,'S23 轨道独立导出；按原参考配色、曲面高光重建',extra={'partOf':'toggle'})
register('toggle_knob','开关圆钮',knobs,'S23 圆钮独立导出；程序按状态移动圆钮',extra={'partOf':'toggle','trackPositions':{'on':[121,5],'off':[5,5],'disabled':[5,5]}})

for id,name,top,bot,edge in [('bar_bg','进度条深蓝底',(30,41,108),(24,35,86),(245,233,207)),('bar_fill_green','进度条绿填充',(70,235,155),(5,145,111),(16,113,89)),('bar_fill_blue','进度条蓝填充',(93,205,254),(18,106,204),(21,89,159))]:
    register(id,name,{'default':rounded((110,42),top,bot,edge,18)},'S01/S02/S03 圆头进度条样式独立重建',[22,10,22,10])

reddot=rounded((30,30),(255,105,113),(211,30,58),(153,26,55),13)
register('reddot','红点',{'default':reddot},'规范新增，统一上左光源')

# Standalone marks: glyphs are pictograms, not text labels.
im=Image.new('RGBA',(64,60));d=ImageDraw.Draw(im);d.line([(10,30),(25,45),(52,13)],fill='#147c3c',width=13);d.line([(10,27),(25,42),(52,10)],fill='#5fe65a',width=10)
register('mark_check','绿色勾',{'default':im},'S17 绿色勾形状提取重绘，不含圆底')
im=Image.new('RGBA',(48,58));d=ImageDraw.Draw(im);d.arc((11,5,37,36),180,360,fill='#8893ae',width=7);d.rounded_rectangle((5,24,43,53),radius=8,fill='#ced4e2',outline='#6d7895',width=3);d.ellipse((21,33,27,40),fill='#65718e');d.rectangle((23,37,25,44),fill='#65718e')
register('mark_lock','锁',{'default':im},'S17 锁形状独立重绘，不含底框')
register('mask_black','黑色遮罩',{'default':Image.new('RGBA',(4,4),(0,0,0,255))},'规范指定4x4纯黑不透明；程序控制遮罩透明度',extra={'paddingException':'mask_black explicitly requires opaque 4x4'})

im=Image.new('RGBA',(240,24));d=ImageDraw.Draw(im)
d.line((14,12,225,12),fill='#c38b30',width=3);d.line((14,10,225,10),fill='#ffe48b',width=2)
for cx in (11,228):d.regular_polygon((cx,11,7),6,rotation=30,fill='#e9b94a',outline='#fff09c',width=1)
register('divider_gold','双六边形金色分隔线',{'default':im},'S04 金色细线与两端六角装饰独立派生',[22,6,22,6])

(REC/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
# All states on the three required backgrounds. Full alpha compositing, no color
# matte is introduced into the delivered textures.
files=sorted([ROOT/'素材'/p for e in manifest for p in e['states'].values()])
cellw=380;cellh=166;sheet=Image.new('RGB',(cellw*3,cellh*len(files)),(232,237,242));sd=ImageDraw.Draw(sheet)
for row,f in enumerate(files):
    src=Image.open(f).convert('RGBA');view=ImageOps.contain(src,(340,132))
    for col in range(3):
        bg=Image.new('RGBA',(cellw,cellh),'white' if col==0 else '#0E2A5C')
        if col==2:
            bd=ImageDraw.Draw(bg)
            for y in range(0,cellh,16):
                for x in range(0,cellw,16):bd.rectangle((x,y,x+15,y+15),fill='#d4d7dc' if (x//16+y//16)%2 else '#f4f5f7')
        bg.alpha_composite(view,((cellw-view.width)//2,25));ImageDraw.Draw(bg).text((5,5),f.stem,fill='#666666' if col!=1 else '#ffffff');sheet.paste(bg.convert('RGB'),(col*cellw,row*cellh))
sheet.save(REC/'three_backgrounds.jpg',quality=92)
stretch=[x for x in manifest if any(x['slice'])]
sheet=Image.new('RGB',(1000,240*len(stretch)),'#0E2A5C');d=ImageDraw.Draw(sheet)
for i,e in enumerate(stretch):
    im=Image.open(ROOT/'素材'/next(iter(e['states'].values()))).convert('RGBA');im=patch(im,e['slice'],(im.width*2,im.height*2));im.thumbnail((960,205));sheet.paste(im,(20,i*240+25),im);d.text((10,i*240+5),e['id']+' nine-slice 2xW 2xH',fill='white')
sheet.save(REC/'nine_slice_2x.jpg',quality=94)
checks=[]
for e in manifest:
    for state,path in e['states'].items():
        p=ROOT/'素材'/path;im=Image.open(p);a=im.getchannel('A');bbox=a.getbbox();w,h=im.size
        checks.append({'file':path,'rgba':im.mode=='RGBA','hashMatch':sha(p)==e['sha256'][state],'sameStateSize':list(im.size)==e['size'],'alphaBbox':bbox,'safePadding':min(bbox[0],bbox[1],w-bbox[2],h-bbox[3]) if bbox else None})
(REC/'technical_checks.json').write_text(json.dumps({'assets':len(manifest),'pngs':len(files),'checks':checks},indent=2),encoding='utf-8')
print(json.dumps({'assets':len(manifest),'pngs':len(files),'record':str(REC)}))
