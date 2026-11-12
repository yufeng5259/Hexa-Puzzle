"""Portable bitmap hex compositor. No engine, absolute path, or API dependency.

python compose_hex.py --shape H001 --color 1_png --out example.png
This command is an explicit editor/export preview; runtime may cache the same composition in memory.
"""
from pathlib import Path
from PIL import Image
import argparse,json

def compose(shape_id,color_id='1_png',root=None):
    root=Path(root) if root else Path(__file__).resolve().parent
    data=json.loads((root/'shapes.json').read_text(encoding='utf-8'))
    shape=next(s for s in data['mainlineShapes']+data['endlessProposalShapes'] if s['id']==shape_id)
    mother=next(m for m in data['palette'] if m['id']==color_id)
    tile=Image.open(root/'母件'/Path(mother['file']).name).convert('RGBA')
    coords=[(90*q,52*(2*r+q)) for q,r in shape['cells']]
    minx=min(x for x,y in coords);miny=min(y for x,y in coords)
    out=Image.new('RGBA',(max(x for x,y in coords)-minx+121,max(y for x,y in coords)-miny+105))
    for x,y in coords:out.alpha_composite(tile,(x-minx,y-miny))
    return out

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--shape',required=True);p.add_argument('--color',default='1_png');p.add_argument('--out',required=True)
    a=p.parse_args();out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);compose(a.shape,a.color).save(out)
    print(out)
