"""Validate delivered art against the P2-1 start commit, before or after commit."""
from pathlib import Path
from PIL import Image
import numpy as np
import subprocess, json, hashlib

ROOT=Path('docs/v2'); ART=ROOT/'素材'; REC=ROOT/'制作记录/补充20261113'
BASE='3a6d7da'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args):return subprocess.check_output(['git',*args])
manifest=json.loads((ROOT/'美术交付清单.json').read_text(encoding='utf-8'))
before=json.loads(git('show',BASE+':docs/v2/美术交付清单.json').decode('utf-8'))
old_ui=[e for e in manifest['uiAssets'] if e.get('batch')!='P2-1']
assert old_ui==before['uiAssets'], 'P0/P1 manifest entries changed'
for key in before:
    if key not in ('uiAssets','uiDeliveries'):assert manifest[key]==before[key], key
for key,value in before['uiDeliveries'].items():assert manifest['uiDeliveries'][key]==value
p2=[e for e in manifest['uiAssets'] if e.get('batch')=='P2-1']
assert len(p2)==6
expected={'guide_hand_normal.png':(140,200),'guide_hand_pressed.png':(140,200),'guide_bubble.png':(160,96),
          'guide_bubble_tail.png':(40,28),'guide_ring.png':(200,200),'toast_bg.png':(120,72),
          'endless_help_axes.png':(560,380),'line_highlight_strong.png':(121,105)}
files=[]
for entry in p2:
    assert entry['priority']=='P2' and entry['scale']==1
    assert entry['id']!='line_highlight_strong'
    for state, rel in entry['states'].items():
        path=ART/rel; assert path.exists() and sha(path)==entry['sha256'][state]; files.append(path)
        assert list(Image.open(path).size)==entry['size']
    if entry['slice']:
        l,t,r,b=entry['slice'];w,h=entry['size'];assert l+r<w and t+b<h
for entry in manifest['p2Additions']:
    path=ART/entry['file']; assert sha(path)==entry['sha256']; files.append(path)
assert {p.name for p in files}==set(expected) and len(files)==8
image_records=[]
for path in files:
    im=Image.open(path); im.load(); assert im.mode=='RGBA' and im.size==expected[path.name]
    a=np.array(im); assert np.any(a[:,:,3]==0) and np.any(a[:,:,3]>0)
    assert not np.any(a[a[:,:,3]==0,:3]), 'Dirty RGB under transparent pixels'
    if path.name not in ('line_highlight_strong.png','guide_bubble_tail.png'):
        assert not np.any(a[:3,:,3]) and not np.any(a[-3:,:,3]) and not np.any(a[:,:3,3]) and not np.any(a[:,-3:,3])
    image_records.append(dict(file=path.relative_to(ROOT).as_posix(),size=list(im.size),mode=im.mode,sha256=sha(path)))
mother=ART/'六角块/母件'
well=np.array(Image.open(mother/'empty_well.png'))
strong=np.array(Image.open(mother/'line_highlight_strong.png'))
assert np.array_equal(well[:,:,3]>0,strong[:,:,3]>0), 'Outer silhouette mismatch'
edge=(well[:,:,3]>0)&(well[:,:,3]<255)
assert np.array_equal(well[:,:,3][edge],strong[:,:,3][edge]), 'Antialias contour mismatch'
assert .30<=strong[52,60,3]/255<=.40
ring=np.array(Image.open(ART/'UI/引导/guide_ring.png'));assert not ring[64:136,64:136,3].any()
toast=np.array(Image.open(ART/'UI/通用/toast_bg.png'));assert tuple(toast[34,60,:3])==(14,42,92)
assert 215<=toast[34,60,3]<=220
hand_entry=next(e for e in p2 if e['id']=='guide_hand');assert hand_entry['anchorOrigin']=='top-left'
tip=hand_entry['contactPixel']; assert hand_entry['anchor']==[tip[0]/140,tip[1]/200]
normal=np.array(Image.open(ART/hand_entry['states']['normal']));pressed=np.array(Image.open(ART/hand_entry['states']['pressed']))
assert np.array_equal(normal[tip[1],tip[0]],pressed[tip[1],tip[0]]) and normal[tip[1],tip[0],3]>=180
# Below the deformation blend the cuff is an exact 4px downward copy.
assert np.array_equal(normal[tip[1]+70:190],pressed[tip[1]+74:194])
geometry=json.loads((REC/'help_geometry.json').read_text(encoding='utf-8'))
cells={tuple(c['axial']) for c in geometry};assert len(cells)==19 and (0,0) in cells
for axis in [lambda q,r:r==0,lambda q,r:q==0,lambda q,r:q+r==0]:assert sum(axis(q,r) for q,r in cells)==5
# Existing tracked originals must remain byte-identical; only manifest is edited.
changed=git('-c','core.quotepath=false','diff','--name-only',BASE).decode('utf-8').splitlines()
allowed={'docs/v2/美术交付清单.json','docs/v2/05_美术补充任务.md'}
assert all(p in allowed or p.startswith('docs/v2/制作记录/补充20261113/') for p in changed), changed
assert not git('diff',BASE,'--','assets','tools'), 'Runtime/tool changes detected'
# Verify every original tracked art bitmap by Git blob identity, including references.
originals=git('-c','core.quotepath=false','ls-tree','-r','--name-only',BASE,'--','docs/v2/素材','docs/v2/效果图').decode('utf-8')
protected=[p for p in originals.splitlines() if p.endswith('.png')]
for p in protected:
    assert Path(p).read_bytes()==git('show',BASE+':'+p),p
report=dict(batch='P2-1',date='2026-11-13',baselineCommit=BASE,result='PASS',runtimePngCount=8,uiPngCount=7,uiAssetGroups=6,
    p2Additions=1,protectedPngFilesUnchanged=len(protected),p0p1ManifestUnchanged=True,runtimeAndToolsUnchanged=True,
    exactHexAlphaSupport=True,exactHexAntialiasContour=True,highlightCenterOpacity=int(strong[52,60,3])/255,
    handContactFixed=True,handPalmShiftPixels=4,helpCells=19,helpAxes=[5,5,5],
    ringCenterFullyTransparent=True,toastCenterRGBA=toast[34,60].tolist(),files=image_records,
    visualReview='visual-verdict.json',scope='Offline artwork only; no runtime import or Creator preview requested or claimed.')
(REC/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='files'},ensure_ascii=True,indent=2))
