"""P2-12 native SVG masters, derived from the existing v2 SVG visual system."""
from pathlib import Path
import math, json, hashlib, re, subprocess, colorsys

ROOT=Path(__file__).resolve().parents[4]
HERE=Path(__file__).parent
ART=ROOT/'素材'
RANK=ART/'UI/排行榜'
PALETTES={
 'gold':['#fff5a0','#ffdb50','#efaa20','#b76d11'],
 'silver':['#f7ffff','#cbe8f7','#83b3d0','#527d9d'],
 'bronze':['#ffe3b6','#eeb47c','#c77d47','#884b2c'],
 'normal':['#fffdf3','#f6e8ca','#e8d4aa','#bfa57a'],
 'self':['#fff6ad','#ffde63','#f4b925','#bf8513'],
 'blue':['#dcfbff','#79caff','#3089d8','#225489'],
 'purple':['#f0d9ff','#cc96f7','#9259d9','#5e3399'],
}
DEFS=''
for key,(hi,top,low,edge) in PALETTES.items():
 DEFS+=f'<linearGradient id="{key}" x1=".1" y1="0" x2=".7" y2="1"><stop stop-color="{hi}"/><stop offset=".28" stop-color="{top}"/><stop offset="1" stop-color="{low}"/></linearGradient>'
DEFS+='<linearGradient id="wing" x2=".3" y2="1"><stop stop-color="#ffffff"/><stop offset=".55" stop-color="#e2f5fa"/><stop offset="1" stop-color="#a4d4e5"/></linearGradient>'

def path(d,fill,stroke=None,sw=2,extra=''):
 return f'<path d="{d}" fill="{fill}" stroke="{stroke or "none"}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" {extra}/>'
def poly(points,fill,stroke=None,sw=2):
 return path('M'+' L'.join(f'{x:.2f} {y:.2f}' for x,y in points)+' Z',fill,stroke,sw)
def circle(x,y,r,fill,stroke=None,sw=2):
 return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{stroke or "none"}" stroke-width="{sw}"/>'
def ellipse(x,y,rx,ry,fill,stroke=None,sw=2):
 return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{stroke or "none"}" stroke-width="{sw}"/>'
def hexagon(x,y,r,color='gold'):
 return poly([(x+r*math.cos(a*math.pi/3),y+r*math.sin(a*math.pi/3)) for a in range(6)],f'url(#{color})',PALETTES[color][3],3)
def star(x,y,r,color='gold'):
 pts=[(x+math.sin(i*math.pi/5)*r*(1 if i%2==0 else .49),y-math.cos(i*math.pi/5)*r*(1 if i%2==0 else .49)) for i in range(10)]
 return poly(pts,f'url(#{color})',PALETTES[color][3],max(1.6,r*.045))+path(f'M{x-r*.19} {y-r*.28} Q{x-r*.06} {y-r*.46} {x} {y-r*.65}','none','#fffbd5',max(1.5,r*.045))
def drop(x,y,s):
 return path(f'M{x} {y-s} C{x-s} {y+s*.05} {x-s*.7} {y+s} {x} {y+s} C{x+s*.7} {y+s} {x+s} {y+s*.05} {x} {y-s}Z','url(#gold)','#d29623',2)+ellipse(x-s*.25,y+s*.2,s*.15,s*.28,'#fff9c2')
def wing(x,y,flip=1,scale=1):
 return f'<g transform="translate({x} {y}) scale({flip*scale} {scale})">'+path('M0 30 C-15 -2 -75 -64 -99 -37 C-116 -10 -68 26 0 42Z','url(#wing)','#b3d4dc',2)+path('M-5 31 Q-54 -7 -88 -26 M-35 12 L-60 -31 M-33 14 L-79 6','none','#fff',3)+'</g>'
def rect(x,y,w,h,r,fill,stroke=None,sw=2,extra=''):
 return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke or "none"}" stroke-width="{sw}" {extra}/>'
jobs=[]
def save(name,size,body,folder=RANK,own_defs=True):
 folder.mkdir(parents=True,exist_ok=True)
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{size[0]}" height="{size[1]}" viewBox="0 0 {size[0]} {size[1]}"><defs>{DEFS if own_defs else ""}</defs>{body}</svg>'
 src=HERE/f'{name}.svg';src.write_text(svg,encoding='utf-8')
 jobs.append(dict(source=src.name,out=(folder/f'{name}.png').relative_to(ROOT).as_posix(),width=size[0],height=size[1]))

def build():
 # White tintable base: no colored trim, slight recessed perimeter.
 save('avatar_bg',(256,256),rect(9,9,238,238,40,'#dcdcdc')+rect(11,12,234,233,38,'#fafafa')+rect(14,16,228,226,35,'#ffffff'))
 # Inner opening is 252x252 and aligns to avatar_bg's 244px outer edge at centered placement.
 for kind in ['normal','gold','silver','bronze','self']:
  body=''
  if kind=='self':
   for i,opacity in [(3,.04),(2,.08),(1,.13)]:
    body+=rect(15-i,15-i,258+2*i,258+2*i,49+i,'none','#ffc949',i*2,extra=f'opacity="{opacity}"')
  body+=path('M62 15 H226 Q273 15 273 62 V226 Q273 273 226 273 H62 Q15 273 15 226 V62 Q15 15 62 15 Z M62 22 Q22 22 22 62 V226 Q22 266 62 266 H226 Q266 266 266 226 V62 Q266 22 226 22 Z',f'url(#{kind})',extra='fill-rule="evenodd"')
  body+=path('M62 18 H226 Q270 18 270 62 V226 Q270 270 226 270 H62 Q18 270 18 226 V62 Q18 18 62 18Z','none',PALETTES[kind][3],2)
  body+=path('M29 79 V62 Q29 28 63 28 H182','none',PALETTES[kind][0],3)
  # Metallic inner edge; keep entire center alpha zero.
  save('avatar_frame_'+kind,(288,288),body)
 for n in range(1,6):
  col=['bronze','silver','gold','blue','purple'][n-1]; b=''
  if n>=4:
   b+=wing(92,178,1,.75)+wing(228,178,-1,.75)
  if n==5:
   for a in range(0,360,30):
    rad=math.radians(a);x=160+123*math.cos(rad);y=171+133*math.sin(rad)
    b+=path(f'M{x} {y} l{math.cos(rad)*14} {math.sin(rad)*14}','none','#f8d26b',5)
  b+=path('M160 69 L251 115 V221 Q245 271 160 306 Q75 271 69 221 V115Z',f'url(#{col})',PALETTES[col][3],5)
  b+=path('M160 85 L237 124 V219 Q228 261 160 289 Q92 261 83 219 V124Z','none',PALETTES[col][0],3)
  if n==1: b+=wing(135,167,1,.85)
  elif n in [2,3]: b+=wing(115,162,1,.55)+wing(205,162,-1,.55)
  b+=hexagon(160,185,48,'gold')+hexagon(160,185,32,'bronze' if n==1 else col)
  if n==2:
   for a in range(5):
    x=160+20*math.sin(a*math.pi*2/5);y=228-20*math.cos(a*math.pi*2/5)
    b+=ellipse(x,y,12,15,'#fff9da','#e9b84d',2)
   b+=circle(160,228,12,'url(#gold)')
  if n==3: b+=path('M160 208 L185 221 V244 Q181 259 160 267 Q139 259 135 244 V221Z','url(#gold)','#9e6612',3)
  if n==4: b+=drop(160,244,15)
  if n==5:
   b+=path('M110 99 L101 51 L135 71 L160 36 L185 71 L219 51 L210 99Z','url(#gold)','#b07b21',4)
   b+=rect(109,94,102,17,7,'url(#gold)','#b07b21',2)+hexagon(160,78,13,'purple')
   b+=star(160,241,23)
  save(f'league_badge_{n}',(320,352),b)
 save('icon_league_star',(128,128),star(64,66,55))
 for n,(w,h) in enumerate([(440,320),(400,240),(400,200)],1):
  col=['gold','silver','bronze'][n-1];edge=PALETTES[col][3];top=40;bottom=h-10
  b=path(f'M12 {top+31} V{bottom-33} C12 {bottom+10} {w-12} {bottom+10} {w-12} {bottom-33} V{top+31}Z',f'url(#{col})',edge,3)
  b+=ellipse(w/2,top+31,w/2-12,48,PALETTES[col][1],edge,3)
  b+=ellipse(w/2,top+24,w/2-19,40,f'url(#{col})')
  b+=path(f'M29 {top+20} Q{w/2} {top-21} {w-34} {top+19}','none',PALETTES[col][0],4)
  for x in [w/2-64,w/2,w/2+64]:
   b+=poly([(x+25*math.cos(a*math.pi/3),h*.67+25*math.sin(a*math.pi/3)) for a in range(6)],'none',PALETTES[col][0],2)
  save(f'podium_{n}',(w,h),b)
 for kind,col in [('normal','normal'),('self','self')]:
  b=rect(0,0,240,144,40,PALETTES[col][3])+rect(0,0,240,137,40,PALETTES[col][2])+rect(2,2,236,130,38,f'url(#{col})')+path('M39 7 H200','none',PALETTES[col][0],3)
  save('rank_row_'+kind,(240,144),b)
 for kind,col in [('normal','normal'),('selected','gold')]:
  b=rect(0,0,160,96,39,PALETTES[col][3])+rect(0,0,160,89,39,f'url(#{col})')+path('M39 6 H119','none',PALETTES[col][0],3)
  if kind=='normal': b=f'<g opacity=".8">{b}</g>'
  save('tab_'+kind,(160,96),b)
 for n,col in enumerate(['gold','silver','bronze'],1):
  b=circle(64,65,56,PALETTES[col][3])+circle(64,61,54,f'url(#{col})',PALETTES[col][3],2)+circle(64,61,43,'none',PALETTES[col][0],2)+circle(64,61,38,PALETTES[col][1])+path('M25 45 Q35 18 66 18','none',PALETTES[col][0],3)
  save('rank_medal_'+str(n),(128,128),f'<g transform="translate(64 64) scale(.93) translate(-64 -64)">{b}</g>')
 # Existing native v2 P2-8 gift masters retain exact shared geometry for all three palettes.
 srcdir=ROOT/'制作记录/补充20261117/对照/制作依据'
 source_records=[]
 for state in ['closed','open']:
  src=srcdir/f'icon_chest_{state}.svg'; raw=src.read_text(encoding='utf-8');source_records.append(dict(path=str(src.relative_to(ROOT)),sha256=hashlib.sha256(src.read_bytes()).hexdigest()))
  # Original viewBox and its geometry are nested as one unit; the new framing is common to both states.
  raw=re.sub(r'<svg[^>]*>', '<svg x="15" y="5" width="370" height="428" viewBox="0 0 280 326">',raw,count=1)
  # Keep the box body fixed while the lid moves; P2-8 originally framed its two states differently.
  raw=raw.replace('translate(14,59) scale(.90)','translate(13,69) scale(.91)')
  # Replace only hues, never geometry/alpha.
  original=['#d08aff','#a458f2','#833be0','#5f2bb4','#9a55e7','#4e23a0','#e5acff','#ba73ff','#9145ed','#7133c1','#d9a2ff','#a35ce8','#ecc3ff','#542583','#bd77f7','#61318f']
  for col in ['gold','silver','bronze']:
   hi,top,lo,edge=PALETTES[col];colors=[hi,top,lo,edge,lo,edge,hi,top,lo,edge,hi,top,hi,edge,top,edge]
   body=raw
   # Recolor only the original honey ribbon paint, before the box palette is substituted.
   # Identical path geometry preserves all three alpha masks.
   if col!='gold':
    def ribbon_color(match):
     value=match.group(0); rgb=tuple(int(value[i:i+2],16)/255 for i in (1,3,5))
     hue,sat,light=colorsys.rgb_to_hsv(*rgb)
     if not (.065<=hue<=.19 and sat>.22):return value
     new=colorsys.hsv_to_rgb(.56 if col=='silver' else .07,sat*(.53 if col=='silver' else .88),light)
     return '#'+''.join(f'{round(v*255):02x}' for v in new)
    body=re.sub(r'#[0-9a-fA-F]{6}',ribbon_color,body)
   for old,new in zip(original,colors):body=body.replace(old,new)
   # Namespace the reused nested SVG paint servers so outer badge gradients never shadow them.
   body=re.sub(r'id="([^"]+)"',r'id="gift_\1"',body)
   body=body.replace('url(#','url(#gift_')
   if state=='open':
    # All tiers emit the same honey light, with a bright core inside the mouth and soft rising rays.
    body+='<defs><radialGradient id="mouth_glow"><stop stop-color="#fffde1" stop-opacity=".96"/><stop offset=".45" stop-color="#ffe38b" stop-opacity=".8"/><stop offset="1" stop-color="#ffd356" stop-opacity="0"/></radialGradient><linearGradient id="rising_light" x1="0" y1="1" x2="0" y2="0"><stop stop-color="#fff4b4" stop-opacity=".72"/><stop offset="1" stop-color="#ffdd66" stop-opacity="0"/></linearGradient></defs>'
    body+=ellipse(201,252,113,27,'url(#mouth_glow)')
    for d in ['M164 254 L143 191 L177 191 L185 254Z','M190 253 L190 183 L216 183 L212 253Z','M218 255 L233 196 L261 196 L235 255Z']:
     body+=path(d,'url(#rising_light)')
   # six-sided honey tag unique to this league gift variant, below knot on the front.
   body+=path('M217 240 Q227 266 219 290','none','#ac7723',3)+hexagon(219,301,18,'gold')+circle(219,298,3,'#9c6b24')
   save(f'gift_{col}_{state}',(400,440),body)
 # Entry icon, mini gold cylindrical podiums and dominant star.
 b=''
 for x,y,w,h in [(15,107,55,71),(128,126,55,52),(65,83,66,95)]:
  b+=path(f'M{x} {y+9} V{y+h-9} Q{x+w/2} {y+h+7} {x+w} {y+h-9} V{y+9}Z','url(#gold)','#b57514',2)+ellipse(x+w/2,y+9,w/2,10,'#fff2a5','#d8a036',2)
 b+=star(99,47,37)
 save('icon_leaderboard',(200,200),b,ART/'UI/图标')
 # Strictly keep x=224..896 (central 60%) empty for the reused ribbon.
 b=wing(203,220,1,1.3)+wing(917,220,-1,1.3)
 for x,y,r in [(103,252,55),(177,299,36),(50,315,24),(1017,252,55),(943,299,36),(1070,315,24)]:b+=hexagon(x,y,r)
 for x,y,r in [(146,100,24),(58,169,17),(974,100,24),(1062,169,17)]:b+=star(x,y,r)
 b+=drop(206,174,13)+drop(914,174,13)
 save('win_panel_header',(1120,360),b,ART/'UI/通用')
 (HERE/'sources.json').write_text(json.dumps({'derivedFrom':source_records,'newNativeMasters':len(jobs),'render':'SVG at 4x; Lanczos3 reduction; alpha preserved'},ensure_ascii=False,indent=2),encoding='utf-8')
 (HERE/'render_jobs.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2),encoding='utf-8')
 print('SVG masters:',len(jobs), 'root',ROOT)

if __name__=='__main__':build()
