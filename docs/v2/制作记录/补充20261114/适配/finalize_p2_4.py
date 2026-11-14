"""Finalize P2-4. Original pixels are always pasted verbatim, never transformed."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageEnhance,ImageOps,ImageChops
import cv2,numpy as np,json,hashlib,subprocess,shutil,sys
sys.dont_write_bytecode=True
from harmonic_border import harmonic_border
ROOT=Path('docs/v2');ART=ROOT/'素材';REC=ROOT/'制作记录/补充20261114/适配';RAW=Path('../tmp/p2-4/generated');NATIVE=REC/'生成原稿'
BASE='ae571a7';L=Image.Resampling.LANCZOS;NATIVE.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def git(*a):return subprocess.check_output(['git',*a])
def font(n):return ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',n)
def label(im,xy,s,n=24):ImageDraw.Draw(im).text(xy,s,font=font(n),fill='#203956')
def native(name):
    p=NATIVE/(name+'_raw.png')
    if not p.exists():shutil.copyfile(RAW/p.name,p)
    return Image.open(p).convert('RGB'),p

extensions=[];registration=[];views={}
jobs=json.loads((REC/'generation_jobs.json').read_text(encoding='utf-8'))
for job in jobs[:4]:
    name=job['name'];op=ROOT/job['original'];original=Image.open(op).convert('RGB');ow,oh=original.size;ox,oy=job['offset']
    generated,npth=native(name)
    # Generation can return a nearby resolution. Normalize generated pixels only.
    gen=generated.resize((1120,2048),L).crop((0,4,1120,2044));a=np.array(gen)
    # Register continuation structures (stream/path/canopy) to the fixed original.
    # This warps ONLY generated border pixels, tapering to zero at the canvas edge.
    orb=cv2.ORB_create(nfeatures=5000,edgeThreshold=15,fastThreshold=8)
    k1,d1=orb.detectAndCompute(cv2.cvtColor(a,cv2.COLOR_RGB2GRAY),None)
    k2,d2=orb.detectAndCompute(cv2.cvtColor(np.array(original),cv2.COLOR_RGB2GRAY),None)
    good=[]
    if d1 is not None and d2 is not None:
        pairs=cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(d1,d2,k=2)
        good=[m for m,n in pairs if m.distance<.72*n.distance]
    matrix=None;inliers=0
    if len(good)>=16:
        source=np.float32([k1[m.queryIdx].pt for m in good]);target=np.float32([k2[m.trainIdx].pt for m in good])+[ox,oy]
        matrix,inside=cv2.estimateAffine2D(source,target,method=cv2.RANSAC,ransacReprojThreshold=4,maxIters=5000,confidence=.995)
        inliers=int(inside.sum()) if inside is not None else 0
        if matrix is None or inliers<12 or not (.6<matrix[0,0]<1.5 and .6<matrix[1,1]<1.5) or abs(matrix[0,1])>.1 or abs(matrix[1,0])>.1:matrix=None
    yy,xx=np.mgrid[:2040,:1120].astype(np.float32)
    left=np.maximum(ox-xx,0);right=np.maximum(xx-(ox+ow-1),0);top=np.maximum(oy-yy,0);bottom=np.maximum(yy-(oy+oh-1),0)
    rho=np.maximum.reduce([left/ox,right/(1120-ox-ow),top/oy,bottom/(2040-oy-oh)])
    if matrix is not None:
        inverse=cv2.invertAffineTransform(matrix)
        gx=inverse[0,0]*xx+inverse[0,1]*yy+inverse[0,2];gy=inverse[1,0]*xx+inverse[1,1]*yy+inverse[1,2]
        q=np.clip(rho,0,1);weight=1-q*q*(3-2*q)
        a=cv2.remap(a,(xx+(gx-xx)*weight).astype('float32'),(yy+(gy-yy)*weight).astype('float32'),cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE)
    # Residual structural alignment is bounded to six pixels and smoothed before
    # extending outwards; colors are then solved harmonically, not row-extruded.
    g0=cv2.cvtColor(np.array(original),cv2.COLOR_RGB2GRAY)
    g1=cv2.cvtColor(a[oy:oy+oh,ox:ox+ow],cv2.COLOR_RGB2GRAY)
    flow=cv2.calcOpticalFlowFarneback(g0,g1,None,.5,4,25,5,7,1.5,0)
    flow=cv2.GaussianBlur(flow,(0,0),4)
    limit=np.full((oh,ow,1),6,dtype='float32')
    flow=np.clip(flow,-limit,limit)
    bx=np.clip(xx-ox,0,ow-1).astype(int);by=np.clip(yy-oy,0,oh-1).astype(int)
    local=flow[by,bx];q=np.clip(rho,0,1);weight=1-q*q*(3-2*q)
    corrected=cv2.remap(a,(xx+local[:,:,0]*weight).astype('float32'),(yy+local[:,:,1]*weight).astype('float32'),cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE)
    if name!='M03':
        # No source clouds touch the upper border. Continue its actual blue-sky
        # gradient rather than leaving a new cloud abruptly cut by the locked box.
        source=np.array(original,dtype=float)
        cloud=(source[:,:,0]>170)&(source[:,:,1]>190)&(source[:,:,2]>210)
        rows=np.where(cloud.any(axis=1))[0];first_cloud=int(rows[0]) if len(rows) else 200
        sky_end=oy+max(20,first_cloud-35)
        xi=np.clip(xx-ox,0,ow-1).astype(int);yi=np.clip(yy-oy,0,oh-1).astype(int)
        sky=source[yi,xi].copy()
        top_smooth=cv2.GaussianBlur(source[0:1],(0,0),8)[0]
        slope=(cv2.GaussianBlur(source[24:25],(0,0),8)[0]-top_smooth)/24
        north=yy<oy
        dy=(yy[north]-oy)[:,None]
        detail=(source[0]-top_smooth)[xi[north]]*np.exp(dy/4)
        sky[north]=np.clip(top_smooth[xi[north]]+dy*slope[xi[north]]+detail,0,255)
        blend=np.clip((sky_end+40-yy)/40,0,1)
        corrected=np.uint8(np.clip(corrected*(1-blend[:,:,None])+sky*blend[:,:,None],0,255))
    right_anchors=None
    if name in ('M01','M02'):
        # A square masked local edit keeps the cloud/mountain geometry aligned;
        # only its new 133px right margin is composited. Protected pixels are
        # restored verbatim below; generated protected pixels only provide the
        # color-difference boundary for the exterior harmonic solve.
        repair,rpath=native(name+'_sky')
        repair=np.array(repair.resize((512,512),L))
        blend=np.ones(512,dtype='float32')
        blend[:40]=np.linspace(0,1,40)
        blend[-72:]=np.linspace(1,0,72)
        w=blend[:,None,None]
        corrected[200:712,608:1120]=np.uint8(np.clip(corrected[200:712,608:1120]*(1-w)+repair*w,0,255))
        right_anchors=dict(method='square masked local cloud/mountain continuation; only new right133px used',
            sourceFile=rpath.relative_to(ROOT).as_posix(),sourceSha256=sha(rpath),canvasBox=[608,200,1120,712],protectedPatchWidth=379)
    corrected=harmonic_border(corrected,np.array(original),(ox,oy))
    final=Image.fromarray(corrected);final.paste(original,(ox,oy))
    path=op.with_name(op.stem+'_扩展.png');final.save(path)
    diff=ImageChops.difference(final.crop((ox,oy,ox+ow,oy+oh)),original);assert diff.getbbox() is None
    diff.save(REC/(name+'_中心差异_全黑.png'))
    marked=final.copy();dr=ImageDraw.Draw(marked);dr.rectangle((ox,oy,ox+ow-1,oy+oh-1),outline='#ff36a5',width=4)
    marked.thumbnail((560,1020),L);marked.save(REC/(name+'_扩展及原图边界.jpg'),quality=95)
    # At each seam retain native pixels, enlarged 2x for inspection.
    boxes=[(ox-24,oy+150,ox+24,oy+min(oh-100,650)),(ox+ow-24,oy+150,ox+ow+24,oy+min(oh-100,650)),
           (ox+100,oy-24,ox+min(ow-80,650),oy+24),(ox+100,oy+oh-24,ox+min(ow-80,650),oy+oh+24)]
    seam=Image.new('RGB',(1350,1150),'#edf2f9');label(seam,(12,10),name+' 接缝放大：左 / 右 / 上 / 下（未画辅助线）',24)
    for i,box in enumerate(boxes):
        tile=final.crop(box).resize(((box[2]-box[0])*2,(box[3]-box[1])*2),Image.Resampling.NEAREST)
        seam.paste(tile,(20 if i==0 else 150 if i==1 else 300,70 if i<2 else 150 if i==2 else 400))
    seam.save(REC/(name+'_接缝放大.png'))
    extensions.append(dict(file=path.relative_to(ROOT).as_posix(),original=op.relative_to(ROOT).as_posix(),size=[1120,2040],originalOffset=[ox,oy],sha256=sha(path),priority='P2',batch='P2-4'))
    registration.append(dict(id=name,sourceFile=npth.relative_to(ROOT).as_posix(),sourceSha256=sha(npth),rawSize=list(generated.size),matches=len(good),inliers=inliers,
        generatedBorderAlignment=matrix.tolist() if matrix is not None else None,rightContourAnchors=right_anchors,centerDifferenceMax=0,originalSha256=sha(op)))
    views[name]=final

ui=[]
for name in ['pad_light','pad_dark']:
    im,npth=native(name);im=im.resize((2304,1844),L)
    if name=='pad_light':
        im=im.filter(ImageFilter.GaussianBlur(1.6));ref=Image.open(next((ROOT/'地图').glob('M01_*背景.png'))).convert('RGB')
        lum=lambda q:float((np.array(q,dtype=float)@np.array([.2126,.7152,.0722])).mean())
        factor=.88*lum(ref)/lum(im);im=ImageEnhance.Brightness(im).enhance(factor)
    else:
        # Discreet procedural glints augment the generated dark background only.
        gl=Image.new('RGBA',im.size);d=ImageDraw.Draw(gl)
        for x,y,r in [(180,300,2),(420,940,2),(610,1510,2),(120,1620,1),(560,540,1),(2140,480,2),(1910,1100,2),(1730,1580,1),(2180,1700,2),(1790,260,1)]:
            d.ellipse((x-r,y-r,x+r,y+r),fill=(255,207,97,80))
        im=Image.alpha_composite(im.convert('RGBA'),gl.filter(ImageFilter.GaussianBlur(.8))).convert('RGB')
    ident='bg_pad_side_'+('light' if name=='pad_light' else 'dark');path=ART/'背景'/(ident+'.png');im.save(path);views[name]=im
    ui.append(dict(id=ident,name='平板侧边背景'+('浅色' if name=='pad_light' else '深色'),states={'default':path.relative_to(ART).as_posix()},size=[2304,1844],scale=1,slice=None,anchor=[.5,.5],source='P2-4 参考M01/bg_puzzle新绘；重点为左右700px低对比装饰区',priority='P2',batch='P2-4',sha256={'default':sha(path)}))
    registration.append(dict(id=name,sourceFile=npth.relative_to(ROOT).as_posix(),sourceSha256=sha(npth),rawSize=list(Image.open(npth).size)))

# Exact directional edge: left fully transparent,46px graduated shadow,2px gold.
edge=np.zeros((256,48,4),dtype=np.uint8)
for x in range(1,46):edge[:,x,:]=[9,19,37,round(125*(x/45)**2.6)]
edge[:,46:48]=[244,189,58,255];edge[edge[:,:,3]==0]=0
edge=Image.fromarray(edge);ep=ART/'UI/通用/pad_frame_edge.png';edge.save(ep)
ui.append(dict(id='pad_frame_edge',name='平板游戏区蜂蜜金边线柔影',states={'default':'UI/通用/pad_frame_edge.png'},size=[48,256],scale=1,slice=[0,32,0,32],anchor=[1,.5],source='P2-4 精确像素竖边：右2px金线，左46px暗影渐隐；全高同剖面，仅纵向拉伸',priority='P2',batch='P2-4',sha256={'default':sha(ep)}))
mp=ROOT/'美术交付清单.json';manifest=json.loads(mp.read_text(encoding='utf-8'))
manifest['uiAssets']=[e for e in manifest['uiAssets'] if e.get('batch')!='P2-4']+ui;manifest['p2Extensions']=extensions;dump(mp,manifest)

# Mobile crops in exact design-pixel extents.
mobile=Image.new('RGB',(1350,1420),'#edf2f9');label(mobile,(15,12),'M01 手机适配：16:9（1037×1844） / 长屏（853×1990）',28)
for i,(w,h) in enumerate([(1037,1844),(853,1990)]):
    x=(1120-w)//2;y=(2040-h)//2;crop=views['M01'].crop((x,y,x+w,y+h));crop.save(REC/('M01_'+str(w)+'x'+str(h)+'_原像素裁切.png'))
    crop.thumbnail((640,1320),L);mobile.paste(crop,(15+i*670,65))
mobile.save(REC/'手机裁切对照.jpg',quality=95)
def stretch_edge(height):
    out=Image.new('RGBA',(48,height));out.paste(edge.crop((0,0,48,32)),(0,0));out.paste(edge.crop((0,32,48,224)).resize((48,height-64),Image.Resampling.NEAREST),(0,32));out.paste(edge.crop((0,224,48,256)),(0,height-32));return out
for name,sceneid in [('pad_light','S02'),('pad_dark','S04')]:
    bg=ImageOps.fit(views[name],(1536,2048),method=L);scene=Image.open(next((ROOT/'效果图').glob(sceneid+'_*.png'))).convert('RGB');scene=scene.resize((round(scene.width*2048/scene.height),2048),L)
    x=(1536-scene.width)//2;bg=bg.convert('RGBA');bg.alpha_composite(stretch_edge(2048),(x-48,0));bg.alpha_composite(ImageOps.mirror(stretch_edge(2048)),(x+scene.width,0));bg.paste(scene,(x,0))
    bg.convert('RGB').save(REC/('平板1536x2048_'+sceneid+'.png'))
wide=Image.new('RGB',(1600,670),'#edf2f9');label(wide,(15,10),'平板侧边完整画布：中心约900px被覆盖，左右装饰区为重点',26)
for i,name in enumerate(['pad_light','pad_dark']):
    preview=views[name].resize((768,615),L);ImageDraw.Draw(preview).rectangle((234,0,534,614),outline='#ef5da9',width=2);wide.paste(preview,(15+i*790,50))
wide.save(REC/'平板侧边全图.jpg',quality=95)

# Verify pixel identity, exact assets and protection of all previous deliveries.
baseline=json.loads(git('show',BASE+':'+mp.as_posix()).decode('utf-8'))
assert [e for e in manifest['uiAssets'] if e.get('batch')!='P2-4']==baseline['uiAssets']
for key in baseline:
    if key!='uiAssets':assert manifest[key]==baseline[key],key
paths=[ROOT/e['file'] for e in extensions]+[ART/next(iter(e['states'].values())) for e in ui]
assert len(paths)==7
for e in extensions:
    orig=Image.open(ROOT/e['original']).convert('RGB');im=Image.open(ROOT/e['file']);ox,oy=e['originalOffset'];assert im.mode=='RGB' and im.size==(1120,2040)
    assert np.array_equal(np.array(orig),np.array(im.crop((ox,oy,ox+orig.width,oy+orig.height)))) and sha(ROOT/e['file'])==e['sha256']
for e in ui:
    p=ART/e['states']['default'];assert list(Image.open(p).size)==e['size'] and sha(p)==e['sha256']['default']
aa=np.array(stretch_edge(2048));assert np.all(aa==aa[0:1]) and np.array_equal(np.array(ImageOps.mirror(stretch_edge(2048))),aa[:,::-1])
assert not aa[:,0].any() and np.all(aa[:,-2:,3]==255)
allowed={mp.as_posix(),*[p.as_posix() for p in paths]};changed=git('-c','core.quotepath=false','diff','--name-only',BASE).decode('utf-8').splitlines()
assert all(p in allowed or p.startswith(REC.as_posix()+'/') for p in changed),changed
assert not git('diff',BASE,'--diff-filter=MD','--','assets','tools','docs/v2/效果图','docs/v2/地图','docs/v2/素材'), 'A previously delivered asset changed'
dump(REC/'verification.json',dict(batch='P2-4',baseline=BASE,date='2026-11-14',result='PASS',newRuntimePngs=7,extensions=extensions,uiAssets=ui,
    originalCenterMaxDifference=[0,0,0,0],allPreviousUiEntriesUnchanged=True,allPreviouslyTrackedAssetsUnchanged=True,runtimeToolsUnchanged=True,
    frame2048StretchConstant=True,frameMirroredSymmetry=True,frameGoldLinePixels=2,registration=registration,
    notes=['只有生成的外圈像素可配准与边界色校正；四张中心原图不重采样、不调色。','最终适配模拟为离线美术检查，不宣称真机多屏测试。']))
print('PASS:7 new assets;4 exact original crops;3 uiAssets;edge2048px stretch/flip;previous deliveries unchanged.')
