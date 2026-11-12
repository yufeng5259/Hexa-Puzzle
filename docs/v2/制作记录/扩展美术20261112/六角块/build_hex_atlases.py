"""Build transparent design atlases from a shared existing raster tile, preserving catalog geometry."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import math,json,hashlib,collections,colorsys,shutil,csv

P=Path('F:/qiguobing/git/Hexa Puzzle/Project')
ROOT=P/'docs/v2'; ART=ROOT/'素材/六角块'; BOARDS=ROOT/'图集/六角块'; RECORD=ROOT/'制作记录/扩展美术20261112/六角块'
for folder in (ART,BOARDS,RECORD,ART/'母件'):folder.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'效果图/S04_主玩法_BlockHexa风格.png'
catalog_path=P/'assets/bundles/puzzle/config/level-catalog.json'
source=Image.open(SOURCE).convert('RGBA')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def font(n):return ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc',n)
def rel(p):return Path(p).relative_to(ROOT).as_posix()
def savejson(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
def poly_mask(points,size):
    scale=4;m=Image.new('L',(size[0]*scale,size[1]*scale));ImageDraw.Draw(m).polygon([(x*scale,y*scale) for x,y in points],fill=255)
    return m.resize(size,Image.Resampling.LANCZOS)
poly=[(1,53),(31,1),(89,1),(119,53),(89,103),(31,103)]
mask=poly_mask(poly,(121,105))
gold=source.crop((180,502,301,607));gold.putalpha(mask)
# The master is the actual polished top gold tile; no procedural replacement shading.
palette=[('1_png','蜜金',.115),('3_png','珊瑚',.015),('6_png','青蓝',.500),('7_png','湖蓝',.570),('8_png','紫晶',.735),('9_png','青柠',.235),('10_png','桃粉',.925),('11_png','橙蜜',.065),('12_png','翠绿',.400),('13_png','靛蓝',.650),('16_png','莓红',.970),('17_png','浅紫',.790)]
materials=[]
for texture,name,hue in palette:
    pixels=[]
    for r,g,b,a in gold.getdata():
        h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
        # Retain source facet lighting/value; gently retain hue variance, use common material saturation.
        newh=(hue+(h-.115)*.32)%1
        rgb=colorsys.hsv_to_rgb(newh,min(.94,s*.95),v)
        pixels.append(tuple(round(vv*255) for vv in rgb)+(a,))
    im=Image.new('RGBA',gold.size);im.putdata(pixels)
    path=ART/'母件'/f'{texture}_{name}.png';im.save(path)
    materials.append({'id':texture,'name':name,'file':rel(path),'hue':hue,'sha256':sha(path),'size':list(im.size),'role':'opaque-face RGBA raster tile; palette is v2 visual proposal, not legacy color restoration'})
well=source.crop((362,499,490,610)).resize((121,105),Image.Resampling.LANCZOS);well.putalpha(mask)
well_path=ART/'母件/empty_well.png';well.save(well_path)
obstacle_source=P/'assets/resources/first-release/art/obstacle-riveted.png'
obstacle_path=ART/'母件/obstacle_riveted.png';shutil.copy2(obstacle_source,obstacle_path)
states=[{'id':'empty_well','name':'蜂巢空槽','file':rel(well_path),'sha256':sha(well_path),'sourceCrop':[362,499,490,610],'transform':'Resize crop to shared121x105 canvas; no missing right border'}, {'id':'obstacle_riveted','name':'不可放置障碍','file':rel(obstacle_path),'sha256':sha(obstacle_path),'source':str(obstacle_source),'source_sha256':sha(obstacle_source),'reuse':'exact byte copy of existing valid obstacle'}]
for state,color in [('preview_valid',(65,255,167)),('preview_invalid',(255,85,108)),('preview_hint',(255,221,82)),('line_highlight',(90,235,255))]:
    alpha=mask.point(lambda p:round(p*.42));edge=ImageChops.subtract(mask,mask.filter(ImageFilter.MinFilter(7)))
    im=Image.new('RGBA',mask.size,color+(0,));im.putalpha(ImageChops.lighter(alpha,edge));path=ART/'母件'/f'{state}.png';im.save(path)
    states.append({'id':state,'name':{'preview_valid':'合法落点','preview_invalid':'非法落点','preview_hint':'提示轮廓','line_highlight':'满线高亮'}[state],'file':rel(path),'sha256':sha(path),'role':'overlay, not a draggable puzzle piece'})

def norm(cells):
    mq=min(q for q,r in cells);mr=min(r for q,r in cells)
    return tuple(sorted((q-mq,r-mr) for q,r in cells))
catalog=json.loads(catalog_path.read_text(encoding='utf-8'))
shape_keys={};shapes=[];mapping=[]
for level in catalog['levels']:
    for piece in level['pieces']:
        key=norm([(c['q'],c['r']) for c in piece['cells']])
        if key not in shape_keys:
            sid=f'H{len(shapes)+1:03d}';shape_keys[key]=sid
            shapes.append({'id':sid,'cells':[list(c) for c in key],'cellCount':len(key),'textureNames':[],'occurrences':0,'category':'mainline'})
        sid=shape_keys[key];s=shapes[int(sid[1:])-1]
        if piece['textureName'] not in s['textureNames']:s['textureNames'].append(piece['textureName'])
        s['occurrences']+=1
        mapping.append({'levelId':level['id'],'mainlineNumber':level.get('mainlineNumber'),'pieceId':piece['id'],'textureName':piece['textureName'],'shapeId':sid,'sourceCells':piece['cells'],'targetCells':piece['targetCells']})
assert len(shapes)==217
def rotate(key):return [(-r,q+r) for q,r in key]
seeds=[[(0,0)],[(0,0),(1,0)],[(0,0),(1,0),(2,0)],[(0,0),(1,0),(0,1)],[(0,0),(1,0),(1,1)],[(0,0),(1,0),(2,0),(3,0)],[(0,0),(1,0),(2,0),(2,1)],[(0,0),(1,0),(0,1),(1,1)],[(0,0),(1,0),(0,1),(-1,1)],[(0,0),(1,0),(2,0),(3,0),(4,0)],[(0,0),(1,0),(2,0),(2,1),(2,2)],[(0,0),(1,0),(1,1),(2,1),(2,2)],[(0,0),(1,0),(0,1),(1,1),(0,2)]]
endless_keys={}
for seed in seeds:
    cur=seed
    for i in range(6):
        key=norm(cur);endless_keys.setdefault(key,{'seedSize':len(seed),'rotation':i*60});cur=rotate(cur)
endless=[]
for i,(key,origin) in enumerate(endless_keys.items()):
    endless.append({'id':f'E{i+1:03d}','cells':[list(c) for c in key],'cellCount':len(key),'textureNames':[palette[i%len(palette)][0]],'category':'endless-proposal','note':'Suggested fixed-orientation shape pool; not claimed to be a shipped activity config',**origin})

def render(cells,tile,maxsize):
    points=[(90*q,52*(2*r+q)) for q,r in cells]
    mnx=min(x for x,y in points);mny=min(y for x,y in points);mxx=max(x for x,y in points);mxy=max(y for x,y in points)
    im=Image.new('RGBA',(mxx-mnx+121,mxy-mny+105))
    for x,y in points:im.alpha_composite(tile,(x-mnx,y-mny))
    im.thumbnail(maxsize,Image.Resampling.LANCZOS)
    return im

tiles={m['id']:Image.open(ROOT/m['file']).convert('RGBA') for m in materials}
all_boards=[]
def label(d,xy,text,size=24,color='#102b50'):
    d.text(xy,text,font=font(size),fill=color,stroke_width=2,stroke_fill='#effaff',anchor='mm')
def shape_boards(items,prefix,title):
    for page in range(math.ceil(len(items)/25)):
        group=items[page*25:(page+1)*25];board=Image.new('RGBA',(2000,2280));d=ImageDraw.Draw(board)
        label(d,(1000,60),f'{title}  {page+1:02d}',43)
        label(d,(1000,120),'真实倒角像素母件 · 独立形状编号 · 保留原始朝向',24)
        label(d,(1000,165),'图板用于选型与核对；运行按单格母件和轴坐标组合',22)
        pagepath=BOARDS/f'{prefix}_{page+1:02d}.png'
        for j,item in enumerate(group):
            col=j%5;row=j//5;cx=col*400+200;top=220+row*400
            color=item['textureNames'][0];im=render(item['cells'],tiles[color],(332,282))
            pos=(round(cx-im.width/2),top+round((286-im.height)/2));board.alpha_composite(im,pos)
            label(d,(cx,top+316),f"{item['id']} · {item['cellCount']}格",28)
            label(d,(cx,top+355),color,23)
            item['atlas']={'file':rel(pagepath),'imageRect':[pos[0],pos[1],im.width,im.height],'slotRect':[col*400,top,400,400],'representativeTexture':color}
        board.save(pagepath)
        all_boards.append({'id':f'{prefix}_{page+1:02d}','title':f'{title} {page+1:02d}','file':rel(pagepath),'kind':'transparent-design-atlas','itemCount':len(group),'items':[i['id'] for i in group],'sha256':sha(pagepath)})
shape_boards(shapes,'A_HEX_MAIN','主线六角拼块')
shape_boards(endless,'A_HEX_ENDLESS','无尽建议形状与朝向')
# Common master board, all 12 texture identities plus six reusable visual states.
entries=[(m['id'],m['name'],Image.open(ROOT/m['file']).convert('RGBA'),m['file']) for m in materials]+[(m['id'],m['name'],Image.open(ROOT/m['file']).convert('RGBA'),m['file']) for m in states]
board=Image.new('RGBA',(2000,1900));d=ImageDraw.Draw(board);label(d,(1000,70),'六角母件 · 颜色与状态',45)
label(d,(1000,135),'12色真实倒角母件 / 空槽 / 原版金属障碍 / 四类叠加状态',24)
for i,(ident,name,im,file) in enumerate(entries):
    cx=(i%4)*500+250;top=220+(i//4)*320
    if ident.startswith('preview') or ident=='line_highlight':
        base=well.copy();base.alpha_composite(im);im=base
    im=im.resize((242,210),Image.Resampling.LANCZOS);board.alpha_composite(im,(cx-121,top))
    label(d,(cx,top+245),ident,26);label(d,(cx,top+283),name,24)
common=BOARDS/'A_HEX_COMMON_01.png';board.save(common)
all_boards.insert(0,{'id':'A_HEX_COMMON_01','title':'六角颜色、空槽、障碍与状态','file':rel(common),'kind':'transparent-design-atlas','itemCount':len(entries),'items':[e[0] for e in entries],'sha256':sha(common)})
document={'schema':'v2.hex-assets.v1','date':'2026-11-12','shapeNormalization':'translation only; no rotation or reflection merged','coordinateSystem':'axial flat-top: centerX=90*q, centerY=52*(2*r+q) at native mother121x105','source':{'file':rel(SOURCE),'sha256':sha(SOURCE),'catalog':str(catalog_path),'catalogSha256':sha(catalog_path),'tileSourceCrop':[180,502,301,607],'alphaPolygon':poly},'paletteStatus':'v2 proposed 12-color assignment preserving all textureName identities, not a claim to reproduce legacy color mappings','palette':materials,'states':states,'mainlineShapes':shapes,'endlessProposalShapes':endless,'levelPieceMapping':mapping}
savejson(ART/'shapes.json',document)
assert len(mapping)==sum(len(l['pieces']) for l in catalog['levels'])
assert {m['shapeId'] for m in mapping}=={s['id'] for s in shapes}
assert {m['textureName'] for m in mapping}=={m['id'] for m in materials}
# Pixel-source/geometry sheets contain the image inventory, not hundreds of duplicate per-level raster exports.
manifest={'schema':'v2.hex-atlas.manifest.v1','date':'2026-11-12','boards':all_boards,'mainlineLevelCount':len(catalog['levels']),'mainlinePieceInstances':len(mapping),'mainlineUniqueOrientedShapes':len(shapes),'textureCount':len(materials),'endlessProposedOrientedShapes':len(endless),'singleCellAndStateFiles':len(materials)+len(states),'shapeData':rel(ART/'shapes.json'),'renderer':rel(ART/'compose_hex.py'),'formalPSDDelivered':False,'runtimeIntegrated':False}
savejson(BOARDS/'atlas_manifest.json',manifest)
with (BOARDS/'Asset_Catalog.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.writer(f);w.writerow(['ID','类别','格数','源材质','图集','图集坐标'])
    for s in shapes+endless:w.writerow([s['id'],s['category'],s['cellCount'],';'.join(s['textureNames']),s['atlas']['file'],json.dumps(s['atlas']['imageRect'])])
# Every saved board decoded and composited onto three diagnostic backgrounds.
thumbs=[]
for b in all_boards:
    im=Image.open(ROOT/b['file']).convert('RGBA');im.verify() if False else None
    for bg,name in [('#ffffff','white'),('#102443','dark'),('#c6cbd1','gray')]:
        check=Image.new('RGBA',im.size,bg);check.alpha_composite(im);check.thumbnail((500,570));thumbs.append((b['id']+' '+name,check.convert('RGB')))
contact=Image.new('RGB',(1500,math.ceil(len(thumbs)/3)*620),'#dce2ea');dd=ImageDraw.Draw(contact)
for i,(name,im) in enumerate(thumbs):x=(i%3)*500;y=(i//3)*620;contact.paste(im,(x,y));dd.text((x+10,y+575),name,font=font(18),fill='#102b50')
contact.save(RECORD/'所有图板_白深灰底检查总览.jpg',quality=92)
edge=Image.new('RGB',(1800,650),'#c4ccd4')
for i,bg in enumerate(('#ffffff','#102443','#8b9199')):
    block=Image.new('RGBA',(600,650),bg)
    for j,key in enumerate(('1_png','6_png','8_png')):
        tile=tiles[key].resize((242,210),Image.Resampling.LANCZOS);block.alpha_composite(tile,((j%2)*280+35,(j//2)*280+35))
    edge.paste(block.convert('RGB'),(600*i,0))
edge.save(RECORD/'母件透明边_白深灰底.png')
savejson(RECORD/'技术核查.json',{'catalogLevelCount':len(catalog['levels']),'pieceMappings':len(mapping),'uniqueOrientedShapes':len(shapes),'paletteFiles':len(materials),'stateFiles':len(states),'endlessSuggestedOrientations':len(endless),'atlases':len(all_boards),'catalogCoverage':'PASS','shapeCoverage':'PASS','textureCoverage':'PASS','pngDecode':'PASS','visualReview':'pending actual full-board viewing','notes':['Labels are design atlas text, not runtime tile text.','Source imagery came from approved-quality v2 image; shading is original bitmap, not vector substitute.','No engine, Creator or Photoshop execution claimed.']})
print(json.dumps({k:v for k,v in manifest.items() if k!='boards'},ensure_ascii=False,indent=2))
