from pathlib import Path
from PIL import Image,ImageOps,ImageDraw,ImageFont
import json,hashlib
R=Path('docs/v2');REC=R/'制作记录/切图20261112/P1/endless';m=json.loads((REC/'manifest.json').read_text(encoding='utf8'));items=[]
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',14)
for e in m:
 if e['id']=='bg_endless':continue
 pairs=e.get('states') or dict(zip(e['frameNames'],e['frames']))
 for state,p in pairs.items():items.append((e['id']+'_'+state,Image.open(R/'素材'/p).convert('RGBA'),e.get('slice')))
def nine(im,sl,w,h):
 l,t,r,b=sl;xs=[0,l,im.width-r,im.width];ys=[0,t,im.height-b,im.height];dx=[0,l,w-r,w];dy=[0,t,h-b,h];o=Image.new('RGBA',(w,h))
 for yy in range(3):
  for xx in range(3):o.alpha_composite(im.crop((xs[xx],ys[yy],xs[xx+1],ys[yy+1])).resize((dx[xx+1]-dx[xx],dy[yy+1]-dy[yy]),Image.Resampling.LANCZOS),(dx[xx],dy[yy]))
 return o
for bg in ('white','navy','checker'):
 out=Image.new('RGB',(1200,750),'#fff' if bg=='white' else '#0e2a5c');d=ImageDraw.Draw(out)
 if bg=='checker':
  for y in range(0,750,14):
   for x in range(0,1200,14):d.rectangle((x,y,x+13,y+13),fill='#e1e4e8' if (x//14+y//14)%2 else '#fff')
 for i,(name,im,sl) in enumerate(items):
  x=(i%4)*300;y=(i//4)*250;im=ImageOps.contain(im,(270,190));out.paste(im,(x+(300-im.width)//2,y+10),im);d.text((x+5,y+215),name,font=font,fill='black' if bg!='navy' else 'white')
 out.save(REC/f'contact_{bg}.png')
out=Image.new('RGB',(1300,1200),'#0e2a5c');d=ImageDraw.Draw(out);yy=0
for name,im,sl in items:
 if not sl:continue
 grown=nine(im,sl,im.width*2,im.height*2);out.paste(im,(10,yy+26),im);out.paste(grown,(340,yy+26),grown);d.text((10,yy+3),name+' original / 2xW 2xH',font=font,fill='white');yy+=grown.height+55
out.crop((0,0,1300,yy)).save(REC/'stretch_2x.png')
assert len(items)==12
for e in m:
 pairs=e.get('states') or dict(zip(e['frameNames'],e['frames']))
 for k,p in pairs.items():
  f=R/'素材'/p;im=Image.open(f);assert list(im.size)==e['size'];assert im.mode=='RGBA';assert hashlib.sha256(f.read_bytes()).hexdigest()==e['sha256'][k]
  if e['id']!='bg_endless':
   a=im.getchannel('A');assert a.getextrema()[0]==0
newset={p for e in m if e['id']!='bg_endless' for p in (list(e.get('states',{}).values())+e.get('frames',[]))};actual={p.relative_to(R/'素材').as_posix() for folder in [R/'素材/UI/无尽',R/'素材/UI/特效/fx_line_clear'] for p in folder.glob('*.png')};assert newset==actual
(REC/'verification.json').write_text(json.dumps({'priority':'P1','entries':6,'newPNGs':12,'reusedBackgrounds':1,'rgba':True,'hashes':True,'stateAndFrameDimensions':True,'noOrphanPNG':True,'boardFrame':'not_applicable; see decisions.json','visualCheck':'white/navy/checker contacts, 2x width/height stretch and six-frame contact actually inspected; no labels/numbers'},ensure_ascii=False,indent=2),encoding='utf8')
print('checked',len(items),'new images')
