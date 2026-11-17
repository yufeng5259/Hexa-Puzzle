"""Chroma-key edge decontamination and reproducible 2x avatar exports."""
import hashlib
import json
import shutil
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from prepare_avatars import ANIMALS

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DEST = ROOT/'素材/UI/排行榜/avatar'
DEST.mkdir(parents=True, exist_ok=True)

def matte(path):
    rgb = np.asarray(Image.open(path).convert('RGB'), dtype=np.float32)/255
    # Estimate foreground colours from nearest non-key pixel, solve C = a F + (1-a) B.
    chroma = np.minimum(rgb[:,:,0],rgb[:,:,2])-rgb[:,:,1]
    key = chroma > .16
    _, nearest = ndi.distance_transform_edt(key,return_indices=True)
    fg = rgb[nearest[0],nearest[1]]
    bg = np.array([1.,0.,1.],dtype=np.float32)
    direction = fg-bg
    alpha = np.clip(np.sum((rgb-bg)*direction,axis=2)/(np.sum(direction**2,axis=2)+1e-8),0,1)
    alpha[~key] = 1
    alpha[chroma>.94] = 0
    labels, _ = ndi.label(alpha>.05)
    sizes = np.bincount(labels.ravel()); sizes[0]=0
    keep = labels == sizes.argmax()
    alpha *= keep
    recovered = np.clip((rgb-(1-alpha[:,:,None])*bg)/np.maximum(alpha[:,:,None],.001),0,1)
    recovered[alpha<.01]=0
    rgba = np.dstack([recovered,alpha])
    return Image.fromarray(np.uint8(np.round(rgba*255)),'RGBA')

def normalize(im):
    a=np.asarray(im).copy()
    labels,_=ndi.label(a[:,:,3]>12)
    sizes=np.bincount(labels.ravel());sizes[0]=0
    a[labels!=sizes.argmax()]=0
    im=Image.fromarray(a)
    im=im.crop(im.getbbox())
    im.thumbnail((232,232),Image.Resampling.LANCZOS)
    out=Image.new('RGBA',(256,256))
    out.alpha_composite(im,((256-im.width)//2,(256-im.height)//2))
    a=np.array(out); a[a[:,:,3]==0,:3]=0
    return Image.fromarray(a)

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

if __name__=='__main__':
    raw = Path(sys.argv[1] if len(sys.argv)>1 else 'D:/CodexData/Temp/P2-12/raw')
    source_dir=HERE/'avatar_sources';source_dir.mkdir(exist_ok=True)
    records=[]
    for animal,subject,accessory in ANIMALS:
        src=raw/f'avatar_{animal}.png'
        if not src.exists(): continue
        preserved=source_dir/src.name
        shutil.copyfile(src,preserved)
        out=DEST/src.name
        normalize(matte(src)).save(out)
        records.append(dict(id=animal,subject=subject,accessory=accessory,source=str(preserved.relative_to(ROOT)),sourceSha256=sha(src),file=str(out.relative_to(ROOT)),sha256=sha(out)))
    # Preserve identity: derive the player's close-up from the already delivered bee_wave.
    src=ROOT/'素材/角色/bee_wave.png'
    bee=Image.open(src).convert('RGBA')
    cut=bee.crop((90,12,280,228))
    mask=Image.new('L',cut.size,255); d=ImageDraw.Draw(mask)
    d.polygon([(0,150),(12,167),(28,185),(48,203),(67,216),(0,216)],fill=0)
    d.polygon([(190,188),(150,216),(190,216)],fill=0)
    cut.putalpha(Image.fromarray(np.minimum(np.array(cut.getchannel('A')),np.array(mask))))
    out=DEST/'avatar_player_bee.png';normalize(cut).save(out)
    records.append(dict(id='player_bee',source='素材/角色/bee_wave.png',sourceSha256=sha(src),crop=[90,12,280,228],sha256=sha(out)))
    (HERE/'avatar_provenance.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Exported {len(records)} avatars')
