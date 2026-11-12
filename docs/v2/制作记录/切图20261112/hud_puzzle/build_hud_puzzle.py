"""P0 HUD/home/build/puzzle: non-destructive v2-source-derived transparent UI parts.
Run from the repository root. Only owns its four UI subfolders and this record folder.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageOps
import json, hashlib, math, colorsys
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'素材'/'UI'
REC=Path(__file__).resolve().parent
REF={s:next((ROOT/'效果图').glob(s+'_*.png')) for s in ['S02','S03','S04','S05']}
IMG={s:Image.open(p).convert('RGBA') for s,p in REF.items()}
M=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def mask(size,r,pad=3):
    k=4; im=Image.new('L',(size[0]*k,size[1]*k));d=ImageDraw.Draw(im)
    d.rounded_rectangle((pad*k,pad*k,(size[0]-pad)*k-1,(size[1]-pad)*k-1),radius=r*k,fill=255)
    return im.resize(size,Image.Resampling.LANCZOS)
def cleanalpha(im):
    # Alpha=0 has RGB=0. This removes interpolation residue from transparent texels.
    p=im.load()
    for y in range(im.height):
        for x in range(im.width):
            if x<3 or y<3 or x>=im.width-3 or y>=im.height-3 or p[x,y][3]==0:p[x,y]=(0,0,0,0)
    return im
def crop(s,box,r):
    im=IMG[s].crop(box);im.putalpha(mask(im.size,r));return im
def erase(im,box,left,right):
    """Interpolate clean columns only across the decorated middle; preserve full bevel caps."""
    p=im.load();x0,y0,x1,y1=box
    for y in range(y0,y1):
        a=p[left,y];b=p[right,y]
        for x in range(x0,x1):
            t=(x-left)/(right-left);p[x,y]=tuple(round(a[i]*(1-t)+b[i]*t) for i in range(3))+(p[x,y][3],)
    return im
def blankrow(s,box,r,cols,size=None):
    """Keep reference contour/light/shadow; replace interior with adjacent unlettered rows."""
    im=crop(s,box,r)
    im=erase(im,(cols[0],3,cols[1],im.height-3),cols[0]-1,cols[1])
    if size:im=im.resize(size,Image.Resampling.LANCZOS)
    return im
def caps(s,box,w,r):
    cap=IMG[s].crop(box);h=cap.height;c=cap.width
    im=Image.new('RGBA',(w,h));im.paste(ImageOps.mirror(cap),(0,0));im.paste(cap,(w-c,0))
    strip=cap.crop((0,0,1,h)).resize((w-c*2,h));im.paste(strip,(c,0));im.putalpha(mask(im.size,r))
    return im
def bevel(size,top,bottom,r=25,edge='#277cc3',lip='#125fb0',pad=3):
    """Match broad 2.5D v2 bevel. Generated from documented reference palette, no symbols."""
    w,h=size;im=Image.new('RGBA',size);p=im.load()
    def rgb(v):return tuple(int(v[i:i+2],16) for i in (1,3,5))
    a,b=rgb(top),rgb(bottom)
    for y in range(h):
        t=y/(h-1)
        for x in range(w):
            side=.91+.09*math.sin(math.pi*x/max(1,w-1))
            p[x,y]=tuple(round((a[i]*(1-t)+b[i]*t)*side) for i in range(3))+(255,)
    im.putalpha(mask(size,r,pad));d=ImageDraw.Draw(im)
    d.rounded_rectangle((pad+1,pad+1,w-pad-2,h-pad-2),radius=r-1,outline=edge,width=3)
    # Wide soft bevel, rather than drawn fine white contour lines. Original S02/S04
    # caps use this same upper-left highlight and broad shaded lower edge.
    hi=Image.new('RGBA',size);hd=ImageDraw.Draw(hi)
    hd.rounded_rectangle((pad+5,pad+5,w-pad-6,h-pad-8),radius=r-5,outline=(194,247,255,52),width=7)
    hd.line((r,pad+6,w-r,pad+6),fill=(225,255,255,130),width=4)
    im.alpha_composite(hi.filter(ImageFilter.GaussianBlur(2)))
    im.putalpha(mask(size,r,pad))
    return im
def recolor(im,mode):
    im=im.copy();p=im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=p[x,y]
            if mode=='pressed':r,g,b=[round(v*.80) for v in (r,g,b)]
            elif mode=='disabled':
                v=(r*.21+g*.72+b*.07);r,g,b=[round(v*.48+c) for c in (52,65,82)]
            elif mode=='insufficient':r,g,b=round(r*.65+80),round(g*.6+25),round(b*.65+30)
            p[x,y]=(min(255,r),min(255,g),min(255,b),a)
    return im
def emit(folder,id,name,im,s,sl=None,states=None,box=None,method='reference palette/contour reconstruction'):
    target=OUT/folder;target.mkdir(parents=True,exist_ok=True)
    paths={};hashes={}
    variants=states or {'normal':im}
    for state,layer in variants.items():
        path=target/(id+('_'+state if states else '')+'.png');cleanalpha(layer).save(path)
        paths[state]=path.relative_to(ROOT/'素材').as_posix();hashes[state]=sha(path)
    item={'id':id,'name':name,'states':paths,'size':list(im.size),'scale':1,'anchor':[.5,.5],'source':s+' '+method,'sourceFile':REF[s].relative_to(ROOT).as_posix(),'sourceHash':sha(REF[s]),'priority':'P0','sha256':hashes}
    if sl:item['slice']=sl
    if box:item['sourceRect']=list(box)
    M.append(item)
    return im
def states(im,disabled=False):
    out={'normal':im,'pressed':recolor(im,'pressed')}
    if disabled:out['disabled']=recolor(im,'disabled')
    return out

# HUD: minimum stretchable blanks retain the exact reference cream and blue family.
im=bevel((244,148),'#425bbb','#243d92',38,edge='#425fc0',lip='#2c479b')
emit('HUD','hud_bar_bg','顶部深蓝资源栏底条',im,'S02',[42,24,42,42])
im=caps('S02',(448,44,488,117),180,34)
emit('HUD','hud_capsule_light','米白资源胶囊',im,'S02',[40,24,40,24],box=[448,44,40,73],method='clean cream right cap mirrored and middle strip extended')
im=caps('S04',(653,44,698,128),180,38)
emit('HUD','hud_capsule_dark','深蓝资源胶囊',im,'S04',[45,28,45,28],box=[653,44,45,84],method='clean dark blue right cap mirrored and middle strip extended')
# Six-sided level shield: outline and foil use S02's gold palette; no embedded number.
im=Image.new('RGBA',(98,108));d=ImageDraw.Draw(im)
poly=[(49,4),(91,27),(91,78),(49,103),(7,78),(7,27)]
d.polygon(poly,fill='#db8d02');d.line(poly+[poly[0]],fill='#f9c516',width=4)
poly2=[(49,9),(86,30),(86,74),(49,97),(12,74),(12,30)]
d.polygon(poly2,fill='#ffcb23');d.line(poly2+[poly2[0]],fill='#fff5a4',width=4)
d.polygon([(49,17),(79,34),(79,69),(49,88),(20,69),(20,34)],fill='#ffdc37')
emit('HUD','hud_level_badge','黄色六边形等级徽章',im,'S02',box=[20,27,98,108])
for id,folder,size,c,s,r in [
 ('hud_btn_square_purple','HUD',(98,98),('#a090ff','#6345de','#bdb0ff','#8057e8'),'S02',31),
 ('hud_btn_square_blue','HUD',(102,92),('#2098c9','#0c66a8','#77ddf7','#1479b6'),'S04',29),
 ('home_side_entry','主页',(140,140),('#b3a2ff','#6442c1','#d4c3ff','#8059dd'),'S02',32),
 ('home_btn_home','主页',(136,100),('#51b1ff','#0764d6','#9ee4ff','#177ce4'),'S02',27)]:
    im=bevel(size,c[0],c[1],r,edge=c[2],lip=c[3])
    if id=='hud_btn_square_purple':
        im=crop('S02',(742,32,840,130),r);erase(im,(17,18,82,80),13,84)
    if id=='hud_btn_square_blue':
        im=crop('S04',(31,37,133,129),r);erase(im,(24,17,80,76),20,82)
    emit(folder,id,{'hud_btn_square_purple':'设置紫色底','hud_btn_square_blue':'拼图HUD蓝色底','home_side_entry':'侧边入口紫框底','home_btn_home':'底栏蓝色回家底'}[id],im,s,states=states(im) if id!='home_side_entry' else None)
im=bevel((132,49),'#fff5e8','#ffe7ce',23,edge='#fff9ef',lip='#ead5bf')
emit('主页','home_side_label','侧边入口米白文字底',im,'S02',[26,17,26,17])
cap=IMG['S02'].crop((644,1555,719,1703))
im=Image.new('RGBA',(300,148));im.paste(ImageOps.mirror(cap),(0,0));im.paste(cap,(225,0))
strip=IMG['S02'].crop((644,1555,645,1703)).resize((150,148));im.paste(strip,(75,0));im.putalpha(mask(im.size,68))
emit('主页','home_play_btn','开始游戏青绿主体',im,'S02',[75,40,75,40],states=states(im),box=[644,1555,75,148],method='source clean right cap mirrored; symbol-free center column extended')
# Arrow: preserve the distinctive S02 purple arrow silhouette; synthesize clean interior.
im=IMG['S02'].crop((140,1563,338,1691));d=ImageDraw.Draw(im)
p=[(62,5),(137,5),(191,64),(139,122),(62,122),(36,115),(15,95),(6,68),(14,39),(34,15)]
am=Image.new('L',(198*4,128*4));ImageDraw.Draw(am).polygon([(x*4,y*4) for x,y in p],fill=255)
im.putalpha(am.resize(im.size,Image.Resampling.LANCZOS));erase(im,(47,29,147,101),43,148)
emit('主页','home_play_level_arrow','开始按钮左侧紫色关号箭头底',im,'S02',box=[140,1563,198,128],method='source crop; number removed with clean neighboring violet columns')
im=bevel((200,115),'#fff8ed','#ffe8d3',48,edge='#ffffff',lip='#e1cdbb')
emit('主页','home_bottom_bar','底部米白底栏',im,'S02',[56,34,56,34])
im=bevel((180,86),'#fff6e9','#ffe7d1',39,edge='#fffdf7',lip='#e2cdbb')
emit('主页','home_btn_build','底栏建造胶囊底',im,'S02',[43,28,43,28],states=states(im))

# Construction dots are extracted directly (no text) and have identical canvases.
for state,box in [('done',(376,656,400,680)),('todo',(451,656,475,680))]:
    dot=IMG['S03'].crop(box).resize((22,22),Image.Resampling.LANCZOS)
    dot.putalpha(mask(dot.size,9,2));im=Image.new('RGBA',(28,28));im.alpha_composite(dot,(3,3))
    if state=='done':done=im
    else:todo=im
emit('建造','build_dot','建筑等级圆点',done,'S03',states={'done':done,'todo':todo},method='source crop + circle alpha')
im=bevel((148,38),'#fff4dd','#ead6b8',16,edge='#fffbe9',lip='#e4cdad')
emit('建造','build_dot_bar','五等级圆点底托',im,'S03',[19,12,19,12])
im=bevel((150,70),'#fff8e7','#ffe6c6',32,edge='#fffef1',lip='#cebeb1')
emit('建造','build_cost_capsule','建筑费用胶囊',im,'S03',[35,23,35,23],states={'normal':im,'insufficient':recolor(im,'insufficient')})

# Puzzle decorative title swoosh: use the actual clean gold pixels, remove navy by hue.
im=IMG['S04'].crop((277,263,562,293))
p=im.load()
for y in range(im.height):
    for x in range(im.width):
        r,g,b,a=p[x,y];alpha=max(0,min(255,round((min(r,g)-b-5)*4)))
        p[x,y]=(r,g,b,alpha)
pad=Image.new('RGBA',(im.width+6,im.height+6));pad.alpha_composite(im,(3,3));im=pad
emit('拼图','puzzle_title_line','关号下方金色弧线',im,'S04',box=[277,263,285,30],method='source gold hue extraction')
# Tray border: blank data-driven tray frame, no baked pieces, exact 1x corner radius.
im=bevel((180,180),'#153e68','#10365b',46,edge='#62d4f3',lip='#2789b5')
emit('拼图','puzzle_tray_frame','拼图托盘圆角框',im,'S04',[48,48,48,48])
for color,top,bottom,edge,lip in [('blue','#39b7ff','#096bdc','#83ecff','#2389e8'),('purple','#bf7bff','#723de1','#d9a7ff','#9658f0'),('teal','#30e3d5','#00a99c','#8bfff2','#0bc9bc')]:
    # Preserve original upper rim and lower lip; replace only the symbol-bearing field.
    x={'blue':91,'purple':340,'teal':590}[color]
    im=crop('S04',(x,1598,x+176,1744),40)
    erase(im,(34,24,145,116),29,146)
    if color=='blue':blue_source=im.copy()
    if color=='teal':
        # Hint count overlaps the right bevel in the flattened source. Reuse the
        # identical clean blue contour and remap to S04's teal hue, avoiding ghost digits.
        im=blue_source.copy();px=im.load()
        for yy in range(im.height):
            for xx in range(im.width):
                rr,gg,bb,aa=px[xx,yy];hh,ss,vv=colorsys.rgb_to_hsv(rr/255,gg/255,bb/255)
                rr,gg,bb=colorsys.hsv_to_rgb(.475,ss,vv);px[xx,yy]=(round(rr*255),round(gg*255),round(bb*255),aa)
    emit('拼图','puzzle_btn_'+color,{'blue':'撤销蓝色按钮底','purple':'重玩紫色按钮底','teal':'提示青绿按钮底'}[color],im,'S04',[43,43,43,43],states=states(im,True),box=[x,1598,176,146],method='source crop; center symbol removal using clean adjacent column interpolation')
im=bevel((42,42),'#f9fff2','#d2f9d8',18,edge='#ffffff',lip='#abdbc3')
emit('拼图','puzzle_badge_count','工具数量角标底',im,'S04',method='S04 reference palette; separate badge slot')
im=bevel((166,62),'#fffbe9','#ffecc6',28,edge='#ffd75f',lip='#f2bb36')
warning=recolor(im,'insufficient')
emit('拼图','puzzle_steps_plate','剩余步数小牌底',im,'S05',[32,22,32,22],states={'normal':im,'warning':warning})

(REC/'manifest.json').write_text(json.dumps(M,ensure_ascii=False,indent=2),encoding='utf-8')

def nine(im,sl,size):
    l,t,r,b=sl;w,h=im.size;dw,dh=size;out=Image.new('RGBA',size)
    xx=[0,l,w-r,w];yy=[0,t,h-b,h];dx=[0,l,dw-r,dw];dy=[0,t,dh-b,dh]
    for i in range(3):
        for j in range(3):
            p=im.crop((xx[i],yy[j],xx[i+1],yy[j+1])).resize((dx[i+1]-dx[i],dy[j+1]-dy[j]),Image.Resampling.LANCZOS)
            out.alpha_composite(p,(dx[i],dy[j]))
    return out
def check_sheet():
    font='C:/Windows/Fonts/arial.ttf'
    from PIL import ImageFont
    f=ImageFont.truetype(font,15)
    items=[]
    for a in M:
        for st,path in a['states'].items():items.append((a,st,Image.open(ROOT/'素材'/path)))
    # Every asset/state on the three required backgrounds, at 1x for small parts.
    sheet=Image.new('RGB',(1080,len(items)*190),'#e8edf3');d=ImageDraw.Draw(sheet)
    for i,(a,st,im) in enumerate(items):
        y=i*190;d.text((8,y+3),a['id']+' / '+st,fill='#112747',font=f)
        for j,bg in enumerate(['#ffffff','#0e2a5c','checker']):
            tile=Image.new('RGBA',(352,158),bg if bg!='checker' else '#e8e8e8')
            if bg=='checker':
                td=ImageDraw.Draw(tile)
                for xx in range(0,352,12):
                    for yy in range(0,158,12):
                        if (xx//12+yy//12)%2:td.rectangle((xx,yy,xx+11,yy+11),fill='#bec6d1')
            p=ImageOps.contain(im,(344,150),Image.Resampling.LANCZOS)
            tile.alpha_composite(p,((352-p.width)//2,(158-p.height)//2));sheet.paste(tile.convert('RGB'),(j*360,y+26))
    sheet.save(REC/'alpha_three_backgrounds.jpg',quality=94)
    sitems=[a for a in M if 'slice' in a]
    big=Image.new('RGB',(1200,len(sitems)*400),'#0e2a5c');d=ImageDraw.Draw(big)
    for i,a in enumerate(sitems):
        im=Image.open(ROOT/'素材'/next(iter(a['states'].values())));out=nine(im,a['slice'],(im.width*2,im.height*2))
        d.text((10,i*400+10),a['id']+' 2x width + height / corners retained',fill='white',font=f)
        big.paste(out,(20,i*400+45),out)
    big.save(REC/'nine_slice_double.jpg',quality=94)
check_sheet()
print(json.dumps({'groups':len(M),'pngFiles':sum(len(x['states']) for x in M)},ensure_ascii=False))
