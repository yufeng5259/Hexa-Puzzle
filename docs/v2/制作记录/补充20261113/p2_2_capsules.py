"""P2-2: redraw true semicircular endcaps; never runs historical P0 generators.
Run with bundled Python 3 from Project root. Source pixels come from BASE in Git.
"""
from pathlib import Path
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import subprocess, json, hashlib

ROOT=Path('docs/v2'); ART=ROOT/'素材'; REC=ROOT/'制作记录/补充20261113'; CMP=REC/'对照'
BASE='ab4db64'; SIZE=(240,92); SLICE=[46,20,46,24]
SCOPE_BASE='23aaf70'  # Remote runtime integration retained during final rebase.
IDS=['btn_green','btn_grey','btn_blue','tag_claimed','tag_locked']
def git(*args):return subprocess.check_output(['git',*args])
def original(path):return git('show',BASE+':'+str(path).replace('\\','/'))
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def dump(path,obj):path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def old_image(rel):return Image.open(BytesIO(original(ART/rel))).convert('RGBA')
manifest_path=ROOT/'美术交付清单.json'
baseline=json.loads(original(manifest_path).decode('utf-8'))
manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
before={e['id']:e for e in baseline['uiAssets'] if e['id'] in IDS}
records=[]; originals={}; results={}

# Analytic capsule: exact circular ends centered at (46,46)/(194,46), radius43.
# 3px safety padding at all four edges. Every state shares this exact mask.
k=4
y,x=np.mgrid[:SIZE[1]*k,:SIZE[0]*k].astype(float); x=(x+.5)/k;y=(y+.5)/k
nearest=np.clip(x,46,194); nx=x-nearest; ny=y-46
rad=np.hypot(nx,ny); inset=43-rad
coverage=np.uint8(np.clip(inset*k+.5,0,1)*255)
alpha=Image.fromarray(coverage).resize(SIZE,Image.Resampling.LANCZOS)
aa=np.array(alpha); aa[:3]=0;aa[-3:]=0;aa[:,:3]=0;aa[:,-3:]=0
alpha=Image.fromarray(aa)

def capsule(source):
    a=np.array(source).astype(float); h,w=a.shape[:2]
    # Retain the existing color identity and vertical surface lighting.
    center=a[:,w//2,:3]
    top=center[round(h*.32)]; bottom=center[round(h*.67)]
    f=np.clip((y-10)/72,0,1)[:,:,None]
    color=top[None,None,:]*(1-f)+bottom[None,None,:]*f
    # Soft curved rim follows the distance to the circular capsule boundary.
    normal_y=ny/np.maximum(rad,1); normal_x=nx/np.maximum(rad,1)
    facing=np.clip(-normal_y*.90-normal_x*.18,0,1)
    rim=np.exp(-((inset-3)/2.3)**2)*facing*.72
    color=color*(1-rim[:,:,None])+np.array([235,255,253])[None,None,:]*rim[:,:,None]
    lower=np.exp(-((inset-3)/2.7)**2)*np.clip(normal_y,0,1)*.35
    outer=np.clip((2-inset)/2,0,1)*.28
    color*=((1-lower)*(1-outer))[:,:,None]
    # Feathered wider upper highlight keeps the soft S06 sculpted surface.
    sheen=np.exp(-((inset-8)/4.0)**2)*facing*.12
    color=color*(1-sheen[:,:,None])+255*sheen[:,:,None]
    im=Image.fromarray(np.uint8(np.clip(color,0,255))).resize(SIZE,Image.Resampling.LANCZOS).convert('RGBA')
    im.putalpha(alpha); arr=np.array(im);arr[arr[:,:,3]==0]=0
    return Image.fromarray(arr)

for entry in manifest['uiAssets']:
    ident=entry['id']
    if ident not in IDS:continue
    entry['slice']=SLICE.copy();entry['size']=list(SIZE)
    entry['source']='P2-2 按 S06 半圆头重建轮廓；保留原状态中心配色与上左柔光。端圆半径43px+3px透明边，圆心x=46/194。'
    entry['revision']='P2-2'
    if ident=='btn_grey':
        entry['states']['disabled']='UI/通用/btn_grey_disabled.png'
    for state,rel in entry['states'].items():
        if state in before[ident]['states']:
            src=old_image(before[ident]['states'][state]);originals[(ident,state)]=src
        else:
            src=old_image(before[ident]['states']['normal'])
            data=np.array(src);rgb=data[:,:,:3].astype(float)
            lum=rgb@np.array([.2126,.7152,.0722])
            rgb=lum[:,:,None]*.52+np.array([65,70,81])
            data[:,:,:3]=np.uint8(np.clip(rgb,0,255));src=Image.fromarray(data)
        im=capsule(src);path=ART/rel;im.save(path)
        entry['sha256'][state]=sha(path);results[(ident,state)]=im
        records.append(dict(id=ident,state=state,file=path.relative_to(ROOT).as_posix(),size=list(im.size),sha256=sha(path)))
manifest['uiDeliveries']['P2-2']=dict(date='2026-11-13',modifiedAssetGroups=5,modifiedPngFiles=10,newPngFiles=1,
    verification='制作记录/补充20261113/p2_2_verification.json',comparisons='制作记录/补充20261113/对照/',
    notes=['btn_green/btn_grey/btn_blue三态及两个tag统一240×92、slice[46,20,46,24]。','补齐btn_grey_disabled。'],runtimeModified=False)
dump(manifest_path,manifest)

def patch(im,size):
    l,t,r,b=SLICE;w,h=im.size;W,H=size;out=Image.new('RGBA',size)
    xs=[0,l,w-r,w];ys=[0,t,h-b,h];xx=[0,l,W-r,W];yy=[0,t,H-b,H]
    for j in range(3):
        for i in range(3):
            crop=im.crop((xs[i],ys[j],xs[i+1],ys[j+1]))
            out.paste(crop.resize((xx[i+1]-xx[i],yy[j+1]-yy[j]),Image.Resampling.LANCZOS),(xx[i],yy[j]))
    return out
def font(n):return ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',n)
def text(im,xy,s,n=20,fill='#173357'):ImageDraw.Draw(im).text(xy,s,font=font(n),fill=fill)
def checker(size):
    im=Image.new('RGBA',size,'#e4e9f1');d=ImageDraw.Draw(im)
    for yy in range(0,size[1],12):
        for xx in range(0,size[0],12):
            if (xx//12+yy//12)%2==0:d.rectangle((xx,yy,xx+11,yy+11),fill='#f9fbff')
    return im

# Original-sized before/after plus exact nine-slice 3x width, for every state.
sheet=Image.new('RGB',(1320,80+len(records)*125),'#edf2f9')
text(sheet,(16,10),'P2-2：原件 → 240×92半圆头 → 九宫格720×92（左右46px固定）',25)
for i,r in enumerate(records):
    key=(r['id'],r['state']);yy=65+i*125
    text(sheet,(12,yy),r['id']+' / '+r['state'],18)
    row=checker((1300,97));old=originals.get(key)
    if old:row.alpha_composite(old,(4,2))
    else:text(row,(20,35),'新增 disabled',18)
    row.alpha_composite(results[key],(270,2))
    row.alpha_composite(patch(results[key],(720,92)),(550,2))
    sheet.paste(row.convert('RGB'),(10,yy+24))
sheet.save(CMP/'P2-2_全部状态及三倍宽对照.png')

im=Image.new('RGB',(1100,600),'#edf2f9');text(im,(18,12),'P2-2 白底 / 深蓝底 / 棋盘格（240×92原尺寸）',25)
for j,bg in enumerate(['white','#0E2A5C','checker']):
    panel=checker((350,480)) if bg=='checker' else Image.new('RGBA',(350,480),bg)
    for i,key in enumerate([('btn_green','normal'),('btn_blue','normal'),('btn_grey','normal'),('tag_claimed','default'),('tag_locked','default')]):
        panel.alpha_composite(results[key],(50,i*96))
    im.paste(panel.convert('RGB'),(12+365*j,65))
im.save(CMP/'P2-2_透明及半圆轮廓检查.png')

refpath=next((ROOT/'效果图').glob('S06_*.png'));ref=Image.open(refpath).convert('RGBA')
scene=ref.copy()
# Place true-size/9-sliced sprites over the corresponding S06 buttons; comparison
# labels are preview-only and never included in runtime PNGs.
for key,pos,size,label in [(('btn_green','normal'),(146,1174),(560,92),'下一关'),(('btn_grey','normal'),(146,1280),(560,72),'回家建造')]:
    layer=patch(results[key],size);scene.alpha_composite(layer,pos)
    draw=ImageDraw.Draw(scene); draw.text((pos[0]+size[0]/2,pos[1]+size[1]/2),label,font=font(34),fill='white' if key[0]=='btn_green' else '#506482',anchor='mm')
preview=Image.new('RGB',(1024,1160),'#edf2f9');text(preview,(15,10),'S06 原图 / 修正胶囊叠加（不修改原图）',24)
for i,img in enumerate([ref,scene]):preview.paste(img.resize((512,1105),Image.Resampling.LANCZOS).convert('RGB'),(512*i,55))
preview.save(CMP/'P2-2_S06圆头对照.jpg',quality=95)

# Validate actual files, stable masks, exact cap-circle geometry and stretch corners.
assert len(records)==11
for r in records:
    im=Image.open(ROOT/r['file']);arr=np.array(im)
    assert im.mode=='RGBA' and im.size==SIZE and sha(ROOT/r['file'])==r['sha256']
    assert np.array_equal(arr[:,:,3],aa)
    assert not np.any(arr[arr[:,:,3]==0,:3])
    wide=patch(im,(720,92))
    assert np.array_equal(np.array(wide)[:,:46],arr[:,:46])
    assert np.array_equal(np.array(wide)[:,-46:],arr[:,-46:])
# At 50% alpha contour, each cap is a circle rather than a chamfer. Quantization
# uncertainty of one output pixel is expected from supersampling and thresholding.
for yy in range(4,88):
    dy=(yy+.5)-46;expected_left=46-np.sqrt(max(0,43**2-dy**2))
    actual=np.where(aa[yy]>=128)[0]
    assert len(actual) and abs((actual[0]+.5)-expected_left)<1.1
# Protect every unrelated tracked file against the P2-2 baseline.
changed=git('-c','core.quotepath=false','diff','--name-only',SCOPE_BASE).decode('utf-8').splitlines()
allowed={str(manifest_path).replace('\\','/')}|{str(ROOT/r['file']).replace('\\','/') for r in records}
assert all(p in allowed or p.startswith('docs/v2/制作记录/补充20261113/') for p in changed),changed
for old in baseline['uiAssets']:
    current=next(e for e in manifest['uiAssets'] if e['id']==old['id'])
    if old['id'] not in IDS:assert current==old
    else:assert current['slice']==SLICE and current['size']==list(SIZE)
assert not git('diff',SCOPE_BASE,'--','assets','tools','docs/v2/效果图')
dump(REC/'p2_2_verification.json',dict(batch='P2-2',baseline=BASE,scopeBaseline=SCOPE_BASE,result='PASS',pngFiles=11,modifiedPngFiles=10,newPngFiles=1,
    size=list(SIZE),slice=SLICE,allStateAlphaIdentical=True,semicircleContourTolerancePixels=1.1,
    nineSlice3xWidthCapsByteIdentical=True,unchangedOtherUiEntries=True,runtimeToolsAndReferencesUnchanged=True,files=records,
    notes=['按本轮统一尺寸要求，tag_claimed/tag_locked从140×60改为240×92。','btn_grey补齐disabled，其余文件名及状态路径保留。','无需生成接口；复用原状态像素配色，确定性重绘半圆轮廓。']))
print('PASS: 11 RGBA capsules, shared240x92 mask, slice46/20/46/24, exact fixed endcaps at3x width.')
