from pathlib import Path
import json,ast
from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageChops,ImageColor
R=Path(__file__).resolve().parent;V2=R.parents[3];A=V2/'素材'
lookup={}
for p in (V2/'制作记录/切图20261112').rglob('manifest.json'):
 try:
  for a in json.loads(p.read_text(encoding='utf-8-sig')):
   for path in a.get('states',{}).values():lookup[path]=a
 except (AttributeError,TypeError):pass
src=ast.parse((V2/'制作记录/切图20261112/integrate_verify.py').read_text(encoding='utf-8-sig'))
ns={'Image':Image};exec(compile(ast.Module(body=[x for x in src.body if isinstance(x,ast.FunctionDef) and x.name=='nine'],type_ignores=[]),'nine','exec'),ns);nine=ns['nine']
def render(sid,exclude=[]):
 j=json.loads((A/'布局'/f'{sid}.json').read_text(encoding='utf-8'));im=render(j['underlay'],j.get('underlayExcludeIds',[])) if j.get('underlay') else Image.new('RGBA',(854,1842),'#0E2A5C')
 if j.get('underlayBlur'):im=im.filter(ImageFilter.GaussianBlur(j['underlayBlur']))
 for e in j['elements']:
  if e['id'] in exclude:continue
  if 'rect' in e:x,y,w,h=map(round,e['rect'])
  elif e.get('anchor')=='building_feet':
   fx,fy=j['anchorContext'][e['buildingId']]['feet'];dx,dy=e['offset'];w,h=e['size'];x,y=round(fx+dx-w/2),round(fy+dy-h/2)
  else:continue
  if 'asset' in e:
   pic=Image.open(A/e['asset']).convert('RGBA');pic=nine(pic,(w,h),lookup.get(e['asset'],{}).get('slice') if e.get('slice') else None)
   if e.get('tint'):
    alpha=pic.getchannel('A');pic=ImageChops.multiply(pic,Image.new('RGBA',pic.size,ImageColor.getrgb(e['tint'])+(255,)));pic.putalpha(alpha)
   if e.get('flipX'):pic=pic.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
   if 'opacity' in e:pic.putalpha(pic.getchannel('A').point(lambda z:round(z*e['opacity'])))
   im.alpha_composite(pic,(x,y))
  elif e.get('type')=='label':
   f=ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc' if e.get('bold') else 'C:/Windows/Fonts/msyh.ttc',e['fontSize']);ImageDraw.Draw(im).text((x+w/2,y+h/2),e['text'],font=f,fill=e.get('color','#FFFFFF'),anchor='mm')
 return im
contact=Image.new('RGB',(1281,1842),'#0E2A5C')
for i,sid in enumerate(['S18','S19','S20','S21','S22','S23']):
 im=render(sid);im.convert('RGB').save(R/(sid+'_preview.jpg'),quality=90);contact.paste(im.convert('RGB').resize((427,921)),((i%3)*427,(i//3)*921))
contact.save(R/'contact.jpg',quality=92)
