from pathlib import Path
import json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import redraw_a as r
recs=[]
for rel in r.SPEC:
 old=r.old(rel);new=Image.open(r.ART/rel);small=new.resize(old.size,Image.Resampling.LANCZOS)
 a=np.array(old.getchannel('A'))>127;b=np.array(small.getchannel('A'))>127
 ab=a^ndi.binary_erosion(a);bb=b^ndi.binary_erosion(b)
 dist=max(ndi.distance_transform_edt(~ab)[bb].max(),ndi.distance_transform_edt(~bb)[ab].max())
 err=np.abs(np.array(old).astype(float)[:,:,:3]-np.array(small).astype(float)[:,:,:3])[a&b].mean()
 recs.append(dict(file=rel,size=list(new.size),sourceSize=list(old.size),silhouetteMaxDistance1x=float(dist),interiorRgbMeanAbsoluteError=float(err),sha256=r.sha(r.ART/rel),sourceSha256=r.sha(r.BEFORE/rel)))
(r.HERE/'verification.json').write_text(json.dumps(recs,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print([(Path(c['file']).stem,c['silhouetteMaxDistance1x'],round(c['interiorRgbMeanAbsoluteError'],1)) for c in recs])
