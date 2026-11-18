"""Remove the neutral extraction fringe, retaining the original gold artwork."""
from pathlib import Path
import subprocess,json,hashlib
from io import BytesIO
import numpy as np
from PIL import Image,ImageFilter
from scipy import ndimage as ndi
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
REL='UI/任务/task_icon_puzzle.png'
raw=subprocess.check_output(['git','show','0aea3fc:docs/v2/素材/'+REL])
(HERE/'before.png').write_bytes(raw)
im=Image.open(BytesIO(raw)).convert('RGBA');a=np.asarray(im).astype(float)
# Gold has a strong red/blue difference; the extracted cream/gray halo does not.
strength=np.clip((a[:,:,0]-a[:,:,2]-78)/36,0,1)
alpha=(a[:,:,3]/255)*strength
labels,_=ndi.label(alpha>.1);sizes=np.bincount(labels.ravel());sizes[0]=0
alpha*=labels==sizes.argmax()
# Preserve subpixel antialiasing at the cleaned contour without sharpening the art.
smooth=np.asarray(Image.fromarray(np.uint8(alpha*255)).filter(ImageFilter.GaussianBlur(.9)))/255
shape=ndi.binary_fill_holes(smooth>.46)
shape=ndi.binary_opening(shape,iterations=2)
alpha=np.asarray(Image.fromarray(np.uint8(shape)*255).filter(ImageFilter.GaussianBlur(.65)))/255
safe=(strength>.94)&(a[:,:,3]>230)
_,idx=ndi.distance_transform_edt(~safe,return_indices=True)
rgb=a[:,:,:3].copy()
edge=(alpha>0)&~safe
rgb[edge]=rgb[idx[0][edge],idx[1][edge]]
out=np.uint8(np.dstack([rgb,np.round(alpha*255)]));out[out[:,:,3]==0,:3]=0
dest=ROOT/'素材'/REL;Image.fromarray(out).save(dest)
(HERE/'source.json').write_text(json.dumps(dict(source='0aea3fc:docs/v2/素材/'+REL,originalSha256=hashlib.sha256(raw).hexdigest(),sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),size=list(im.size),method='neutral fringe chroma removal; edge foreground colour extension; subpixel alpha smoothing',originalArtworkPreserved=True),ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('task_icon_puzzle: neutral fringe removed; 264x264 retained')
