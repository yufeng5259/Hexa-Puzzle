from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps, ImageChops
import json, hashlib, math, colorsys

ROOT=Path('F:/qiguobing/git/Hexa Puzzle/Project/docs/v2')
OUT=ROOT/'效果图'; REC=ROOT/'制作记录/扩展美术20261112/弹窗'
W,H=854,1842
MAIN=OUT/'S04_主玩法_BlockHexa风格.png'; BUILD=OUT/'S03_建造页_BlockHexa风格.png'
sources={}
def font(size,bold=True):return ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc' if bold else 'C:/Windows/Fonts/msyh.ttc',size)
def text(im,xy,s,size=32,color='#263d76',anchor='mm',bold=True):
    ImageDraw.Draw(im).text(xy,s,font=font(size,bold),fill=color,anchor=anchor)
def extract(src,box,kind):
    im=Image.open(src).convert('RGBA').crop(box); px=im.load()
    if kind=='coin':
        mask=Image.new('L',im.size);ImageDraw.Draw(mask).ellipse((2,2,im.width-3,im.height-3),fill=255);im.putalpha(mask)
        for y in range(im.height):
            for x in range(im.width):
                r,g,b,a=px[x,y]
                if b>r*1.05:px[x,y]=(r,g,b,0)
    elif kind=='heart':
        for y in range(im.height):
            for x in range(im.width):
                r,g,b,a=px[x,y]
                if not (r>g*1.12 and r>b*1.06):px[x,y]=(r,g,b,0)
    elif kind=='bulb':
        for y in range(im.height):
            for x in range(im.width):
                r,g,b,a=px[x,y]
                if g>r*1.1 or b>r*1.15:px[x,y]=(r,g,b,0)
    elif kind=='bee':
        for y in range(im.height):
            for x in range(im.width):
                r,g,b,a=px[x,y]
                if b>r*1.15 and b>g*1.05:px[x,y]=(r,g,b,0)
    if kind in ['heart','coin']:
        # Remove disconnected background specks from the screenshot crop.
        seen=set();groups=[]
        for yy in range(im.height):
            for xx in range(im.width):
                if (xx,yy) in seen or px[xx,yy][3]==0:continue
                stack=[(xx,yy)];seen.add((xx,yy));group=[]
                while stack:
                    a,b=stack.pop();group.append((a,b))
                    for q,r in [(a-1,b),(a+1,b),(a,b-1),(a,b+1)]:
                        if 0<=q<im.width and 0<=r<im.height and (q,r) not in seen and px[q,r][3]>0:seen.add((q,r));stack.append((q,r))
                groups.append(group)
        largest=set(max(groups,key=len))
        for yy in range(im.height):
            for xx in range(im.width):
                if (xx,yy) not in largest:
                    r,g,b,a=px[xx,yy];px[xx,yy]=(r,g,b,0)
    return im
COIN=extract(BUILD,(503,42,580,123),'coin')
HEART=extract(BUILD,(306,48,373,111),'heart')
SIGN=next(OUT.glob('S17_*.png'))
sign_im=Image.open(SIGN).convert('RGBA').resize((W,H))
BULB=sign_im.crop((170,861,238,944))
bm=Image.new('L',(68*4,83*4));bd=ImageDraw.Draw(bm)
bd.ellipse((3*4,2*4,64*4,61*4),fill=255);bd.rounded_rectangle((22*4,44*4,47*4,77*4),radius=8*4,fill=255);BULB.putalpha(bm.resize(BULB.size,Image.Resampling.LANCZOS))
BEE=extract(MAIN,(150,171,277,304),'bee')
for n,im in [('coin',COIN),('heart',HEART),('bulb',BULB),('bee',BEE)]: im.save(REC/(n+'_source_crop.png'))

raw=Image.open(REC/'panel_raw.png').convert('RGBA')
pix=raw.load()
for y in range(raw.height):
    for x in range(raw.width):
        r,g,b,a=pix[x,y]
        if r>g+45 and b>g+45:
            pix[x,y]=(r,g,b,0)
raw=raw.crop((28,104,998,1438));raw.save(REC/'panel_alpha.png')

def icon(im,which,center,size=120):
    src={'coin':COIN,'heart':HEART,'bulb':BULB,'bee':BEE}[which]
    p=ImageOps.contain(src,(size,size),Image.Resampling.LANCZOS)
    im.alpha_composite(p,(int(center[0]-p.width/2),int(center[1]-p.height/2)))

BUTTON=sign_im.crop((211,1352,644,1467))
# Remove the baked short word using adjacent clean columns; retain the AI cap,
# broad highlight, lower dark lip and rounded side shading.
bb=BUTTON.load()
for yy in range(15,101):
    left=bb[135,yy];right=bb[303,yy]
    for xx in range(136,303):
        t=(xx-135)/168;bb[xx,yy]=tuple(round(a+(b-a)*t) for a,b in zip(left,right))
mask=Image.new('L',(433*3,115*3));ImageDraw.Draw(mask).rounded_rectangle((0,0,432*3,114*3),radius=57*3,fill=255);BUTTON.putalpha(mask.resize(BUTTON.size,Image.Resampling.LANCZOS))
BUTTON.save(REC/'button_blank_from_S17.png')

def button(im,box,label,kind='teal',size=34):
    x0,y0,x1,y1=box;ww=x1-x0;hh=y1-y0
    layer=BUTTON.copy()
    if kind!='teal':
        pp=layer.load()
        for yy in range(layer.height):
            for xx in range(layer.width):
                r,g,b,a=pp[xx,yy];h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
                if kind=='gray': h,s,v=.61,s*.10,.66+v*.32
                else:h=.59 if kind=='blue' else .75
                rr,gg,bb=colorsys.hsv_to_rgb(h,s,v);pp[xx,yy]=(round(rr*255),round(gg*255),round(bb*255),a)
    layer=layer.resize((ww,hh),Image.Resampling.LANCZOS)
    shadow=Image.new('RGBA',im.size);sd=ImageDraw.Draw(shadow);sd.rounded_rectangle((x0,y0+7,x1,y1+7),radius=27,fill=(18,35,75,70));im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(6)))
    im.alpha_composite(layer,(x0,y0));dd=ImageDraw.Draw(im)
    text(im,((x0+x1)/2,(y0+y1)/2-1),label,size,'#ffffff' if kind!='gray' else '#526583')

def toggle(im,cy,on):
    x0=510;y0=cy-36;ww=180;hh=72
    top,bot=((69,235,186),(2,139,143)) if on else ((190,204,224),(100,121,151))
    track=Image.new('RGBA',(ww,hh));dd=ImageDraw.Draw(track)
    for yy in range(hh):
        t=yy/hh;dd.line((0,yy,ww,yy),fill=tuple(round(a+(b-a)*t) for a,b in zip(top,bot))+(255,))
    mask=Image.new('L',(ww*3,hh*3));ImageDraw.Draw(mask).rounded_rectangle((0,0,ww*3-1,hh*3-1),radius=hh*1.5,fill=255);track.putalpha(mask.resize((ww,hh),Image.Resampling.LANCZOS))
    shadow=Image.new('RGBA',im.size);ImageDraw.Draw(shadow).rounded_rectangle((x0,cy-31,x0+ww,cy+42),radius=36,fill=(21,42,81,90));im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(5)));im.alpha_composite(track,(x0,y0))
    draw=ImageDraw.Draw(im);draw.arc((x0+3,y0+3,x0+ww-3,y0+hh-3),190,350,fill=(238,255,255,150),width=3)
    cc=655 if on else 545
    knobshadow=Image.new('RGBA',im.size);ImageDraw.Draw(knobshadow).ellipse((cc-29,cy-25,cc+33,cy+36),fill=(16,53,94,90));im.alpha_composite(knobshadow.filter(ImageFilter.GaussianBlur(4)))
    knob=Image.new('RGBA',(62,62));kd=ImageDraw.Draw(knob)
    for yy in range(62):
        t=yy/62;v=round(255-27*t);kd.line((0,yy,62,yy),fill=(v,min(255,v+4),min(255,v+8),255))
    km=Image.new('L',(186,186));ImageDraw.Draw(km).ellipse((0,0,185,185),fill=255);knob.putalpha(km.resize((62,62),Image.Resampling.LANCZOS));im.alpha_composite(knob,(cc-31,cy-31));ImageDraw.Draw(im).arc((cc-27,cy-27,cc+27,cy+27),185,350,fill='white',width=3)

def background(path,state=None):
    im=Image.open(path).convert('RGBA').resize((W,H))
    if state:
        dd=ImageDraw.Draw(im)
        if 'energy' in state:
            dd.rectangle((375,54,446,110),fill='#fff2e4');text(im,(411,81),state['energy'],39)
        if 'coins' in state:
            dd.rectangle((587,53,715,110),fill='#fff2e4');text(im,(651,81),str(state['coins']),38)
        if 'level' in state:
            dd.rectangle((45,60,86,111),fill='#ffcc2d');text(im,(65,86),str(state['level']),48)
            dd.rounded_rectangle((113,62,267,96),radius=16,fill='#314b9b')
            if state.get('xp',0):dd.rounded_rectangle((113,62,113+int(154*state['xp']/100),96),radius=13,fill='#2fe3a5')
        if 'progress' in state:
            dd.rounded_rectangle((220,1748,633,1790),radius=20,fill='#324b9b')
            dd.rounded_rectangle((220,1748,220+int(413*state['progress']/25),1790),radius=20,fill='#2fe3a5')
            text(im,(425,1768),f"{state['progress']}/25",30,'white')
        if 'hints' in state:
            dd.rounded_rectangle((716,1607,751,1656),radius=10,fill='#16ada7');text(im,(734,1631),str(state['hints']),34,'white')
    im=im.filter(ImageFilter.GaussianBlur(2.2))
    im.alpha_composite(Image.new('RGBA',(W,H),(8,23,57,155)))
    return im

def modal(title,bg=MAIN,height=850,state=None):
    im=background(bg,state); y=(H-height)//2; x=65;pw=W-130
    panel=raw.resize((pw,height),Image.Resampling.LANCZOS);im.alpha_composite(panel,(x,y))
    text(im,(W/2,y+82),title,41,'#ffffff')
    return im,y

def close(im,y):
    x=746; yy=y+35
    ImageDraw.Draw(im).ellipse((x-22,yy-22,x+22,yy+22),fill='#285998',outline='#abdfff',width=2)
    d=ImageDraw.Draw(im);d.line((x-8,yy-8,x+8,yy+8),fill='white',width=4);d.line((x+8,yy-8,x-8,yy+8),fill='white',width=4)

def reward(im,y,which,value,label):
    d=ImageDraw.Draw(im);d.rounded_rectangle((235,y,619,y+216),radius=30,fill='#fff9ea',outline='#e9c779',width=2)
    icon(im,which,(W/2,y+80),116);text(im,(W/2,y+155),value,46);text(im,(W/2,y+195),label,23,'#8891a2',bold=False)

def save(sid,name,im,bg,details):
    f=OUT/f'{sid}_{name}_BlockHexa风格.png';im.convert('RGB').save(f)
    sources[sid]={'id':sid,'title':name,'file':f.relative_to(ROOT).as_posix(),'size':[W,H], 'background':str(Path(bg).relative_to(ROOT)),'production':'AI blank panel + approved original bitmap assets + exact Chinese typesetting; not an engine screenshot','details':details,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()}

def scene(levels,filename):
    folders=['B01_蜂巢主屋','B02_采蜜工坊','B03_花粉仓库','B04_蜂蜜水车','B05_花园亭']
    positions=[(.5,.36,.64),(.245,.505,.53),(.76,.505,.49),(.25,.725,.56),(.775,.71,.48)]
    if not all((ROOT/'素材/建筑'/f/f'{f[:3]}_L{lv}.png').exists() for f,lv in zip(folders,levels)):return None
    im=Image.open(ROOT/'地图/M01_晨露蜂园_背景.png').convert('RGBA').resize((W,H))
    for idx in sorted(range(5),key=lambda n:positions[n][1]):
        f=folders[idx];lv=levels[idx];xx,yy,ww=positions[idx]
        asset=Image.open(ROOT/'素材/建筑'/f/f'{f[:3]}_L{lv}.png').convert('RGBA');sz=round(W*ww);asset=asset.resize((sz,sz),Image.Resampling.LANCZOS)
        im.alpha_composite(asset,(round(W*xx-sz/2),round(H*yy-sz*544/576)))
        cy=round(H*yy)+15;d=ImageDraw.Draw(im)
        src=Image.open(BUILD).convert('RGBA')
        holder=src.crop((364,650,508,686)).resize((124,31),Image.Resampling.LANCZOS)
        hp=holder.load()
        for hy in range(holder.height):
            for hx in range(holder.width):
                rr,gg,bb,aa=hp[hx,hy]
                if gg>rr*1.12 and gg>bb*1.12:hp[hx,hy]=(rr,gg,bb,0)
        # Reuse the shaded green/gray orb bitmaps and original ivory holder.
        green=src.crop((376,657,399,680)).resize((21,21),Image.Resampling.LANCZOS)
        gray=src.crop((451,657,474,680)).resize((21,21),Image.Resampling.LANCZOS)
        orbmask=Image.new('L',(63,63));ImageDraw.Draw(orbmask).ellipse((1,1,61,61),fill=255);orbmask=orbmask.resize((21,21),Image.Resampling.LANCZOS);green.putalpha(orbmask);gray.putalpha(orbmask)
        for j,start in enumerate([9,32,53,74,95]):holder.alpha_composite(green if j<lv else gray,(start,5))
        hm=Image.new('L',(124*4,31*4));ImageDraw.Draw(hm).rounded_rectangle((0,0,124*4-1,31*4-1),radius=15*4,fill=255);holder.putalpha(ImageChops.multiply(holder.getchannel('A'),hm.resize(holder.size,Image.Resampling.LANCZOS)))
        im.alpha_composite(holder,(round(W*xx-62),cy-15))
        if lv<5:
            fee=[40,60,80,100,120][lv]
            capsule=src.crop((328,676,542,744))
            clean=capsule.crop((69,12,78,56)).resize((103,44),Image.Resampling.BICUBIC);capsule.alpha_composite(clean,(76,12))
            capsule=capsule.resize((174,55),Image.Resampling.LANCZOS);im.alpha_composite(capsule,(round(W*xx-87),cy+18));text(im,(W*xx+22,cy+45),str(fee),28)
            cp=capsule.load()
            for py in range(capsule.height):
                for px in range(capsule.width):
                    rr,gg,bb,aa=cp[px,py]
                    if gg>rr*1.10 and gg>bb*1.10:cp[px,py]=(rr,gg,bb,0)
            cm=Image.new('L',(174*4,55*4));ImageDraw.Draw(cm).rounded_rectangle((0,0,174*4-1,55*4-1),radius=27*4,fill=255);capsule.putalpha(ImageChops.multiply(capsule.getchannel('A'),cm.resize(capsule.size,Image.Resampling.LANCZOS)))
            # Replace the unmasked preliminary placement with the alpha-only asset.
            cleanbase=Image.open(ROOT/'地图/M01_晨露蜂园_背景.png').convert('RGBA').resize((W,H))
            left=round(W*xx-87);top=cy+18
            im.alpha_composite(cleanbase.crop((left,top,left+174,top+55)),(left,top));im.alpha_composite(capsule,(left,top));text(im,(W*xx+22,cy+45),str(fee),28)
    old=Image.open(BUILD).convert('RGBA');im.alpha_composite(old.crop((0,0,W,145)),(0,0));im.alpha_composite(old.crop((0,1658,W,H)),(0,1658))
    text(im,(W/2,195),'晨露蜂园',50,'white')
    total=sum(levels);lv=1+total//5;xp=(total*20)%100
    im.alpha_composite(level_badge(lv),(18,23))
    render_progress(im,total/25,(201,1744,644,1798),footer=True)
    render_progress(im,xp/100,(112,54,278,104),footer=False)
    ImageDraw.Draw(im).text((425,1768),f'{total}/25',font=font(30),fill='white',anchor='mm',stroke_width=1,stroke_fill='#314b83')
    path=REC/filename;im.save(path);return path

def completed_main_scene():
    im=Image.open(MAIN).convert('RGBA')
    # Keep the source board and replace its cell faces with their actual solved pieces.
    catalog=json.loads((ROOT.parent.parent/'assets/bundles/puzzle/config/level-catalog.json').read_text(encoding='utf-8'))
    level=next(x for x in catalog['levels'] if x['id']=='classic-060')
    radius=75;xy=lambda c:(1.5*radius*c['q'],math.sqrt(3)*radius*(c['r']+c['q']/2))
    pts=[xy(c) for c in level['targetCells']];cx=512-(min(x for x,y in pts)+max(x for x,y in pts))/2;cy=860-(min(y for x,y in pts)+max(y for x,y in pts))/2
    for piece in level['pieces']:
        tile_path=next((ROOT/'素材/六角块/母件').glob(piece['textureName']+'_*.png'))
        tile=Image.open(tile_path).convert('RGBA');tile=tile.resize((126,112),Image.Resampling.LANCZOS)
        for cell in piece['targetCells']:
            xx,yy=xy(cell);xx=(xx+cx)*W/1024;yy=(yy+cy)*H/2208
            im.alpha_composite(tile,(round(xx-63),round(yy-56)))
    tray=Image.new('RGBA',(W,H));td=ImageDraw.Draw(tray)
    td.rounded_rectangle((38,1236,816,1522),radius=39,fill='#11375e')
    im.alpha_composite(tray)
    path=REC/'S06_completed_state_background.png';im.save(path);return path

def failed_challenge_scene():
    challenge=next(iter(OUT.glob('S05_*.png')),MAIN);im=Image.open(challenge).convert('RGBA').resize((W,H))
    # The S05 stage uses a center remaining-move badge. Cover its figure while retaining the rest of the screenshot.
    d=ImageDraw.Draw(im);d.rounded_rectangle((307,289,548,346),radius=27,fill='#fff2de',outline='#e7bd58',width=2);text(im,(427,316),'剩余步数 0',31,'#263d76')
    path=REC/'S07_failed_state_background.png';im.save(path);return path

def level_badge(level):
    src=Image.open(BUILD).convert('RGBA').crop((18,23,115,133))
    mask=Image.new('L',src.size);ImageDraw.Draw(mask).polygon([(48,7),(91,31),(91,79),(48,105),(5,80),(5,31)],fill=255);src.putalpha(mask)
    d=ImageDraw.Draw(src);patch=src.copy()
    for yy in range(30,89):
        t=(yy-30)/59;ImageDraw.Draw(patch).line((24,yy,76,yy),fill=(255,round(222-30*t),round(47-20*t),255))
    blend=Image.new('L',src.size);ImageDraw.Draw(blend).rounded_rectangle((23,29,77,90),radius=10,fill=255);blend=blend.filter(ImageFilter.GaussianBlur(2));src=Image.composite(patch,src,blend)
    text(src,(49,59),str(level),57,'#263d76')
    p=src.load()
    for yy in range(src.height):
        for xx in range(src.width):
            rr,gg,bb,aa=p[xx,yy]
            if (gg>rr*1.07 and gg>bb*1.05) or ((xx<22 or xx>77 or yy<23 or yy>91) and bb>rr*1.05):p[xx,yy]=(rr,gg,bb,0)
    src.putalpha(src.getchannel('A').filter(ImageFilter.MinFilter(3)))
    return src

def render_progress(im,fraction,box,footer):
    src=Image.open(BUILD).convert('RGBA');x0,y0,x1,y1=box;ww=x1-x0;hh=y1-y0
    # Right endcap and an unlettered blue central strip restore an empty source bar.
    bar=src.crop(box);stripx=550 if footer else 248
    middle=src.crop((stripx,y0,stripx+8,y1)).resize((ww-50,hh),Image.Resampling.BICUBIC)
    right=bar.crop((ww-25,0,ww,hh));bar.alpha_composite(middle,(25,0));bar.alpha_composite(ImageOps.mirror(right),(0,0))
    if fraction>0:
        if footer:fill=src.crop((201,1744,366,1798));cap=28
        else:fill=src.crop((112,54,242,104));cap=20
        fw=max(cap*2+1,round((ww-7)*fraction));capsize=min(cap,fw//2)
        stretched=Image.new('RGBA',(fw,hh));stretched.alpha_composite(fill.crop((0,0,capsize,hh)),(0,0))
        center=fill.crop((capsize,0,fill.width-capsize,hh)).resize((max(1,fw-capsize*2),hh),Image.Resampling.BICUBIC);stretched.alpha_composite(center,(capsize,0));stretched.alpha_composite(fill.crop((fill.width-capsize,0,fill.width,hh)),(fw-capsize,0))
        sm=Image.new('L',(fw*4,hh*4));ImageDraw.Draw(sm).rounded_rectangle((0,0,fw*4-1,hh*4-1),radius=hh*2,fill=255);stretched.putalpha(sm.resize(stretched.size,Image.Resampling.LANCZOS));bar.alpha_composite(stretched,(0,0))
    im.alpha_composite(bar,(x0,y0))

def compose():
    solved=completed_main_scene()
    im,y=modal('通关成功',bg=solved,height=940);icon(im,'bee',(W/2,y+240),150);text(im,(W/2,y+340),'第71关 · 首次通关',30)
    reward(im,y+390,'coin','+100','金币已到账');text(im,(W/2,y+660),'金币充足，可以回家建造',26,'#6a7790',bold=False)
    button(im,(145,y+724,709,y+814),'下一关');button(im,(145,y+834,709,y+900),'回家建造','gray',29)
    save('S06','主线通关',im,solved,{'coins':100,'solved_cells':24,'tray_remaining':0})

    failed=failed_challenge_scene()
    im,y=modal('再试一次吧',bg=failed,height=860);icon(im,'bee',(W/2,y+260),140)
    text(im,(W/2,y+390),'剩余步数已用完',33);text(im,(W/2,y+447),'重新挑战需要 1 点体力',27,'#7c879c',bold=False)
    button(im,(145,y+572,709,y+662),'再试一次  ·  1体力');button(im,(145,y+690,709,y+770),'回家','gray')
    save('S07','主线失败',im,failed,{'new_attempt_energy':1,'failure_extra_cost':0,'moves_remaining':0})

    im,y=modal('回到家园？',height=860);icon(im,'bee',(W/2,y+252),140)
    text(im,(W/2,y+373),'当前进度可以保留',33);text(im,(W/2,y+424),'下次回来，继续这一次拼图',27,'#7c879c',bold=False)
    button(im,(145,y+530,709,y+622),'保存并回家');button(im,(145,y+650,709,y+734),'继续拼图','blue')
    text(im,(W/2,y+786),'放弃本局',27,'#b56b70');close(im,y)
    save('S08','主线退出确认',im,MAIN,{'preserve_session':True})

    im,y=modal('重新开始？',height=820);icon(im,'heart',(W/2,y+255),130)
    text(im,(W/2,y+378),'当前摆放将被清空',32);text(im,(W/2,y+432),'新开一局需要 1 点体力',27,'#7c879c',bold=False)
    button(im,(145,y+540,709,y+632),'确认重玩');button(im,(145,y+656,709,y+734),'继续当前局','gray',30);close(im,y)
    save('S09','重玩确认',im,MAIN,{'new_attempt_energy':1})

    im,y=modal('体力不足',height=910,bg=BUILD,state={'energy':'0/5'});icon(im,'heart',(W/2,y+255),145)
    text(im,(W/2,y+370),'0 / 5',52);text(im,(W/2,y+455),'下点恢复  04:32',33)
    text(im,(W/2,y+518),'每5分钟恢复1点，离线也能恢复',24,'#7c879c',bold=False)
    button(im,(145,y+635,709,y+727),'去玩蜂巢消消乐');button(im,(145,y+752,709,y+830),'返回','gray');close(im,y)
    save('S10','体力不足',im,BUILD,{'energy':0,'max':5,'timer':'04:32'})

    im,y=modal('金币不足',height=890,bg=BUILD,state={'coins':20});icon(im,'coin',(W/2,y+257),145)
    for j,(k,v) in enumerate([('当前拥有','20'),('升级需要','100'),('还差','80')]):
        text(im,(240,y+393+j*63),k,28,anchor='lm',bold=False);text(im,(613,y+393+j*63),v,34,anchor='rm')
    button(im,(145,y+630,709,y+720),'去闯关');button(im,(145,y+745,709,y+820),'稍后','gray');close(im,y)
    save('S11','金币不足',im,BUILD,{'owned':20,'required':100,'difference':80})

    im,y=modal('提示不足',height=860,state={'hints':0});icon(im,'bulb',(W/2,y+260),140);text(im,(W/2,y+388),'当前提示  0',37)
    text(im,(W/2,y+454),'签到与活动奖励可以获得提示',26,'#7c879c',bold=False);text(im,(W/2,y+505),'也可以先试着自己完成拼图',26,'#7c879c',bold=False)
    button(im,(145,y+660,709,y+755),'继续挑战');close(im,y)
    save('S12','提示不足',im,MAIN,{'hints':0})

    upgraded=scene([4,2,1,2,1],'S13_actual_asset_scene.png') or BUILD
    im,y=modal('玩家升级',height=900,bg=upgraded)
    badge=level_badge(3).resize((170,193),Image.Resampling.LANCZOS);im.alpha_composite(badge,(342,y+165))
    text(im,(W/2,y+386),'新等级 3',34);reward(im,y+430,'heart','+1','升级奖励已到账')
    button(im,(145,y+744,709,y+834),'确认')
    save('S13','玩家升级',im,upgraded,{'level':3,'energy_reward':1,'reward_already_granted':True,'levels':[4,2,1,2,1],'xp':0,'map_progress':10})

    endless=next(iter(sorted(OUT.glob('S20_*.png'))),None)
    if endless:
        im,y=modal('本局结束',bg=endless,height=1010);icon(im,'bee',(W/2,y+230),130)
        text(im,(W/2,y+365),'1,540',71);text(im,(W/2,y+425),'本局得分',27,'#7c879c')
        for j,(k,v) in enumerate([('本地最高分','2,680'),('本局新增活动积分','+1,540')]):
            text(im,(155,y+505+j*75),k,26,anchor='lm',bold=False);text(im,(695,y+505+j*75),v,32,anchor='rm')
        text(im,(W/2,y+681),'阶段奖励请返回活动页领取',25,'#7c879c',bold=False)
        button(im,(145,y+776,709,y+868),'再来一局');button(im,(145,y+894,709,y+972),'返回活动','gray')
        save('S21','无尽结算',im,endless,{'score':1540,'best':2680,'weekly_delta':1540,'direct_coin_reward':0})
        im,y=modal('暂时离开？',bg=endless,height=850);icon(im,'bee',(W/2,y+245),130)
        text(im,(W/2,y+366),'棋盘与剩余拼块都会保留',29);text(im,(W/2,y+417),'随时回来继续挑战',27,'#7c879c',bold=False)
        button(im,(145,y+525,709,y+615),'保存并返回活动',size=30);button(im,(145,y+640,709,y+720),'继续游戏','blue');text(im,(W/2,y+780),'结束本局',27,'#b56b70');close(im,y)
        save('S22','无尽退出确认',im,endless,{'preserve_session':True})

    home=next(iter(sorted(OUT.glob('S02_*.png'))),BUILD)
    im,y=modal('设置',bg=home,height=870)
    for j,(label,on) in enumerate([('音乐',True),('音效',True),('震动',False)]):
        cy=y+300+j*150;text(im,(190,cy),label,38,anchor='lm')
        toggle(im,cy,on)
        text(im,(W/2,cy),'开启' if on else '关闭',21,'#8a94a6',anchor='mm',bold=False)
    button(im,(145,y+735,709,y+815),'完成','blue');close(im,y)
    save('S23','设置',im,home,{'music':True,'sfx':True,'haptics':False})

    im,y=modal('进度暂未保存',height=850);icon(im,'bee',(W/2,y+255),130)
    text(im,(W/2,y+375),'请重试保存当前进度',32);text(im,(W/2,y+435),'当前拼图仍然保留在这里',27,'#7c879c',bold=False)
    text(im,(W/2,y+485),'保存成功后，再离开游戏',25,'#7c879c',bold=False)
    button(im,(145,y+590,709,y+682),'重试保存');button(im,(145,y+707,709,y+785),'继续当前局','gray',30)
    save('S24','保存失败',im,MAIN,{'saved':False,'session_preserved_in_memory':True})

    welcome=scene([1,0,0,0,0],'S25_actual_asset_scene.png') or BUILD
    im,y=modal('欢迎来到蜂巢小镇',bg=welcome,height=1030,state={'coins':60,'energy':'5/5'});icon(im,'bee',(W/2,y+244),150)
    text(im,(W/2,y+358),'第一座建筑落成啦！',31)
    for cx,which,value,label in [(280,'coin','+100','金币'),(575,'bulb','+1','提示')]:
        ImageDraw.Draw(im).rounded_rectangle((cx-112,y+425,cx+112,y+680),radius=28,fill='#fff9ea',outline='#e9c779',width=2)
        icon(im,which,(cx,y+510),110);text(im,(cx,y+600),value,41);text(im,(cx,y+650),label,25,'#7c879c')
    text(im,(W/2,y+762),'一起建设蜜蜂的家园吧',27,'#7c879c',bold=False)
    button(im,(145,y+865,709,y+961),'领取并继续')
    save('S25','首次建造欢迎奖励',im,welcome,{'coins':100,'hints':1,'energy':0,'levels':[1,0,0,0,0],'before_claim_coins':60,'level':1,'xp':20,'map_progress':1})
    # S14/S15 use the generated L5 building assets, not relabeled old screenshots.
    partial=scene([5,2,1,2,1],'S14_actual_asset_scene.png')
    if partial:
        im=Image.open(partial).convert('RGBA')
        d=ImageDraw.Draw(im);d.rounded_rectangle((535,238,832,301),radius=26,fill='#fff5df',outline='#e6bf59',width=3)
        text(im,(684,269),'建筑完成 · 金币+30',23)
        for xx,yy in [(285,310),(570,323),(625,550),(238,565)]:
            d.regular_polygon((xx,yy,11),4,rotation=0,fill='#ffdc6c')
        save('S14','单栋建筑满级',im,partial,{'levels':[5,2,1,2,1],'progress':11,'coins_reward':30,'non_modal':True,'source_building_assets':['B01_L5','B02_L2','B03_L1','B04_L2','B05_L1']})
    complete=scene([5,5,5,5,5],'S15_actual_asset_scene.png')
    if complete:
        im,y=modal('晨露蜂园完工',bg=complete,height=1030)
        icon(im,'bee',(W/2,y+235),145);text(im,(W/2,y+357),'25 / 25',46);text(im,(W/2,y+413),'五栋建筑全部完成',28)
        reward(im,y+466,'coin','+200','地图完工奖励')
        button(im,(145,y+792,709,y+884),'领取并前往下一地图',size=29);button(im,(145,y+910,709,y+984),'留在这里','gray',30)
        save('S15','地图完工',im,complete,{'levels':[5,5,5,5,5],'progress':25,'coins_reward':200,'source_building_assets':[f'B{i:02d}_L5' for i in range(1,6)]})
    manifest={'production':'composited using generated bitmap panel and approved original screenshots; real Chinese text','pages':list(sources.values()),'count':len(sources),'pending':[s for s in ['S14','S15','S21','S22'] if s not in sources]}
    (REC/'page_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    thumbs=Image.new('RGB',(5*256,math.ceil(len(sources)/5)*590),'#dce5f1');dd=ImageDraw.Draw(thumbs)
    for i,p in enumerate(sources.values()):
        t=Image.open(ROOT/p['file']);t.thumbnail((246,530));x=(i%5)*256+(256-t.width)//2;yy=(i//5)*590+35;thumbs.paste(t,(x,yy));dd.text(((i%5)*256+15,(i//5)*590+5),p['id']+' '+p['title'],font=font(20),fill='#24376a')
    thumbs.save(REC/'contact_sheet.png');print('Composed',len(sources),'pages; pending',manifest['pending'])

if __name__=='__main__':compose()
