"""P1-3 transparent sign-in states and task pieces. Originals and P0 stay read-only."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageOps,ImageChops
import json,hashlib,math
ROOT=Path('docs/v2'); ART=ROOT/'素材';REC=ROOT/'制作记录/切图20261112/P1/signin_tasks'
SIGN=ART/'UI/签到';TASK=ART/'UI/任务';S17=next((ROOT/'效果图').glob('S17_*.png'));S18=next((ROOT/'效果图').glob('S18_*.png'))
for p in [REC,SIGN,TASK]:p.mkdir(parents=True,exist_ok=True)
MAN=[];AA=3
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def grad(size,top,bot):
    im=Image.new('RGBA',size);d=ImageDraw.Draw(im)
    for y in range(size[1]):
        t=y/max(1,size[1]-1);d.line((0,y,size[0],y),fill=tuple(round(a+(b-a)*t) for a,b in zip(top,bot))+(255,))
    return im
def rr_mask(size,pad,r):
    m=Image.new('L',size);ImageDraw.Draw(m).rounded_rectangle((pad,pad,size[0]-1-pad,size[1]-1-pad),radius=r,fill=255);return m
def polygon_mask(size,points,rounding=0):
    m=Image.new('L',size);d=ImageDraw.Draw(m);d.polygon(points,fill=255)
    if rounding:d.line(points+[points[0]],fill=255,width=rounding,joint='curve')
    return m
def insetpts(pts,cx,cy,f):return [(cx+(x-cx)*f,cy+(y-cy)*f) for x,y in pts]
def polygrad(im,pts,top,bot,rounding=0):
    part=grad(im.size,top,bot);part.putalpha(polygon_mask(im.size,pts,rounding));im.alpha_composite(part)
def padded(im):
    im=im.copy();d=ImageDraw.Draw(im);w,h=im.size
    for b in [(0,0,w-1,2),(0,h-3,w-1,h-1),(0,0,2,h-1),(w-3,0,w-1,h-1)]:d.rectangle(b,fill=(0,0,0,0))
    return im
def reg(id,name,states,directory,source,source_file,slice=None,scale=1,extra=None):
    paths={};hashes={}
    for state,im in states.items():
        im=padded(im);filename=id+('' if state=='default' else '_'+state)+'.png';p=directory/filename;im.save(p);paths[state]=p.relative_to(ART).as_posix();hashes[state]=sha(p)
    e={'id':id,'name':name,'states':paths,'size':list(next(iter(states.values())).size),'scale':scale,'slice':slice or [0,0,0,0],'anchor':[.5,.5],'source':source,'sourceFile':source_file.relative_to(ROOT).as_posix(),'sourceSha256':sha(source_file),'priority':'P1','sha256':hashes}
    if extra:e.update(extra)
    MAN.append(e)
def badge(state,size):
    im=Image.new('RGBA',(size,size));s=AA;n=size*s;out=Image.new('RGBA',(n,n));fill=(81,203,55) if state=='claimed' else (127,137,163);bottom=(21,133,27) if state=='claimed' else (77,88,120)
    for pad,top,bot in [(0,(251,211,90),(183,124,36)),(3,fill,bottom)]:
        layer=grad((n,n),top,bot);layer.putalpha(rr_mask((n,n),pad*s,n/2-pad*s));out.alpha_composite(layer)
    icon=Image.open(ART/('UI/通用/mark_check.png' if state=='claimed' else 'UI/通用/mark_lock.png')).convert('RGBA');icon=ImageOps.contain(icon,(int(n*.7),int(n*.7)));out.alpha_composite(icon,((n-icon.width)//2,(n-icon.height)//2));return out.resize((size,size),Image.Resampling.LANCZOS)
def signin(big,state):
    size=(660,230) if big else (240,280);w,h=size;s=AA;W,H=w*s,h*s;im=Image.new('RGBA',(W,H));cx=W/2;cy=H/2
    if big:pts=[(63*s,30*s),(597*s,30*s),(641*s,75*s),(641*s,165*s),(597*s,209*s),(63*s,209*s),(19*s,165*s),(19*s,75*s)];center=(330*s,120*s)
    else:pts=[(120*s,26*s),(217*s,82*s),(217*s,191*s),(120*s,247*s),(23*s,191*s),(23*s,82*s)];center=(120*s,137*s)
    # Gold rim has a broad bright upper facet and an amber lower lip as S17.
    if state=='today':
        halo=Image.new('RGBA',(W,H));m=polygon_mask((W,H),pts,12*s).filter(ImageFilter.GaussianBlur(3*s));halo.paste((255,237,57,255),(0,0,W,H));halo.putalpha(m);im.alpha_composite(halo)
    colors=[((255,238,126),(226,139,17)),((255,253,175),(255,190,36)),((255,197,44),(222,135,20)),((255,226,101),(251,169,25))]
    if state=='locked':colors=[((237,213,144),(185,151,80)),((255,235,174),(215,184,104)),((224,191,111),(180,146,76)),((244,218,156),(217,186,124))]
    for f,(top,bot) in zip([1,.977,.942,.913],colors):polygrad(im,insetpts(pts,*center,f),top,bot,6*s)
    inset=.872 if not big else .925
    inner_top=(255,246,222) if state!='today' else (255,255,211);inner_bot=(255,232,201) if state!='today' else (255,239,145)
    polygrad(im,insetpts(pts,*center,inset),inner_top,inner_bot,5*s)
    # A separate-looking raised blank label is baked into the cell, text stays Label.
    tw,th=(184,58) if big else (146,52);tag=Image.new('RGBA',(tw*s,th*s));tpts=[(19*s,0),((tw-19)*s,0),(tw*s,th*s/2),((tw-19)*s,th*s),(19*s,th*s),(0,th*s/2)]
    polygrad(tag,tpts,(255,245,149),(227,151,25),3*s);polygrad(tag,insetpts(tpts,tw*s/2,th*s/2,.93),(255,237,108),(255,194,49),2*s)
    im.alpha_composite(tag,((W-tag.width)//2,10*s))
    im=im.resize(size,Image.Resampling.LANCZOS)
    if state in ['claimed','locked']:
        b=badge(state,60);im.alpha_composite(b,((w-60)//2,h-63))
    return im
for id,big,name in [('signin_cell',False,'六边形签到日格'),('signin_cell_big',True,'第七天加宽签到格')]:
    reg(id,name,{st:signin(big,st) for st in ['normal','today','claimed','locked']},SIGN,'S17 金色六边格轮廓与宽倒角复原，顶部空标签；today发光、claimed勾、locked锁，不烘焙日期/奖励',S17,extra={'contentBox':[30,70,180,130] if not big else [48,75,564,105],'labelBox':[47,10,146,52] if not big else [238,10,184,58],'stateSemantics':{'normal':'未来日无光、无状态徽记','today':'黄色外辉光；今日文字由独立蓝底+Label绘制','claimed':'金框+底部绿色勾','locked':'偏灰金框+底部灰锁'}})

tag_source=ART/'UI/通用/btn_blue_normal.png';tag=Image.open(tag_source).convert('RGBA').resize((128,54),Image.Resampling.LANCZOS)
reg('signin_today_tag','今日蓝色小标签底',{'default':tag},SIGN,'复用P0蓝色按钮母件，缩小为签到今日标签，不含字',tag_source,[32,16,32,16],extra={'reuseFrom':tag_source.relative_to(ROOT).as_posix()})

def taskrow(state):
    s=AA;w,h=256*s,160*s;out=Image.new('RGBA',(w,h))
    palette=[(3,43,(253,244,230),(216,185,159)),(5,41,(255,252,244),(239,217,193)),(10,36,(245,224,202),(225,196,171)),(12,34,(255,247,234),(251,231,210))]
    if state=='done':palette[-1]=(12,34,(255,250,239),(255,236,215))
    for pad,r,top,bot in palette:
        layer=grad((w,h),top,bot);layer.putalpha(rr_mask((w,h),pad*s,r*s));out.alpha_composite(layer)
    return out.resize((256,160),Image.Resampling.LANCZOS)
reg('task_row','任务行米白底板',{'normal':taskrow('normal'),'done':taskrow('done')},TASK,'S18 浅奶油任务行倒角复原，不含任务/图标/分割线/按钮',S18,[46,46,46,46])

# Exact P0 reuse ensures task/header icons share a visual family and ownership.
for id,name,src in [('task_icon_build','建造任务图标','icon_build.png'),('task_icon_endless','无尽任务图标','icon_endless.png')]:
    p=ART/'UI/图标'/src;im=Image.open(p).convert('RGBA');reg(id,name,{'default':im},TASK,'复用P0已交付同风格功能图标，独立登记来源SHA，不附加底框',p,scale=2,extra={'reuseFrom':p.relative_to(ROOT).as_posix()})

src=Image.open(S18).convert('RGBA');box=(78,667,212,797);puzzle=src.crop(box);pix=puzzle.load()
for y in range(puzzle.height):
    for x in range(puzzle.width):
        r,g,b,a=pix[x,y]
        # Yellow/orange puzzle is separable from the cream row and blue text.
        strength=min(1,max(0,(r-b-50)/40));strength*=min(1,max(0,(g-45)/40));pix[x,y]=(r,g,b,round(255*strength))
puzzle=puzzle.crop(puzzle.getchannel('A').getbbox());puzzle=ImageOps.contain(puzzle,(256,256),Image.Resampling.LANCZOS);icon=Image.new('RGBA',(264,264));icon.alpha_composite(puzzle,((264-puzzle.width)//2,(264-puzzle.height)//2))
reg('task_icon_puzzle','拼图任务金色拼片图标',{'default':icon},TASK,'S18 黄色拼片原图去米白底，2倍采样，无底框',S18,scale=2,extra={'cropRect':list(box),'extraction':'RGB yellow/cream chroma separation, soft alpha'})

for id,name,path in [('task_progress_bar_bg','任务小进度条底','bar_bg.png'),('task_progress_bar_fill','任务小进度条绿填充','bar_fill_green.png')]:
    p=ART/'UI/通用'/path;original=Image.open(p).convert('RGBA');w,h=original.size;im=Image.new('RGBA',(w*AA,h*AA))
    layers=([(3,17,(243,231,209),(151,163,194)),(5,15,(35,47,113),(23,34,80))] if path=='bar_bg.png' else [(3,17,(26,130,91),(8,103,86)),(5,15,(75,235,156),(6,148,111)),(7,13,(88,235,159),(11,157,117))])
    for pad,r,top,bot in layers:
        part=grad(im.size,top,bot);part.putalpha(rr_mask(im.size,pad*AA,r*AA));im.alpha_composite(part)
    im=im.resize((w,h),Image.Resampling.LANCZOS)
    reg(id,name,{'default':im},TASK,'沿用P0进度条母件尺寸/配色，修整轮廓消除外边细碎像素；底填充分离，无分数文字',p,[22,10,22,10],extra={'partOf':'task_progress_bar','derivedFrom':p.relative_to(ROOT).as_posix()})

(REC/'manifest.json').write_text(json.dumps(MAN,ensure_ascii=False,indent=2),encoding='utf-8')
def nine(im,sl,W,H):
    l,t,r,b=sl;w,h=im.size;xs=[0,l,w-r,w];ys=[0,t,h-b,h];xx=[0,l,W-r,W];yy=[0,t,H-b,H];out=Image.new('RGBA',(W,H))
    for j in range(3):
        for i in range(3):
            q=im.crop((xs[i],ys[j],xs[i+1],ys[j+1])).resize((xx[i+1]-xx[i],yy[j+1]-yy[j]),Image.Resampling.LANCZOS);out.alpha_composite(q,(xx[i],yy[j]))
    return out
files=[ART/p for e in MAN for p in e['states'].values()];W=960;CH=316;sheet=Image.new('RGB',(W,CH*len(files)))
for row,p in enumerate(files):
    im=Image.open(p).convert('RGBA');im.thumbnail((300,270),Image.Resampling.LANCZOS)
    for col in range(3):
        bg=Image.new('RGBA',(320,CH),'white' if col==0 else '#0E2A5C')
        if col==2:
            d=ImageDraw.Draw(bg)
            for y in range(0,CH,16):
                for x in range(0,320,16):d.rectangle((x,y,x+15,y+15),fill='#d0d3d9' if (x//16+y//16)%2 else '#f3f4f7')
        bg.alpha_composite(im,((320-im.width)//2,36));ImageDraw.Draw(bg).text((6,7),p.stem,fill='#667080' if col!=1 else 'white');sheet.paste(bg.convert('RGB'),(col*320,row*CH))
sheet.save(REC/'three_backgrounds.jpg',quality=94)
sheet.resize((640,sheet.height*640//W)).save(REC/'three_backgrounds_preview.jpg',quality=94)
stretch=[e for e in MAN if any(e['slice'])];sheet=Image.new('RGB',(1024,450*len(stretch)),'#0E2A5C');d=ImageDraw.Draw(sheet)
for row,e in enumerate(stretch):
    p=ART/next(iter(e['states'].values()));im=Image.open(p).convert('RGBA');sl=e['slice'];test=nine(im,sl,im.width*2,im.height*2);sheet.paste(test,(20,row*450+40),test);d.text((20,row*450+8),e['id']+' exact 2x width / 2x height nine-slice',fill='white')
sheet.save(REC/'nine_slice_2x.jpg',quality=94)
checks=[]
for e in MAN:
    for st,p in e['states'].items():
        p=ART/p;im=Image.open(p);b=im.getchannel('A').getbbox();padding=min(b[0],b[1],im.width-b[2],im.height-b[3]);assert im.mode=='RGBA' and list(im.size)==e['size'] and sha(p)==e['sha256'][st] and padding>=3
        checks.append({'file':p.relative_to(ART).as_posix(),'mode':im.mode,'sameSize':True,'hashMatch':True,'transparentPadding':padding})
(REC/'technical_checks.json').write_text(json.dumps({'assets':len(MAN),'files':len(files),'checks':checks},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'assets':len(MAN),'pngs':len(files)}))
