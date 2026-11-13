"""P2-1 only. Run from Project root. Never writes assets/, tools/ or P0/P1 art."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import numpy as np
from scipy.ndimage import distance_transform_edt, map_coordinates
import hashlib, json, math

ROOT = Path('docs/v2')
ART = ROOT / '素材'
REC = ROOT / '制作记录/补充20261113'
CMP = REC / '对照'
CMP.mkdir(parents=True, exist_ok=True)
LANCZOS = Image.Resampling.LANCZOS
S = 4
entries = []
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def save_json(path, obj): path.write_text(json.dumps(obj, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
def clean(im, pad=3):
    a = np.array(im.convert('RGBA'))
    if pad:
        a[:pad] = 0; a[-pad:] = 0; a[:, :pad] = 0; a[:, -pad:] = 0
    a[a[:,:,3] == 0] = 0
    return Image.fromarray(a)
def emit(folder, ident, name, states, slice=None, anchor=(.5,.5), **extra):
    paths, hashes = {}, {}
    for state, im in states.items():
        path = ART / folder / (ident + ('' if state=='default' else '_'+state) + '.png')
        path.parent.mkdir(parents=True, exist_ok=True)
        im.save(path); paths[state] = path.relative_to(ART).as_posix(); hashes[state] = sha(path)
    entries.append(dict(id=ident, name=name, states=paths, size=list(im.size), scale=1,
                        slice=slice, anchor=list(anchor), source='按 S02/S04 金棕描边、米白与深蓝配色制作；详见制作记录/补充20261113',
                        priority='P2', batch='P2-1', sha256=hashes, **extra))
def patch(im, sl, size):
    l,t,r,b=sl; w,h=im.size; W,H=size
    assert W>=l+r and H>=t+b
    out=Image.new('RGBA',size); xs=[0,l,w-r,w]; ys=[0,t,h-b,h]; xx=[0,l,W-r,W]; yy=[0,t,H-b,H]
    for j in range(3):
        for i in range(3):
            tile=im.crop((xs[i],ys[j],xs[i+1],ys[j+1])).resize((xx[i+1]-xx[i],yy[j+1]-yy[j]),LANCZOS)
            out.paste(tile,(xx[i],yy[j]))
    return out
def high(size): return Image.new('RGBA',(size[0]*S,size[1]*S))
def rounded(size, box, radius, fill, stroke=None, width=1):
    im=high(size); d=ImageDraw.Draw(im)
    d.rounded_rectangle(tuple(round(v*S) for v in box),radius=radius*S,fill=fill,outline=stroke,width=width*S)
    return im
def gradient(size, top, bottom):
    im=Image.new('RGBA',size); d=ImageDraw.Draw(im)
    for y in range(size[1]):
        f=y/max(1,size[1]-1); d.line((0,y,size[0],y),fill=tuple(round(a+(b-a)*f) for a,b in zip(top,bottom)))
    return im

# Preserve generated true alpha. Only remove isolated low-alpha chroma spill;
# opaque glove pixels, proportions and lighting remain the generated artwork.
raw=Image.open(REC/'guide_hand_source.png').convert('RGBA')
a=np.array(raw); spill=(a[:,:,0]>a[:,:,1]*1.25+20)&(a[:,:,2]>a[:,:,1]*1.25+20)&(a[:,:,3]<180)
a[spill]=0; raw=Image.fromarray(a)
cropmask=raw.getchannel('A').point(lambda v:255 if v>64 else 0)
raw=raw.crop(cropmask.getbbox()); raw.thumbnail((120,155),LANCZOS)
aa=np.array(raw.getchannel('A')); yy,xx=np.where(aa>=180); i=np.argmin(xx+yy)
localtip=(int(xx[i]),int(yy[i])); tip=(20,36)
offset=(tip[0]-localtip[0],tip[1]-localtip[1])
assert offset[0]>=3 and offset[1]>=3 and offset[0]+raw.width<=137 and offset[1]+raw.height<=197
hand=Image.new('RGBA',(140,200)); hand.alpha_composite(raw,offset); hand=clean(hand)
# Finger contact stays at the same anchor, while the palm/cuff move down 4px.
# Inverse vertical warp: compressed fingertip near contact, then smooth +4 shift.
y,x=np.mgrid[:200,:140].astype(float)
contact_curve=np.clip((y-tip[1])/18,0,1)
dy=-1.5*np.sin(math.pi*contact_curve)+4*np.clip((y-tip[1]-18)/45,0,1)
pressed_arr=np.stack([map_coordinates(np.array(hand)[:,:,c].astype(float),[y-dy,x],order=1,mode='constant') for c in range(4)],axis=2)
pressed=Image.fromarray(np.uint8(np.clip(pressed_arr,0,255)))
waves=high((140,200)); wd=ImageDraw.Draw(waves)
for rad,alpha in [(12,185),(16,80)]:
    wd.ellipse(tuple(v*S for v in (tip[0]-rad,tip[1]-rad*.55,tip[0]+rad,tip[1]+rad*.55)),outline=(255,205,73,alpha),width=2*S)
pressed=Image.alpha_composite(waves.resize((140,200),LANCZOS),pressed)
pressed=clean(pressed)
emit('UI/引导','guide_hand','引导手指',{'normal':hand,'pressed':pressed},anchor=(tip[0]/140,tip[1]/200),
     anchorOrigin='top-left',contactPixel=list(tip),palmPressedOffset=[0,4],
     sourceFile='制作记录/补充20261113/guide_hand_source.png',sourceSha256=sha(REC/'guide_hand_source.png'),
     animationNote='指尖接触点不动；掌部及腕部下移4px，按压波纹独立叠入pressed。不要再对Sprite整体加4px位移。')

# Compact rounded cream body. Curvature and shadow stay within 40px fixed corners.
sz=(160,96)
shadow=rounded(sz,(5,8,155,90),29,(76,42,19,75)).filter(ImageFilter.GaussianBlur(2*S))
body=rounded(sz,(4,4,155,87),29,(255,243,218,255),(154,100,43,255),2)
hi=rounded(sz,(7,7,152,84),26,None,(255,255,245,255),2)
body.alpha_composite(hi)
# Uniform cream at bottom attachment area makes tail seam deterministic.
shadow.alpha_composite(body); bubble=clean(shadow.resize(sz,LANCZOS))
emit('UI/引导','guide_bubble','引导米白气泡主体',{'default':bubble},[40,40,40,40])
tail=high((40,28)); td=ImageDraw.Draw(tail)
td.polygon([(5*S,0),(35*S,0),(22*S,24*S)],fill=(255,243,218,255))
td.line([(5*S,0),(22*S,24*S),(35*S,0)],fill=(154,100,43,255),width=2*S,joint='curve')
# No stroke on the top: 7px of cream hides the body's bottom border/shadow.
td.polygon([(4*S,0),(36*S,0),(32*S,7*S),(10*S,7*S)],fill=(255,243,218,255))
tail=clean(tail.resize((40,28),LANCZOS),0)
emit('UI/引导','guide_bubble_tail','引导气泡下尾',{'default':tail},attach={'edge':'bottom','overlapPixels':14,'topEdge':'open, intentional no padding for seamless overlap'})

sz=(200,200)
stroke=rounded(sz,(16,16,183,183),45,None,(255,194,39,255),6)
glow=stroke.filter(ImageFilter.GaussianBlur(4*S)); ga=np.array(glow); ga[:,:,3]=(ga[:,:,3]*.72).astype('uint8'); glow=Image.fromarray(ga)
glow.alpha_composite(stroke)
inner=rounded(sz,(19,19,180,180),42,None,(255,251,196,255),2); glow.alpha_composite(inner)
ring=clean(glow.resize(sz,LANCZOS))
# Enforce a completely transparent center, including any numerical blur tail.
ra=np.array(ring); ra[64:136,64:136]=0; ring=Image.fromarray(ra)
emit('UI/引导','guide_ring','引导金色目标光圈',{'default':ring},[64,64,64,64])

sz=(120,72)
shadow=rounded(sz,(4,7,115,67),30,(1,10,35,70)).filter(ImageFilter.GaussianBlur(S))
toast=rounded(sz,(4,4,115,63),29,(14,42,92,217),(169,202,239,225),1)
shadow.alpha_composite(toast); toast=clean(shadow.resize(sz,LANCZOS))
# Preserve the specified fill color/opacity after premultiplied resampling and
# prevent the drop shadow beneath the solid field from raising its opacity.
ta=np.array(toast); field=np.all(ta==ta[34,60],axis=2); ta[field]=[14,42,92,217]; toast=Image.fromarray(ta)
emit('UI/通用','toast_bg','深蓝半透明短提示底',{'default':toast},[36,30,36,30])

mother=ART/'六角块/母件'
well=Image.open(mother/'empty_well.png').convert('RGBA'); mask=np.array(well.getchannel('A'))
dist=distance_transform_edt(np.pad(mask>0,1))[1:-1,1:-1]
# Entire outer support is exactly inherited, with coarse gold/white inner rings.
strong=np.zeros((105,121,4),dtype=np.uint8)
strong[:,:,:3]=[255,247,224]; strong[:,:,3]=np.minimum(mask,89)
inner_alpha=np.uint8(89+100*np.exp(-np.maximum(dist-7,0)/3))
strong[:,:,3]=np.minimum(mask,inner_alpha)
for condition, rgb, alpha in [((dist<=7)&(dist>3),[255,255,239],255),(dist<=3,[255,196,48],255)]:
    strong[condition,:3]=rgb; strong[condition,3]=np.minimum(mask[condition],alpha)
strong[mask==0]=0
strong=Image.fromarray(strong); strong.save(mother/'line_highlight_strong.png')

# Help-only rotation turns flat-top mother art into a pointy-top teaching diagram.
# Center uses three paired sectors so all three full axes remain visible.
helpim=high((560,380)); cx,cy=280*S,190*S; scale=.60*S
colors=['1_png_蜜金.png','10_png_桃粉.png','6_png_青蓝.png']
tile_by_axis=[Image.open(mother/f).convert('RGBA') for f in colors]
cell_records=[]
def help_tile(im):
    return im.rotate(90,expand=True).resize((round(105*scale),round(121*scale)),LANCZOS)
for r in range(-2,3):
    for q in range(-2,3):
        if max(abs(q),abs(r),abs(q+r))>2: continue
        axis=0 if r==0 else 1 if q==0 else 2 if q+r==0 else None
        src=well if axis is None else tile_by_axis[axis]
        tile=help_tile(src)
        if q==r==0:
            arr=np.array(tile); ty,tx=np.mgrid[:tile.height,:tile.width]; theta=np.arctan2(ty-tile.height/2,tx-tile.width/2)
            # opposite 60-degree sectors correspond to each crossing line.
            sector=np.floor((theta+math.pi/6)/(math.pi/3)).astype(int)%3
            for ax in range(3):
                other=np.array(help_tile(tile_by_axis[ax])); arr[sector==ax]=other[sector==ax]
            tile=Image.fromarray(arr)
        # pointy-top axial: horizontal r=0, the other axes slope +/-60 degrees.
        x=cx+52*(2*q+r)*scale; y=cy+90*r*scale
        helpim.alpha_composite(tile,(round(x-tile.width/2),round(y-tile.height/2)))
        cell_records.append({'axial':[q,r],'axis':axis,'center':[x/S,y/S]})
hd=ImageDraw.Draw(helpim)
arrow_colors=[(255,202,43,255),(255,111,164,255),(76,224,245,255)]
for angle,col in zip([0,60,120],arrow_colors):
    a=math.radians(angle); ux,uy=math.cos(a),math.sin(a); vx,vy=-uy,ux
    # One directional arrow per complete axis, beyond the terminal cell.
    st=155; en=181
    p=(cx+st*S*ux,cy+st*S*uy); end=(cx+en*S*ux,cy+en*S*uy)
    hd.line([p,end],fill=(82,52,29,255),width=8*S); hd.line([p,end],fill=col,width=5*S)
    pts=[end,(end[0]-14*S*ux+9*S*vx,end[1]-14*S*uy+9*S*vy),(end[0]-14*S*ux-9*S*vx,end[1]-14*S*uy-9*S*vy)]
    hd.polygon(pts,fill=col)
helpim=clean(helpim.resize((560,380),LANCZOS))
emit('UI/无尽','endless_help_axes','无尽三向整线说明',{'default':helpim},
     sourceFiles=['素材/六角块/母件/empty_well.png']+['素材/六角块/母件/'+f for f in colors],
     diagram={'radius':2,'cellCount':19,'lines':3,'cellsPerLine':5,'center':'three paired color sectors','rotationForIllustrationOnly':90})

manifest_path=ROOT/'美术交付清单.json'; manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['uiAssets']=[e for e in manifest['uiAssets'] if e.get('batch')!='P2-1']+entries
manifest['p2Additions']=[dict(id='line_highlight_strong',name='无尽满线加强高亮',file='六角块/母件/line_highlight_strong.png',size=[121,105],scale=1,
    priority='P2',batch='P2-1',sha256=sha(mother/'line_highlight_strong.png'),source='复用empty_well的逐像素Alpha轮廓；新绘金白内描边和暖白内光',
    sourceFile='素材/六角块/母件/empty_well.png',sourceSha256=sha(mother/'empty_well.png'),centerOpacity=89/255)]
manifest['uiDeliveries']['P2-1']=dict(date='2026-11-13',newAssetGroups=7,newUiAssetGroups=6,newPngFiles=8,newUiPngFiles=7,newLayouts=[],
    verification='制作记录/补充20261113/verification.json',comparisons='制作记录/补充20261113/对照/',runtimeModified=False)
save_json(manifest_path,manifest)
save_json(REC/'help_geometry.json',cell_records)

# Comparison sheets use text only as QA annotations, never baked into runtime art.
FONT=Path('C:/Windows/Fonts/msyh.ttc')
def font(n): return ImageFont.truetype(str(FONT),n)
def text(im,xy,label,n=22,fill='#183555'):
    ImageDraw.Draw(im).text(xy,label,font=font(n),fill=fill)
def background(size,kind):
    im=Image.new('RGBA',size,kind if kind!='checker' else '#d5dbe4')
    if kind=='checker':
        d=ImageDraw.Draw(im)
        for y in range(0,size[1],16):
            for x in range(0,size[0],16):
                if (x//16+y//16)%2==0:d.rectangle((x,y,x+15,y+15),fill='#f6f7fa')
    return im

s04=Image.open(next((ROOT/'效果图').glob('S04_*.png'))).convert('RGBA')
overlay=s04.copy(); overlay.alpha_composite(patch(ring,[64]*4,(280,230)),(27,1270))
overlay.alpha_composite(patch(bubble,[40]*4,(390,112)),(70,1115))
overlay.alpha_composite(tail,(210,1213))
overlay.alpha_composite(hand,(round(140-tip[0]),round(1364-tip[1])) )
text(overlay,(102,1150),'拖动拼块，填满蜂巢',28,'#644014')
s02=Image.open(next((ROOT/'效果图').glob('S02_*.png'))).convert('RGBA'); toastscene=s02.copy()
toastscene.alpha_composite(patch(toast,[36,30,36,30],(520,88)),(167,880))
text(toastscene,(233,902),'通关第 5 关后开放',30,'white')
scene=Image.new('RGB',(4*427,990),'#edf2f9')
for i,(im,label) in enumerate([(s04,'S04 原图'),(overlay,'S04 引导叠加（1倍坐标）'),(s02,'S02 原图'),(toastscene,'S02 短提示520×88')]):
    text(scene,(i*427+12,14),label,21); scene.paste(im.resize((427,921),LANCZOS).convert('RGB'),(i*427,59))
scene.save(CMP/'01_原图场景对照.jpg',quality=95)

old=Image.open(mother/'line_highlight.png').convert('RGBA')
tilefiles=sorted(mother.glob('*_png_*.png'),key=lambda p:int(p.name.split('_')[0]))+[mother/'empty_well.png']
compare=Image.new('RGB',(1300,1140),'#edf2f9')
text(compare,(30,16),'12色及空槽：左=原件 / 中=旧高亮 / 右=P2加强高亮',28)
for i,path in enumerate(tilefiles):
    x=(i%3)*430+14; y=(i//3)*211+74; base=Image.open(path).convert('RGBA')
    text(compare,(x,y),path.stem,19)
    for j,layer in enumerate([None,old,strong]):
        tile=base.copy()
        if layer is not None:tile.alpha_composite(layer)
        bg=background((125,110),'#0E2A5C'); bg.alpha_composite(tile,(2,2)); compare.paste(bg.convert('RGB'),(x+j*132,y+35))
compare.save(CMP/'02_全色母件新旧高亮.png')

qa=Image.new('RGB',(1600,1500),'#edf2f9')
text(qa,(22,16),'透明边检查：白底 / 深蓝底 / 棋盘格；下方九宫格及指尖配准',28)
ui=[hand,pressed,bubble,tail,ring,toast,helpim,strong]
for j,kind in enumerate(['#ffffff','#0E2A5C','checker']):
    bg=background((510,810),kind)
    placements=[(hand,(12,12)),(pressed,(170,12)),(bubble,(12,230)),(tail,(210,255)),(ring,(285,12)),(toast,(12,365)),(helpim.resize((504,342),LANCZOS),(3,455)),(strong,(350,250))]
    for im,pos in placements:bg.alpha_composite(im,pos)
    qa.paste(bg.convert('RGB'),(j*530+10,70))
text(qa,(20,900),'九宫格：3倍宽；气泡/光圈另加2倍宽高；尾巴重叠14px接缝',22)
qa.paste(patch(bubble,[40]*4,(480,96)),(15,950),patch(bubble,[40]*4,(480,96)))
qa.paste(tail,(230,1032),tail)
qa.paste(patch(toast,[36,30,36,30],(360,72)),(530,965),patch(toast,[36,30,36,30],(360,72)))
qa.paste(patch(ring,[64]*4,(600,200)),(940,950),patch(ring,[64]*4,(600,200)))
qa.paste(patch(bubble,[40]*4,(320,192)),(15,1120),patch(bubble,[40]*4,(320,192)))
qa.paste(patch(ring,[64]*4,(400,400)),(370,1070),patch(ring,[64]*4,(400,400)))
text(qa,(820,1210),'两帧固定指尖（红十字）',22)
reg=background((280,400),'#0E2A5C'); reg.alpha_composite(hand.resize((280,400),LANCZOS))
p=pressed.copy(); p.putalpha(p.getchannel('A').point(lambda a:a//2)); reg.alpha_composite(p.resize((280,400),LANCZOS))
rd=ImageDraw.Draw(reg); tx,ty=tip[0]*2,tip[1]*2
rd.line((tx-12,ty,tx+12,ty),fill='red',width=1); rd.line((tx,ty-12,tx,ty+12),fill='red',width=1)
qa.paste(reg.resize((140,200),LANCZOS).convert('RGB'),(1200,1220))
qa.save(CMP/'03_透明九宫格及指尖检查.png')
print('P2-1: 8 runtime PNGs, 6 uiAssets groups + 1 p2Additions; comparisons created.')
