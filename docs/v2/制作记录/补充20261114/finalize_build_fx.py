"""P2-3 six-image artwork delivery. Run from Project root with bundled Python3.
Never imports or modifies runtime assets/tools. Source edit outputs are preserved.
"""
from pathlib import Path
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
import subprocess,json,hashlib,shutil

ROOT=Path('docs/v2');ART=ROOT/'素材';REC=ROOT/'制作记录/补充20261114';CMP=REC/'对照'
RAW=Path('../tmp/p2-3/generated');NATIVE=REC/'生成原稿'
BASE='6da1fed';NAMES=['hammer','saw','smoke','puff','ray','spark']
L=Image.Resampling.LANCZOS
for p in [REC,CMP,NATIVE]:p.mkdir(parents=True,exist_ok=True)
def git(*a):return subprocess.check_output(['git',*a])
def original(p):return git('show',BASE+':'+p.as_posix())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(p,obj):p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def alpha_center(im):
    a=np.array(im.getchannel('A')).astype(float);y,x=np.mgrid[:im.height,:im.width]
    return [float((x*a).sum()/a.sum()),float((y*a).sum()/a.sum())]
def clean(im):
    a=np.array(im.convert('RGBA'));a[:3]=0;a[-3:]=0;a[:,:3]=0;a[:,-3:]=0
    a[a[:,:,3]==0]=0;return Image.fromarray(a)
def opaque_box(im,threshold=8):return im.getchannel('A').point(lambda v:255 if v>=threshold else 0).getbbox()
old={};new={};records=[]
for name in NAMES:
    target=ART/'UI/特效/build'/('fx_build_'+name+'.png')
    src=RAW/(name+'_raw.png');saved=NATIVE/(name+'_raw.png')
    if not saved.exists():shutil.copyfile(src,saved)
    before=Image.open(BytesIO(original(target))).convert('RGBA');old[name]=before
    im=Image.open(saved)
    assert im.mode=='RGBA' and im.getchannel('A').getextrema()[0]<10, 'Missing native transparency'
    # Remove only extraction-level alpha noise; preserve the original soft glow.
    arr=np.array(im);arr[arr[:,:,3]<=3]=0;im=Image.fromarray(arr)
    sb=opaque_box(im);im=im.crop(sb)
    w,h=before.size;ob=before.getbbox();box=(max(3,ob[0]),max(3,ob[1]),min(w-3,ob[2]),min(h-3,ob[3]))
    W,H=box[2]-box[0],box[3]-box[1]
    correction=None
    if name=='hammer':
        # Match the original handle/head junction, not just the total bounding box.
        # Head columns occupy >60% of the original hammer's total silhouette height.
        def split(image):
            aa=np.array(image.getchannel('A'))>128
            heights=aa.sum(axis=0);return int(np.where(heights>=heights.max()*.60)[0][0])
        source_split=split(im);target_split=max(1,split(before)-box[0])
        left=im.crop((0,0,source_split,im.height)).resize((target_split,H),L)
        right=im.crop((source_split,0,im.width,im.height)).resize((W-target_split,H),L)
        fitted=Image.new('RGBA',(W,H));fitted.paste(left,(0,0));fitted.paste(right,(target_split,0))
        correction=dict(sourceHeadStart=source_split,targetHeadStart=box[0]+target_split,method='piecewise horizontal registration of existing head/handle junction; no flip or rotation')
    else:fitted=im.resize((W,H),L)
    out=Image.new('RGBA',(w,h));out.alpha_composite(fitted,(box[0],box[1]));out=clean(out)
    out.save(target);new[name]=out
    records.append(dict(id='fx_build_'+name,file=target.relative_to(ROOT).as_posix(),size=[w,h],anchor=[.5,.5],
        sourceFile=saved.relative_to(ROOT).as_posix(),sourceSha256=sha(saved),sourceCrop=list(sb),registrationBox=list(box),
        oldAlphaCenter=alpha_center(before),newAlphaCenter=alpha_center(out),headRegistration=correction,
        transform='original canvas and center pivot retained; source crop fitted into original occupied rectangle with3px safe border; no flip/rotation',sha256=sha(target)))

mp=ROOT/'美术交付清单.json';baseline=json.loads(original(mp).decode('utf-8'));manifest=json.loads(mp.read_text(encoding='utf-8'))
chinese=dict(hammer='卡通木柄铁锤',saw='卡通手锯',smoke='卡通圆尘云',puff='卡通喷出尘团',ray='蜂蜜金放射光',spark='蜂蜜金四角星光')
for e in manifest['uiAssets']:
    if e['id'] not in {'fx_build_'+n for n in NAMES}:continue
    name=e['id'].removeprefix('fx_build_');rec=next(r for r in records if r['id']==e['id'])
    e['name']='建造特效·'+chinese[name];e['batch']='P2-3';e.pop('reuseFrom',None)
    e['source']='P2-3 按bee_builder及S03重绘；旧图仅作朝向/占位定位参考，新绘像素见制作记录/补充20261114/生成原稿。'
    e['sha256']={'default':rec['sha256']}
dump(mp,manifest)

# Comparison labels are QA-only; runtime artwork remains text-free.
def font(size):return ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',size)
def text(im,pos,s,size=22,color='#193655'):ImageDraw.Draw(im).text(pos,s,font=font(size),fill=color)
map_path=next((ROOT/'地图').glob('M01_*背景.png'));mapim=Image.open(map_path).convert('RGBA')
bpath=next((ART/'建筑').glob('B02_*/*L1.png'));building=Image.open(bpath).convert('RGBA')
def map_patch(size):
    # Actual green grass patch from the existing M01 source; no recoloring.
    return mapim.crop((70,980,784,1600)).resize(size,L)
sheet=Image.new('RGB',(1400,1300),'#edf2f9')
text(sheet,(20,12),'P2-3 建造特效：M01 绿地上旧图 / 重绘（各2倍展示）',30)
for i,name in enumerate(NAMES):
    col=i%2;row=i//2;x=col*700;y=70+row*400
    text(sheet,(x+15,y),name+' · '+str(old[name].size),24)
    panel=map_patch((680,350))
    for j,im in enumerate([old[name],new[name]]):
        preview=im.resize((im.width*2,im.height*2),L)
        if preview.width>325 or preview.height>290:preview.thumbnail((325,290),L)
        panel.alpha_composite(preview,(j*340+(340-preview.width)//2,30+(290-preview.height)//2))
        text(panel,(j*340+10,5),'旧图' if j==0 else 'P2-3 重绘',20)
    sheet.paste(panel.convert('RGB'),(x+10,y+36))
sheet.save(CMP/'01_M01绿地新旧对照.jpg',quality=95)

reg=Image.new('RGB',(1400,650),'#edf2f9');text(reg,(20,12),'工具配准：旧图 / 新图 / 各50%叠放（中心十字为原画布锚点）',28)
for row,name in enumerate(['hammer','saw']):
    y=65+row*280;text(reg,(16,y),name,22)
    for j,im in enumerate([old[name],new[name],None]):
        size=old[name].size;bg=Image.new('RGBA',size,'#183453')
        if im is not None:bg.alpha_composite(im)
        else:
            for tile in [old[name],new[name]]:
                tile=tile.copy();tile.putalpha(tile.getchannel('A').point(lambda a:a//2));bg.alpha_composite(tile)
        d=ImageDraw.Draw(bg);cx,cy=size[0]//2,size[1]//2
        d.line((cx-8,cy,cx+8,cy),fill='#f64c80',width=1);d.line((cx,cy-8,cx,cy+8),fill='#f64c80',width=1)
        bg=bg.resize((size[0]*2,size[1]*2),Image.Resampling.NEAREST)
        reg.paste(bg.convert('RGB'),(30+j*450,y+40))
reg.save(CMP/'02_工具朝向占位叠放.png')

scene=mapim.resize((854,1842),L).copy()
# Map crop enlargement emphasizes the building rather than adding a second map.
scene=scene.crop((0,520,854,1374))
scene.alpha_composite(building,(139,130))
mid=scene.copy()
def put_center(im,tile,pos,scale=1,opacity=1):
    tile=tile.resize((round(tile.width*scale),round(tile.height*scale)),L)
    if opacity!=1:tile.putalpha(tile.getchannel('A').point(lambda a:round(a*opacity)))
    im.alpha_composite(tile,(round(pos[0]-tile.width/2),round(pos[1]-tile.height/2)))
put_center(mid,new['ray'],(430,390),3.2,.6)
mid.alpha_composite(building,(139,130))
for pos,name,s in [((270,475),'smoke',1.05),((490,550),'puff',1.1),((610,410),'smoke',.85),((355,290),'hammer',1.2),((540,350),'saw',1.1),((290,360),'spark',.5),((600,520),'spark',.55)]:put_center(mid,new[name],pos,s)
compose=Image.new('RGB',(1280,730),'#edf2f9');text(compose,(20,10),'B02 L1 建造动画中间帧合成示意（静态美术检查，非真机截图）',26)
for i,im in enumerate([scene,mid]):compose.paste(im.resize((640,640),L).convert('RGB'),(i*640,65))
compose.save(CMP/'03_B02_L1合成示意.jpg',quality=95)

qa=Image.new('RGB',(1350,1170),'#edf2f9');text(qa,(20,10),'白底 / 深蓝底 / 棋盘格 / 米色建筑底 · 原尺寸与边缘核对',26)
for j,kind in enumerate(['white','#0E2A5C','checker','building']):
    tile=Image.new('RGBA',(325,1080),'#e3e7ee' if kind in ('checker','building') else kind)
    if kind=='checker':
        d=ImageDraw.Draw(tile)
        for yy in range(0,1080,16):
            for xx in range(0,325,16):
                if (xx//16+yy//16)%2==0:d.rectangle((xx,yy,xx+15,yy+15),fill='white')
    if kind=='building':
        # Source B02 plaster/wall patch, not a synthetic beige swatch.
        backdrop=building.crop((180,235,395,455)).resize((325,340),L)
        tile=Image.new('RGBA',(325,1080),'#f6e2bd')
        for yy in range(0,1080,340):tile.alpha_composite(backdrop,(0,yy))
    for i,name in enumerate(NAMES):
        im=new[name]
        tile.alpha_composite(im,((325-im.width)//2,i*180+6))
    qa.paste(tile.convert('RGB'),(j*335+10,65))
qa.save(CMP/'04_透明及米色建筑可读性.png')

# Scoped acceptance: six paths and six manifest entries, no unrelated changes.
assert len(records)==6
ids={r['id'] for r in records};allowed={mp.as_posix()}|{(ROOT/r['file']).as_posix() for r in records}
changed=git('-c','core.quotepath=false','diff','--name-only',BASE).decode('utf-8').splitlines()
assert all(p in allowed or p.startswith(REC.as_posix()+'/') for p in changed),changed
assert not git('diff',BASE,'--','assets','tools','docs/v2/效果图')
for e in baseline['uiAssets']:
    cur=next(x for x in manifest['uiAssets'] if x['id']==e['id'])
    if e['id'] not in ids:assert cur==e
    else:
        for key in ['size','anchor','scale','slice','states','priority']:assert cur[key]==e[key]
        assert cur['batch']=='P2-3' and 'reuseFrom' not in cur
for key in baseline:
    if key!='uiAssets':assert manifest[key]==baseline[key]
for r in records:
    im=Image.open(ROOT/r['file']);assert im.mode=='RGBA' and list(im.size)==r['size']
    a=np.array(im);assert not a[:3,:,3].any() and not a[-3:,:,3].any() and not a[:,:3,3].any() and not a[:,-3:,3].any()
    assert not a[a[:,:,3]==0,:3].any();assert sha(ROOT/r['file'])==r['sha256']
    assert r['sha256']!=hashlib.sha256(original(ROOT/r['file'])).hexdigest()
ray_alpha=np.array(new['ray'].getchannel('A'));theta=np.linspace(0,2*np.pi,720,endpoint=False);ray_counts=[]
for radius in [35,43,50]:
    xx=np.round(78+radius*np.cos(theta)).astype(int);yy=np.round(71+radius*np.sin(theta)).astype(int)
    profile=ray_alpha[yy,xx].astype(float)
    smooth=np.convolve(np.tile(profile,3),np.ones(9)/9,mode='same')[720:1440]>128
    ray_counts.append(int(np.sum(smooth&~np.roll(smooth,1))))
assert all(8<=count<=12 for count in ray_counts),ray_counts
dump(REC/'verification.json',dict(batch='P2-3',baselineCommit=BASE,date='2026-11-14',result='PASS',runtimePngFiles=6,rayCountsAtRadii35_43_50=ray_counts,
    exactOriginalCanvasSizes=True,originalCenterAnchorsUnchanged=True,safeTransparentBorderPixels=3,allRGBA=True,
    noRuntimeOrToolsChanges=True,allOtherManifestEntriesUnchanged=True,allSixReuseFromRemoved=True,
    images=records,comparisons=[p.relative_to(ROOT).as_posix() for p in sorted(CMP.iterdir())],
    notes=['朝向及主体占位需结合工具叠放图视觉核查。','透明光效保留原生Alpha；仅清除Alpha<=3的背景级残留。','静态美术交付，不宣称运行接入、动画验收或真机验证。']))
print('PASS: six RGBA redraws, original sizes/anchors, 3px safe edges, six manifest entries only.')
