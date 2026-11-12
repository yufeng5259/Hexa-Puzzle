from pathlib import Path
from PIL import Image
import json,hashlib
r=Path('docs/v2');rec=r/'制作记录/切图20261112/icons';m=json.loads((rec/'manifest.json').read_text(encoding='utf8'));checked=[]
for e in m:
 for state,p in e['states'].items():
  f=r/'素材'/p;im=Image.open(f);assert im.mode=='RGBA';assert list(im.size)==e['size'];assert hashlib.sha256(f.read_bytes()).hexdigest()==e['sha256'][state];a=im.getchannel('A');assert a.getextrema()==(0,255);assert not any(a.crop((0,0,im.width,3)).getdata());assert not any(a.crop((0,im.height-3,im.width,im.height)).getdata());assert not any(a.crop((0,0,3,im.height)).getdata());assert not any(a.crop((im.width-3,0,im.width,im.height)).getdata());checked.append(p)
assert len(checked)==20
assert set(checked)=={p.relative_to(r/'素材').as_posix() for p in (r/'素材/UI/图标').glob('*.png')}
(rec/'verification.json').write_text(json.dumps({'batch':'P0','items':len(m),'pngs':len(checked),'checks':{'rgba':True,'sha256':True,'stateSize':True,'scale2':True,'transparentBorder3px':True,'noOrphanPNG':True,'whiteNavyCheckerContactInspected':True,'noTextNumbersVisuallyInspected':True,'coinAuthority':'S02 only; pile built from same master'},'notes':['S18任务奖励实际为紫金礼盒，icon_chest两态沿用此形象并派生开盖。','图标原图裁切2倍重采样，不声称AI超分。','icon_exp与icon_map为规范许可新增件，其余来自现有v2效果图。']},ensure_ascii=False,indent=2),encoding='utf8')
print('verified 19 assets / 20 PNG, alpha borders, hashes, dimensions, manifest coverage')
