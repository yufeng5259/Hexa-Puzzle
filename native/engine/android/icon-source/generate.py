"""Rebuild launcher resources from source.png; requires Python 3, Pillow, NumPy."""
from pathlib import Path
import hashlib
import json
import math
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
RES = HERE.parent / 'res'
OUT = HERE.parents[3] / 'output/android-icon'
OUT.mkdir(parents=True, exist_ok=True)
LANCZOS = Image.Resampling.LANCZOS
SOURCE = Image.open(HERE / 'source.png').convert('RGBA')
assert SOURCE.size == (1024, 1024)

# Trace the supplied artwork's outer rim, retaining the original tile pixels,
# highlights and central negative space. Only the surrounding backdrop is removed.
OUTLINE = [(79,380),(143,262),(167,238),(249,234),(340,84),(360,65),
           (388,60),(496,60),(523,69),(542,90),(591,181),(744,177),
           (773,187),(794,212),(849,313),(852,341),(814,425),(842,425),
           (870,438),(889,469),(945,573),(951,601),(941,628),(888,720),
           (866,738),(838,748),(722,748),(697,762),(694,790),(635,899),
           (608,924),(579,931),(442,931),(414,918),(394,888),(345,802),
           (210,802),(183,793),(161,773),(109,677),(101,649),(112,619),
           (164,525),(141,511),(121,486),(81,409)]
CENTER = (512, 496)
# Includes antialiasing/feather margin, within the conservative 33dp safe radius.
SCALE = 316 / max(math.hypot(x-CENTER[0], y-CENTER[1]) for x,y in OUTLINE)

def mapped(points, shrink=1):
    cx = sum(x for x,y in points)/len(points)
    cy = sum(y for x,y in points)/len(points)
    return [((cx+(x-cx)*shrink-CENTER[0])*SCALE+540,
             (cy+(y-cy)*shrink-CENTER[1])*SCALE+540) for x,y in points]

mask = Image.new('L', SOURCE.size)
ImageDraw.Draw(mask).polygon(OUTLINE, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(2))
mark = SOURCE.copy()
mark.putalpha(mask)
foreground = Image.new('RGBA', (1080,1080))
side = round(1024*SCALE)
foreground.alpha_composite(mark.resize((side,side), LANCZOS),
    (round(540-CENTER[0]*SCALE), round(540-CENTER[1]*SCALE)))

# Extend the blue/cyan honeycomb backdrop so launcher parallax never exposes
# a transparent edge or a second copy of the six-tile mark.
y,x = np.mgrid[0:1080,0:1080]
glow = np.exp(-(((x-525)/430)**2 + ((y-510)/465)**2))
edge = np.array([0,44,223])
center = np.array([0,218,250])
background = Image.fromarray(np.uint8(edge+(center-edge)*glow[:,:,None])).convert('RGBA')
grid = Image.new('RGBA', background.size)
d = ImageDraw.Draw(grid)
for col in range(-1,8):
    for row in range(-1,8):
        cx,cy = col*174, row*201+(col%2)*100.5
        pts = [(cx+116*math.cos(i*math.pi/3),cy+116*math.sin(i*math.pi/3)) for i in range(6)]
        d.line(pts+[pts[0]], fill=(20,218,255,48), width=4)
background = Image.alpha_composite(background, grid.filter(ImageFilter.GaussianBlur(1.5)))
composite = Image.alpha_composite(background,foreground)

# A dedicated one-color silhouette keeps the six tiles distinct when tinted.
TILES = [[(362,83),(511,83),(580,204),(511,324),(365,324),(295,204)],
         [(167,257),(308,257),(380,383),(309,505),(167,505),(96,382)],
         [(596,199),(748,199),(827,325),(753,438),(599,438),(536,321)],
         [(679,452),(840,452),(921,592),(846,716),(685,716),(618,592)],
         [(456,635),(610,635),(675,770),(603,902),(450,902),(378,770)],
         [(201,526),(335,526),(416,653),(343,777),(195,777),(122,651)]]
mono = Image.new('L',(1080,1080))
paths = []
for tile in TILES:
    points = mapped(tile, 0.82)
    ImageDraw.Draw(mono).polygon(points, fill=255)
    paths.append('M '+' L '.join(f'{x/10:.3f},{y/10:.3f}' for x,y in points)+' Z')

def write(relative, value):
    dest = RES / relative
    dest.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(value, str):
        dest.write_text(value, encoding='utf-8')
    else:
        value.save(dest, optimize=True)

write('drawable-xxxhdpi/ic_launcher_foreground.png', foreground.resize((432,432),LANCZOS))
write('drawable-xxxhdpi/ic_launcher_background.png', background.convert('RGB').resize((432,432),LANCZOS))
write('drawable/ic_launcher_monochrome.xml',
      '<?xml version="1.0" encoding="utf-8"?>\n'
      '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
      '    android:width="108dp" android:height="108dp"\n'
      '    android:viewportWidth="108" android:viewportHeight="108">\n'
      f'    <path android:fillColor="#FFFFFFFF" android:pathData="{" ".join(paths)}" />\n'
      '</vector>\n')
for api in (26,):
    xml = ('<?xml version="1.0" encoding="utf-8"?>\n'
           '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
           '    <background android:drawable="@drawable/ic_launcher_background" />\n'
           '    <foreground android:drawable="@drawable/ic_launcher_foreground" />\n')
    xml += '    <monochrome android:drawable="@drawable/ic_launcher_monochrome" />\n'
    xml += '</adaptive-icon>\n'
    for name in ('ic_launcher','ic_launcher_round'):
        write(f'mipmap-anydpi-v{api}/{name}.xml', xml)

# Legacy icons retain the supplied composition inside a rounded silhouette.
# Only legacy bitmaps get baked corners; adaptive layers remain unmasked.
# The round fallback uses
# the safely inset adaptive composition and is only selected by older launchers.
viewport = composite.crop((180,180,900,900))
circle = Image.new('L',viewport.size)
ImageDraw.Draw(circle).ellipse((0,0,719,719),fill=255)
round_icon = viewport.copy()
round_icon.putalpha(circle)
legacy = Image.new('RGBA',SOURCE.size)
legacy_art = SOURCE.resize((938,938),LANCZOS)
legacy_mask = Image.new('L',(938,938))
ImageDraw.Draw(legacy_mask).rounded_rectangle((0,0,937,937),radius=188,fill=255)
legacy_art.putalpha(legacy_mask)
legacy.alpha_composite(legacy_art,(43,43))
for density,size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    write(f'mipmap-{density}/ic_launcher.png', legacy.resize((size,size),LANCZOS))
    write(f'mipmap-{density}/ic_launcher_round.png',round_icon.resize((size,size),LANCZOS))

SOURCE.resize((512,512),LANCZOS).save(OUT/'google-play-icon-512.png',optimize=True)
foreground.save(OUT/'foreground-1080.png',optimize=True)
background.save(OUT/'background-1080.png',optimize=True)

# Preview uses the actual 72dp viewport, not the full 108dp layer canvas.
sheet = Image.new('RGB',(1200,700),'#102039')
d = ImageDraw.Draw(sheet)
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf',22)
def panel(im, label, index, shape='square'):
    x,y = 35+(index%4)*295, 50+(index//4)*335
    im = im.convert('RGBA').resize((240,240),LANCZOS)
    mask = Image.new('L',(960,960),255 if shape=='square' else 0)
    md = ImageDraw.Draw(mask)
    if shape=='circle': md.ellipse((0,0,959,959),fill=255)
    if shape=='rounded': md.rounded_rectangle((0,0,959,959),radius=215,fill=255)
    if shape=='squircle':
        yy,xx=np.mgrid[0:960,0:960]
        mask=Image.fromarray(np.uint8((abs((xx-479.5)/480)**4+abs((yy-479.5)/480)**4)<=1)*255)
    if shape != 'square':
        im.putalpha(mask.resize((240,240),LANCZOS))
    sheet.paste(im,(x,y),im)
    d.text((x,y+255),label,font=font,fill='white')
panel(legacy,'Legacy / rounded',0)
panel(viewport,'Adaptive / circle',1,'circle')
panel(viewport,'Adaptive / rounded',2,'rounded')
panel(viewport,'Adaptive / squircle',3,'squircle')
for i,(bg,fg) in enumerate([('#dce9ff','#17365e'),('#293d43','#b4ecea')]):
    themed=Image.new('RGBA',(1080,1080),bg)
    themed.paste(Image.new('RGBA',themed.size,fg),(0,0),mono)
    panel(themed.crop((180,180,900,900)),['Themed / light','Themed / dark'][i],4+i,'circle')
safe = composite.copy()
sd = ImageDraw.Draw(safe)
sd.ellipse((210,210,870,870),outline='#ffffff',width=4)
sd.rectangle((180,180,900,900),outline='#ffce35',width=3)
panel(safe,'108dp / 66dp safe circle',6)
small = Image.new('RGBA',(240,240),'#102039')
for i,size in enumerate([48,72,96]):
    im=viewport.resize((size,size),LANCZOS)
    small.alpha_composite(im,([0,58,140][i],100-size//2))
panel(small,'48 / 72 / 96 px',7)
sheet.save(OUT/'preview.png',optimize=True)

# Validate effective (nonzero) raster alpha and monochrome geometry against the
# conservative circular safe area; inventory all deployed resources.
fg = np.array(Image.open(RES/'drawable-xxxhdpi/ic_launcher_foreground.png'))[:,:,3]
yy,xx=np.nonzero(fg)
radius_dp=float(np.hypot(xx-215.5,yy-215.5).max()/4)
assert radius_dp <= 33, radius_dp
assert np.array(background)[:,:,3].min()==255
for tile in TILES:
    assert max(math.hypot(x-540,y-540)/10 for x,y in mapped(tile,.82)) <= 33
for path in RES.glob('**/ic_launcher*.xml'):
    ET.parse(path)
resources=[]
for path in sorted(RES.glob('**/ic_launcher*')):
    entry={'path':path.relative_to(RES).as_posix(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    if path.suffix=='.png':
        with Image.open(path) as im: entry.update(size=list(im.size),mode=im.mode)
    resources.append(entry)
report={'source_sha256':hashlib.sha256((HERE/'source.png').read_bytes()).hexdigest(),
        'foreground_max_radius_dp':radius_dp,'safe_radius_dp':33,'resources':resources}
(OUT/'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(f'Generated {len(resources)} icon resources; foreground radius {radius_dp:.2f}dp <= 33dp. Preview: {OUT / "preview.png"}')
