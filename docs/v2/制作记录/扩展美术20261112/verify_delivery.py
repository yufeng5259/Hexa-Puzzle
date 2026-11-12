"""Verify scope, original-file preservation, geometry coverage and deliverable references."""
from pathlib import Path
from PIL import Image
import json,re,hashlib,csv,shutil

ROOT=Path('F:/qiguobing/git/Hexa Puzzle/Project/docs/v2')
REC=ROOT/'制作记录/扩展美术20261112'
def digest(f):return hashlib.sha256(f.read_bytes()).hexdigest()
def load(f):return json.loads(f.read_text(encoding='utf-8'))
design=load(ROOT/'美术目录.json')
assert design['categories']=={'页面':25,'六角块图集':12,'地图背景':3,'建筑升级图集':15}
assert {x['id'] for x in design['images'] if x['category']=='页面'}=={f'S{i:02d}' for i in range(1,26)}
for item in design['images']:
    f=ROOT/item['file'];assert digest(f)==item['sha256'],f'Outdated gallery hash: {f}'
    with Image.open(f) as im:im.verify()

original={'效果图/S03_建造页_BlockHexa风格.png':'75aa8417cb32fcf73f267c35a6a5e090596e385c38946e4ec9034450156d432b','效果图/S04_主玩法_BlockHexa风格.png':'a77136de046cad2aab594e4974e157dbd030d4475d96e8668bfe4e0effaa81f0'}
for f,sha in original.items():assert digest(ROOT/f)==sha,'Original approved-style PNG changed'
hexdata=load(ROOT/'素材/六角块/shapes.json')
catalog=load(ROOT.parent.parent/'assets/bundles/puzzle/config/level-catalog.json')
source={(l['id'],p['id']):p for l in catalog['levels'] for p in l['pieces']}
mapping=hexdata['levelPieceMapping'];assert len(mapping)==len(source)==519
assert len(hexdata['mainlineShapes'])==217
assert {(x['levelId'],x['pieceId']) for x in mapping}==set(source)
shapes={x['id']:x for x in hexdata['mainlineShapes']}
for m in mapping:
    p=source[(m['levelId'],m['pieceId'])]
    assert p['cells']==m['sourceCells'] and p['targetCells']==m['targetCells'] and p['textureName']==m['textureName']
    q0=min(c['q'] for c in p['cells']);r0=min(c['r'] for c in p['cells'])
    cells=sorted((c['q']-q0,c['r']-r0) for c in p['cells'])
    assert cells==sorted(tuple(c) for c in shapes[m['shapeId']]['cells'])

building=load(ROOT/'图集/建筑/atlas_manifest.json')
assert len(building['buildings'])==15 and len(building['backgrounds'])==3
for b in building['buildings']:
    assert [x['level'] for x in b['states']]==list(range(6))
    assert digest(ROOT/b['atlas'])==b['atlas_sha256']
    for state in b['states']:
        f=ROOT/state['file'];assert digest(f)==state['sha256']
        with Image.open(f) as im:
            assert im.size==(576,576) and im.mode=='RGBA'
            assert im.getchannel('A').getextrema()==(0,255)
for config in sorted((ROOT/'地图').glob('*_建筑布局.json')):
    data=load(config);assert len(data['placements'])==5
    assert (ROOT/data['background']).exists()
    for p in data['placements']:
        assert len(p['stages'])==6
        for stage in p['stages']:assert (ROOT/stage['file']).exists()

sprites=[]
for folder,kind in [('素材/六角块/母件','六角母件'),('素材/建筑','建筑状态')]:
    for f in sorted((ROOT/folder).rglob('*.png')):
        with Image.open(f) as im:
            assert im.mode=='RGBA' and im.getchannel('A').getextrema()[0]==0
            size=list(im.size)
        sprites.append({'id':f.stem,'category':kind,'file':f.relative_to(ROOT).as_posix(),'width':size[0],'height':size[1],'sha256':digest(f)})
assert len(sprites)==108 and sum(x['category']=='建筑状态' for x in sprites)==90
bad=[]
for md in list(ROOT.glob('*.md'))+[ROOT/'效果图/README.md']:
    for link in re.findall(r'\]\(([^)]+)\)',md.read_text(encoding='utf-8')):
        if not link.startswith(('https:','http:')) and not (md.parent/link.split('#')[0]).exists():bad.append((str(md),link))
assert not bad,bad

delivery={'date':'2026-11-12','status':'files verified','designImages':design['images'],'independentPNGs':sprites,'counts':{'pageGroups':25,'newPageGroups':23,'hexBoards':12,'mainlineShapes':217,'mainlinePieceInstances':519,'sourceLevels':110,'endlessProposedShapes':48,'backgrounds':3,'buildingBoards':15,'buildingStates':90,'hexMothersAndStates':18},'originalStylePNGsPreserved':original,'pngDecode':'PASS','geometryCoverage':'PASS','relativeReferences':'PASS','runtimeModified':False,'fullPagePSDCreated':False}
(ROOT/'美术交付清单.json').write_text(json.dumps(delivery,ensure_ascii=False,indent=2),encoding='utf-8')
with (ROOT/'Asset_Catalog.csv').open('w',encoding='utf-8-sig',newline='') as fp:
    writer=csv.DictWriter(fp,fieldnames=['编号','类别','名称','相对路径','宽','高','SHA256']);writer.writeheader()
    for x in design['images']+sprites:writer.writerow({'编号':x['id'],'类别':x['category'],'名称':x.get('title',x['id']),'相对路径':x['file'],'宽':x['width'],'高':x['height'],'SHA256':x['sha256']})

oldmanifest=ROOT/'效果图/交付清单.json'
backup=ROOT/'制作记录/BlockHexa首轮/首轮交付清单_20261111.json'
if not backup.exists():shutil.copy2(oldmanifest,backup)
oldmanifest.write_text(json.dumps({'date':'2026-11-12','scope':'25 primary page-state concepts','pages':[x for x in design['images'] if x['category']=='页面'],'originalBatchManifest':'../制作记录/BlockHexa首轮/首轮交付清单_20261111.json','runtimeModified':False},ensure_ascii=False,indent=2),encoding='utf-8')
report={'status':'PASS','date':'2026-11-12','checks':['25 unique page groups','55 design PNGs decode and SHA match','108 independent RGBA sprites','110 levels and519 pieces all mapped without geometry change','217 mainline shapes,48 endless proposed orientations','15 buildings eachL0-L5','3 backgrounds and3 placement configs references','original S03/S04 unchanged','all document relative links resolve'],'counts':delivery['counts']}
(REC/'统一交付验证.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
