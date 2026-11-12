from pathlib import Path
from PIL import Image,ImageDraw
R=Path('docs/v2');O=R/'制作记录/切图20261112/icons';O.mkdir(parents=True,exist_ok=True)
items=[('S02',(292,23,344,73),'coin'),('S02',(175,25,221,67),'energy'),('S02',(439,25,487,72),'settings'),('S04',(30,32,68,67),'home'),('S19',(101,31,143,65),'back'),('S19',(437,29,469,70),'help'),('S04',(76,951,132,1005),'undo'),('S04',(221,951,279,1005),'replay'),('S04',(370,946,425,1006),'hint'),('S02',(352,1013,398,1060),'build'),('S02',(24,100,82,163),'signin'),('S02',(24,200,82,264),'task'),('S02',(416,110,475,168),'endless'),('S18',(190,748,267,826),'chest'),('S19',(149,490,219,552),'pile'),('S04',(326,125,368,161),'deco')]
sheet=Image.new('RGB',(800,4*230),'#d8dce9');d=ImageDraw.Draw(sheet)
for i,(sid,b,name) in enumerate(items):
 im=Image.open(next((R/'效果图').glob(sid+'*.png')));a=im.width/500;b=tuple(round(v*a) for v in b);im=im.crop(b);im.thumbnail((170,180));x=(i%4)*200;y=(i//4)*230;sheet.paste(im,(x,y));d.text((x,y+185),name,fill='black')
sheet.save(O/'crops_review.png')
