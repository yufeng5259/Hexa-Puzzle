"""High-resolution finishing for the two new P0 icons (fixed canvases)."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageOps,ImageFont
import numpy as np,cv2,json,hashlib
R=Path('docs/v2');O=R/'素材/UI/图标';REC=R/'制作记录/切图20261112/icons'
S=4;N=220;SZ=(N*S,N*S)
y,x=np.mgrid[0:N*S,0:N*S].astype(float);x/=S;y/=S

def path_mask(commands):
 im=Image.new('L',SZ);pts=[];last=(0,0)
 for op,args in commands:
  if op=='moveto':last=args;pts.append(last)
  elif op=='lineto':last=args;pts.append(last)
  elif op=='curveto':
   p0=np.array(last);p1=np.array(args[:2]);p2=np.array(args[2:4]);p3=np.array(args[4:6])
   for t in np.linspace(0,1,61)[1:]:pts.append(tuple((1-t)**3*p0+3*(1-t)**2*t*p1+3*(1-t)*t*t*p2+t**3*p3))
   last=args[4:6]
 ImageDraw.Draw(im).polygon([(round(p[0]*S),round(p[1]*S)) for p in pts],fill=255);return im

def finish_color(mask,top,bottom,bevel=6,side=1):
 a=np.array(mask);dist=cv2.distanceTransform((a>0).astype('uint8'),cv2.DIST_L2,5)/S
 t=np.clip(y/210,0,1);rgb=np.zeros((*a.shape,3),float)
 for k in range(3):rgb[:,:,k]=top[k]*(1-t)+bottom[k]*t
 # Broad rounded bevel, with raised left/top surfaces and shaded lower/right lip.
 gy,gx=np.gradient(dist);gx*=S;gy*=S
 edge=np.clip((bevel-dist)/bevel,0,1)
 lit=(gx*.75+gy*.65)*edge
 rgb+=lit[:,:,None]*58
 rgb-=np.clip((2.0-dist)/2,0,1)[:,:,None]*24
 rgb+=np.exp(-((x-68)/70)**2-((y-62)/90)**2)[:,:,None]*14
 out=np.dstack([np.clip(rgb,0,255),a]).astype('uint8');return Image.fromarray(out)

def ellipse_layer(im,box,color,blur=0,mask=None):
 lay=Image.new('RGBA',SZ);d=ImageDraw.Draw(lay);d.ellipse(tuple(round(v*S) for v in box),fill=color)
 if blur:lay=lay.filter(ImageFilter.GaussianBlur(blur*S))
 if mask is not None:
  a=np.minimum(np.array(lay.getchannel('A')),np.array(mask));lay.putalpha(Image.fromarray(a))
 im.alpha_composite(lay)

def fitted(im,key):
 target=Image.open(O/(key+'.png')).size
 # Keep original canvas and transparent border. Reserve 3 pixels after reduction.
 crop=im.crop(im.getbbox());im=ImageOps.contain(crop,(target[0]-6,target[1]-6),Image.Resampling.LANCZOS)
 out=Image.new('RGBA',target);out.alpha_composite(im,((target[0]-im.width)//2,(target[1]-im.height)//2));out.save(O/(key+'.png'))

# Continuous curved volume; warm translucent amber, no polygon outline.
m=path_mask([('moveto',(111,10)),('curveto',(106,28,92,49,73,72)),('curveto',(50,100,36,122,39,149)),('curveto',(42,181,67,204,106,206)),('curveto',(147,208,177,186,182,154)),('curveto',(188,124,175,102,153,74)),('curveto',(134,50,119,28,111,10)),('close',())])
im=finish_color(m,(255,224,70),(237,136,13),bevel=10)
# Golden lower meniscus and internal honey light.
ellipse_layer(im,(58,120,167,204),(255,192,22,125),10,m)
ellipse_layer(im,(64,137,155,197),(255,230,79,145),7,m)
ellipse_layer(im,(63,165,151,200),(255,242,132,145),4,m)
# Long curved specular gloss and small secondary light, rendered through bezier.
hl=path_mask([('moveto',(94,63)),('curveto',(77,82,59,108,57,131)),('curveto',(56,143,61,149,68,145)),('curveto',(74,142,72,130,76,116)),('curveto',(80,99,91,79,100,67)),('curveto',(103,62,98,59,94,63)),('close',())])
lay=Image.new('RGBA',SZ,(255,255,218,0));lay.putalpha(hl.point(lambda a:round(a*.87)));im.alpha_composite(lay.filter(ImageFilter.GaussianBlur(.55*S)))
ellipse_layer(im,(76,76,86,93),(255,255,238,230),.6,m)
ellipse_layer(im,(150,143,160,166),(255,241,118,140),1.1,m)
fitted(im,'icon_exp')

# Folded thick parchment: each face has an independent light field, beveled lip and crease shadow.
im=Image.new('RGBA',SZ)
faces=[([(21,57),(78,31),(78,173),(21,195)],(255,238,180),(231,179,88)), ([(78,31),(139,55),(139,199),(78,173)],(104,225,217),(11,155,169)), ([(139,55),(199,30),(199,172),(139,199)],(255,235,169),(237,182,88))]
# Underlying thickness, offset down-right; warm brown small dimensional lip.
for pts,top,bot in faces:
 shadow=path_mask([('moveto',(pts[0][0]+3,pts[0][1]+5))]+[('lineto',(p[0]+3,p[1]+5)) for p in pts[1:]]+[('close',())]);im.alpha_composite(finish_color(shadow,(171,119,47),(125,78,25),4))
for pts,top,bot in faces:
 mask=path_mask([('moveto',pts[0])]+[('lineto',p) for p in pts[1:]]+[('close',())]);face=finish_color(mask,top,bot,5)
 # Soft fold shadow along right edge and raised creamy left edge.
 px=np.array(face).astype(float);left=pts[0][0];right=pts[1][0]
 shade=np.exp(-((x-right)/5)**2)*-24+np.exp(-((x-left-4)/4)**2)*15
 px[:,:,:3]=np.clip(px[:,:,:3]+shade[:,:,None],0,255);face=Image.fromarray(px.astype('uint8'));im.alpha_composite(face)
# Route has round caps and a gentle dashed arc, like toy paint embedded into the fold.
d=ImageDraw.Draw(im)
route=[(37,134),(54,110),(73,119),(91,139),(112,123),(130,129),(152,113)]
for i in range(len(route)-1):
 p,q=route[i],route[i+1];d.line((p[0]*S,p[1]*S,q[0]*S,q[1]*S),fill='#fff4c5',width=5*S)
for p in route:d.ellipse(((p[0]-2.5)*S,(p[1]-2.5)*S,(p[0]+2.5)*S,(p[1]+2.5)*S),fill='#fff4c5')
# Raised coral location pin, bottom-right shade and top-left glint.
pin=path_mask([('moveto',(165,130)),('curveto',(160,119,145,107,145,93)),('curveto',(145,66,185,65,187,92)),('curveto',(188,108,173,119,165,130)),('close',())])
im.alpha_composite(finish_color(pin,(255,149,121),(222,63,76),bevel=4))
ellipse_layer(im,(153,77,171,86),(255,217,182,190),1,pin)
d=ImageDraw.Draw(im);d.ellipse((157*S,84*S,175*S,102*S),fill='#fff0be');d.ellipse((161*S,88*S,175*S,102*S),fill='#e5b875')
fitted(im,'icon_map')

manifest=json.loads((REC/'manifest.json').read_text(encoding='utf8'))
for e in manifest:
 if e['id'] in ('icon_exp','icon_map'):
  p=O/(e['id']+'.png');assert list(Image.open(p).size)==e['size'];e['sha256']['normal']=hashlib.sha256(p.read_bytes()).hexdigest();e['source']=e['source'].split('；4倍')[0]+'；4倍超采样曲面倒角/左上高光/右下阴影精修'
(REC/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',15)
for bg in ['white','navy','checker']:
 sheet=Image.new('RGB',(1000,5*210),'#eeeeee' if bg=='white' else '#0e2a5c');dd=ImageDraw.Draw(sheet)
 if bg=='checker':
  for yy in range(0,sheet.height,14):
   for xx in range(0,sheet.width,14):dd.rectangle((xx,yy,xx+13,yy+13),fill='#d9dfe5' if (xx//14+yy//14)%2 else '#fff')
 items=[(e['id']+'_'+s,Image.open(R/'素材'/p).convert('RGBA')) for e in manifest for s,p in e['states'].items()]
 for i,(name,ico) in enumerate(items):
  xx=(i%5)*200;yy=(i//5)*210;ico=ImageOps.contain(ico,(170,160));sheet.paste(ico,(xx+(200-ico.width)//2,yy+10),ico);dd.text((xx+4,yy+177),name.replace('icon_',''),font=font,fill='black' if bg!='navy' else 'white')
 sheet.save(REC/f'contact_{bg}.png')
print('polished map / exp; original sizes preserved')
