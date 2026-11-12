"""Create a geometry-only reference from an existing level; not a final art asset."""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('F:/qiguobing/git/Hexa Puzzle/Project')
OUT = ROOT / 'docs/v2/制作记录/BlockHexa首轮'
OUT.mkdir(parents=True, exist_ok=True)
(ROOT / 'docs/v2/效果图').mkdir(parents=True, exist_ok=True)
catalog = json.loads((ROOT / 'assets/bundles/puzzle/config/level-catalog.json').read_text(encoding='utf-8'))
level = next(x for x in catalog['levels'] if x['id'] == 'classic-060')
W,H = 1024,2208
im=Image.new('RGB',(W,H)); d=ImageDraw.Draw(im)
for y in range(H):
    t=y/H
    d.line((0,y,W,y), fill=(int(16+6*t),int(40+30*t),int(79+15*t)))
font_path='C:/Windows/Fonts/msyhbd.ttc'
def txt(x,y,s,size=35,fill='#ffffff'):
    f=ImageFont.truetype(font_path,size)
    d.text((x,y),s,font=f,fill=fill,anchor='mm')
def panel(box,fill='#285a87',radius=30):
    d.rounded_rectangle(box,radius=radius,fill=fill,outline='#62bfc9',width=3)
def xy(c,radius):
    return (1.5*radius*c['q'], math.sqrt(3)*radius*(c['r']+c['q']/2))
def draw_cells(cells,radius,cx,cy,fill):
    for c in cells:
        x,y=xy(c,radius);x+=cx;y+=cy
        pts=[(x+(radius-3)*math.cos(math.pi*k/3),y+(radius-3)*math.sin(math.pi*k/3)) for k in range(6)]
        d.polygon(pts,fill=fill,outline='#7ac1dc',width=3)
panel((45,55,150,155));txt(98,102,'⌂',50)
panel((175,60,420,150));txt(297,105,'♥ 4/5',38)
panel((450,60,825,150));txt(638,105,'金币 1,280',35)
panel((855,55,980,155));txt(918,104,'⚙',48)
txt(512,242,'第 71 关',48)
txt(512,315,'六角拼图',28,fill='#b2dce8')
R=75
points=[xy(c,R) for c in level['targetCells']]
cx=512-(min(x for x,y in points)+max(x for x,y in points))/2
cy=860-(min(y for x,y in points)+max(y for x,y in points))/2
draw_cells(level['targetCells'],R,cx,cy,'#10273f')
colors=['#ffb82e','#a373ff','#39d7ec','#9cdb38','#ff647a']
for i,p in enumerate(level['pieces'][:2]):draw_cells(p['targetCells'],R,cx,cy,colors[i])
txt(512,1395,'拖动拼块，填满蜂巢',32,fill='#c5eaf0')
panel((42,1480,982,1870),fill='#153c61',radius=46)
for i,p in enumerate(level['pieces'][2:]):
    rr=42
    pts=[xy(c,rr) for c in p['cells']]
    ox=198+i*314-(min(x for x,y in pts)+max(x for x,y in pts))/2
    oy=1670-(min(y for x,y in pts)+max(y for x,y in pts))/2
    draw_cells(p['cells'],rr,ox,oy,colors[i+2])
for x,label,symbol,color in [(220,'撤销','↶','#388dd3'),(512,'重玩','↻','#8c59d1'),(804,'提示','●','#19afba')]:
    panel((x-92,1960,x+92,2110),fill=color,radius=35)
    txt(x,2025,symbol,78)
    txt(x,2150,label,29)
txt(867,1980,'5',28)
im.save(OUT/'S04_现有关卡几何布局参考.png')
record={'levelId':level['id'],'mainlineNumber':level['mainlineNumber'],'targetCells':level['targetCells'],'placedPieceIds':[p['id'] for p in level['pieces'][:2]],'trayPieces':level['pieces'][2:],'purpose':'Geometry reference only. Final AI concept is visually reviewed, not an engine screenshot.'}
(OUT/'S04_关卡引用.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print('Reference generated:',level['id'],len(level['targetCells']),'cells;',len(level['pieces'])-2,'tray pieces')
