"""P2-13 offline proofs. Reads originals from Git; never writes runtime art."""
from pathlib import Path
from io import BytesIO
from functools import lru_cache
import json
import re
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageChops

ROOT = Path(__file__).resolve().parents[3]
REPO = ROOT.parents[1]
ART = ROOT/'素材'
OUT = ROOT/'制作记录/补充20261118/对照'
BACKGROUNDS = ['#FFFFFF','#F6EBD2','#0E2A5C','#7CC44E']
LANCZOS = Image.Resampling.LANCZOS
ORIGINAL_REF = '0aea3fc'

def font(size=18):
    return ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',size)

def text(im,xy,s,size=18,fill='#182D4D'):
    ImageDraw.Draw(im).text(xy,s,font=font(size),fill=fill)

def rows():
    doc=(ROOT/'18_美术需求_UI高清化.md').read_text(encoding='utf8')
    result=[]; band=None
    for line in doc.splitlines():
        if line.startswith('### 3.1'): band='A'
        elif line.startswith('### 3.2'): band='B'
        elif line.startswith('### 3.3'): band='C'
        if not line.startswith('| `UI/'):continue
        cells=line.split('|')[1:-1]
        names=re.findall(r'`([^`]+)`',cells[0]);first=names[0]
        if band=='C':
            if 'task_icon_puzzle' in first:
                result.append(dict(band='C',files=[first],size=[264,264],slice=None))
            continue
        paths=[first];base=Path(first)
        for n in names[1:]:
            if n.startswith('_'):
                stem=base.stem.rsplit('_',1)[0]+n
                paths.append(str(base.parent/(stem+'.png')))
            else:paths.append(str(base.parent/n))
        dims=re.search(r'(\d+)×(\d+)',cells[2]); size=list(map(int,dims.groups()))
        cuts=re.search(r'(\d+)/(\d+)/(\d+)/(\d+)',cells[3])
        result.append(dict(band=band,files=[p.replace('\\','/') for p in paths],size=size,slice=list(map(int,cuts.groups())) if cuts else None))
    assert sum(len(x['files']) for x in result)==77
    return result

@lru_cache(maxsize=None)
def old(p):
    raw=subprocess.check_output(['git','show',f'{ORIGINAL_REF}:docs/v2/素材/{p}'],cwd=REPO)
    return Image.open(BytesIO(raw)).convert('RGBA')

def current(p):return Image.open(ART/p).convert('RGBA')

def same_display(p):
    im=current(p);before=old(p)
    return im if im.size==before.size else im.resize(before.size,LANCZOS)

def sheet(tiles,title,width=2300):
    """Shelf pack proof tiles without resampling them."""
    positions=[];x=20;y=75;h=0
    for tile in tiles:
        if x+tile.width>width and x>20:x=20;y+=h+20;h=0
        positions.append((x,y,tile));x+=tile.width+20;h=max(h,tile.height)
    im=Image.new('RGB',(width,y+h+20),'#DDE5EF')
    text(im,(24,15),title,27)
    for x,y,t in positions:im.paste(t,(x,y))
    return im

def save(im,name):
    OUT.mkdir(parents=True,exist_ok=True)
    im.save(OUT/('P2-13_'+name+'.png'))

def edge_crop(im):
    a=im.getchannel('A');box=a.getbbox()
    if not box:return (0,0,32,32)
    x0,y0,x1,y1=box
    # Top-left corner or earliest top-edge point is representative of AA and bevel.
    y=min(im.height-1,y0+max(2,min(16,(y1-y0)//8)))
    scan=[x for x in range(im.width) if a.getpixel((x,y))>100]
    x=scan[0] if scan else x0
    return (max(0,x-6),max(0,y-8),min(im.width,x+26),min(im.height,y+24))

def comparisons(spec):
    for band in 'ABC':
        tiles=[]
        for row in spec:
            if row['band']!=band:continue
            for p in row['files']:
                a,b=old(p),same_display(p);w,h=a.size
                tile=Image.new('RGB',(max(600,2*w+72),4*(h+35)+154),'#ECF0F6')
                text(tile,(8,2),p,16)
                for j,bg in enumerate(BACKGROUNDS):
                    y=28+j*(h+35)
                    for k,src in enumerate([a,b]):
                        layer=Image.new('RGBA',a.size,bg);layer.alpha_composite(src)
                        tile.paste(layer.convert('RGB'),(10+k*(w+28),y))
                    text(tile,(10,y+h+2),bg+'   旧图',15)
                    text(tile,(w+38,y+h+2),'新图同1倍显示（C不缩小）',15)
                crop=edge_crop(a);y=4*(h+35)+28
                for k,src in enumerate([a,b]):
                    layer=Image.new('RGBA',src.size,'#0E2A5C');layer.alpha_composite(src)
                    part=layer.crop(crop);part=part.resize((part.width*3,part.height*3),Image.Resampling.NEAREST)
                    tile.paste(part.convert('RGB'),(12+k*160,y))
                text(tile,(350,y+12),'相同局部 3 倍最近邻\n左旧 / 右新',16)
                tiles.append(tile)
        save(sheet(tiles,f'{band}档 · 全文件新旧四底色对比与3倍局部'),'新旧对比_'+band)

def nine(im,target,cuts):
    # Cut positions are in 2x pixels. Render in physical 2x target, then reduce to display.
    l,t,r,b=cuts;w,h=target[0]*2,target[1]*2
    xs,ys=[0,l,im.width-r,im.width],[0,t,im.height-b,im.height]
    dx,dy=[0,l,w-r,w],[0,t,h-b,h]
    out=Image.new('RGBA',(w,h))
    for j in range(3):
        for i in range(3):
            sz=(dx[i+1]-dx[i],dy[j+1]-dy[j])
            if min(sz)>0:
                p=im.crop((xs[i],ys[j],xs[i+1],ys[j+1])).resize(sz,LANCZOS)
                out.alpha_composite(p,(dx[i],dy[j]))
    return out.resize(target,LANCZOS)

def targets(p):
    n=Path(p).stem
    if n.startswith(('btn_green','btn_blue','btn_grey')):return [(568,105),(595,166)]
    if n in ['panel_dialog','panel_feature']:return [(712,857)]
    if n.startswith(('task_row','endless_stage_row')):return [(760,124)]
    if 'bar_' in n or n.startswith('task_progress_bar'):return [(420,42)]
    return [dict(panel_inner=(280,220),ribbon_title_blue=(540,135),divider_gold=(360,24),hud_capsule_dark=(230,84),hud_capsule_light=(230,73),endless_score_panel=(710,220),puzzle_tray_frame=(780,400),home_bottom_bar=(853,115),map_tag_current=(220,54),build_dot_bar=(190,38),home_side_label=(180,49)).get(n,
        (260,146) if n.startswith('puzzle_btn') else (220,62) if n.startswith('puzzle_steps_plate') else (710,260) if n.startswith('map_card') else (210,70) if n.startswith('build_cost') else (48,150))]

def stretches(spec):
    pages=[];tiles=[];height=0
    for row in spec:
        if not row['slice']:continue
        for p in row['files']:
            ts=targets(p);tw=max(900,max(w for w,h in ts)+24);th=sum(h for w,h in ts)+55*len(ts)+35
            tile=Image.new('RGB',(tw,th),'#0E2A5C');text(tile,(10,5),p+' slice='+str(row['slice']),17,'white')
            y=35
            for target in ts:
                text(tile,(10,y),f'显示 {target[0]}×{target[1]} · 角与边按2倍slice保持',16,'#F6EBD2');y+=28
                tile.paste(nine(current(p),target,row['slice']),(12,y),nine(current(p),target,row['slice']));y+=target[1]+25
            tiles.append(tile);height+=th
            if height>6500:
                pages.append(tiles);tiles=[];height=0
    if tiles:pages.append(tiles)
    for i,tiles in enumerate(pages,1):save(sheet(tiles,'全部九宫格 · 实际显示尺寸 · 逐状态',2000),f'九宫格拉伸_{i:02}')

def overlays(spec):
    tiles=[]
    for row in spec:
        if len(row['files'])<2:continue
        ims=[same_display(p) for p in row['files']];w,h=ims[0].size
        tile=Image.new('RGB',(max(620,w*2+65),h+130),'#E4EAF3')
        text(tile,(10,5),row['files'][0].split('/')[-1].rsplit('_',1)[0],19)
        composite=Image.new('RGBA',(w,h),'#0E2A5C')
        for im in ims:
            c=im.copy();c.putalpha(c.getchannel('A').point(lambda x:int(x/len(ims))))
            composite.alpha_composite(c)
        tile.paste(composite.convert('RGB'),(12,38))
        edges=Image.new('RGB',(w,h),'#0E2A5C')
        colours=['#FF5555','#44DDFF','#FFE866','#CC77FF']
        from PIL import ImageFilter
        for i,im in enumerate(ims):
            mask=im.getchannel('A').point(lambda x:255 if x>=128 else 0)
            edge=ImageChops.subtract(mask,mask.filter(ImageFilter.MinFilter(3)))
            edges.paste(colours[i],(0,0),edge)
        tile.paste(edges,(w+38,38))
        text(tile,(12,h+45),'左：所有状态半透明叠放；右：50% alpha外轮廓彩色叠放',16)
        text(tile,(12,h+75),' / '.join(Path(p).stem for p in row['files']),13)
        tiles.append(tile)
    save(sheet(tiles,'全套多状态叠放 · 所有多状态组'),'多状态叠放')

if __name__=='__main__':
    spec=rows()
    for r in spec:
        for p in r['files']:
            assert list(current(p).size)==r['size'],(p,current(p).size,r['size'])
    comparisons(spec);stretches(spec);overlays(spec)
    print('P2-13 proofs generated; 77 asset comparisons and every sliced/state variant covered')
