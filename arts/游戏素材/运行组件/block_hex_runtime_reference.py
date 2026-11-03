"""Portable exact Block hex reference renderer.

Dependencies: Python 3.10+, numpy, Pillow, opencv-python (cv2).
Input: serialized procedural spec and shared material paths/resolver.
No project, gameplay, Codex, credentials or machine path dependency.
Generated rasters are editor/memory caches, never per-level runtime assets.
"""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import math
import json
import numpy as np
from PIL import Image, ImageDraw, ImageChops, ImageFilter
RENDERER='block.hex.v1'

def _material(materials, key, resolver=None):
    value = materials[key]
    if resolver:
        value = resolver(value)
    if isinstance(value, Image.Image):
        return value.convert('RGBA')
    if isinstance(value, dict):
        value = value.get('source_file') or value.get('file')
    return Image.open(value).convert('RGBA')



def render_component(spec, resolver=None):
    """Rebuild a complete untrimmed layer solely from serialized recipe data.

    Resolver accepts each spec.materials value (asset id, path or descriptor)
    and returns a PIL image or path. No final package or Scene import is needed
    when a resolver and serialized material references have been supplied.
    """
    if spec.get('renderer') != RENDERER:
        raise ValueError('Unsupported hex renderer contract')
    role = spec['role']
    if role in ('shadow','floor','rim'):
        # Board intermediates are calculated with the same native material set;
        # unused channels are filled with harmless values, never exported.
        material_values = dict(spec.get('materials', {}))
        def load(key, fallback):
            return _material(material_values, key, resolver) if key in material_values else fallback
        floor = load('hex_wood_floor', Image.new('RGBA',(1,1),(128,128,128,255)))
        rail = load('hex_rail_profile', Image.new('RGBA',(1,26),(128,128,128,255)))
        well = Image.new('RGBA',(1,1))
        art = render_board(spec['cells'], spec['bbox'], spec.get('supersample',2),
                           spec.get('flip_y',True),
                           {'hex_wood_floor':floor,'hex_rail_profile':rail,'hex_empty_well':well},
                           padding=spec.get('padding',24))
        return art[role]
    if role in ('well','obstacle'):
        source = _material(spec['materials'],'hex_empty_well',resolver)
        if role == 'obstacle':
            gray = ImageChops.blend(source.convert('L').convert('RGBA'),source,.15)
            gray.putalpha(source.getchannel('A'));source=gray
        return source.resize(tuple(spec['size']),Image.Resampling.LANCZOS)
    if role == 'selection':
        w,h=spec['size'];n=3
        image=Image.new('RGBA',(math.ceil(w)*n,math.ceil(h)*n))
        ImageDraw.Draw(image).rounded_rectangle((4*n,4*n,(w-4)*n,(h-4)*n),radius=17*n,
                                               outline='#ffe27d',width=4*n)
        return image.resize((math.ceil(w),math.ceil(h)),Image.Resampling.LANCZOS)
    if role == 'outline':
        layout=fit_cells(spec['cells'],spec['bbox'],spec.get('padding',24),spec.get('flip_y',True))
        # Existing recipe helper outlines may use a caller-supplied radius and
        # centers (tutorial's shared board layout), so retain these if provided.
        if 'layout' in spec:
            data=spec['layout'];layout=HexLayout({tuple(c['cell']):tuple(c['center'])for c in data['centers']},
                data['radius'],tuple(spec['bbox']),tuple(data.get('offset',(0,0))))
        x,y,w,h=layout.bbox;n=3;width=spec.get('width',5)
        color=tuple(spec.get('color',[255,228,105,255]))
        image=Image.new('RGBA',(math.ceil(w)*n,math.ceil(h)*n));d=ImageDraw.Draw(image)
        for cell in spec.get('outline_cells',spec['cells']):
            cx,cy=layout.center(cell)
            points=[((a-x)*n,(b-y)*n)for a,b in hex_vertices(cx,cy,layout.radius*.95)]
            d.line(points+[points[0]],fill=(107,52,12,245),width=(width+6)*n,joint='curve')
            d.line(points+[points[0]],fill=(242,159,29,255),width=(width+3)*n,joint='curve')
            d.line(points+[points[0]],fill=color,width=width*n,joint='curve')
            d.line([points[3],points[4],points[5],points[0]],fill=(255,250,196,255),width=max(2,width//2)*n,joint='curve')
        return image.resize((math.ceil(w),math.ceil(h)),Image.Resampling.LANCZOS)
    raise ValueError('Unsupported role '+role)



def axial_pixel(q, r, flip_y=True):
    """Flat-top centers; puzzle/tray CSS scaleY(-1), endless board is unflipped."""
    return 1.5 * q, math.sqrt(3) * (r + q / 2) * (-1 if flip_y else 1)


def hex_vertices(cx, cy, radius):
    return [(cx + radius * math.cos(math.pi * i / 3),
             cy + radius * math.sin(math.pi * i / 3)) for i in range(6)]


@dataclass(frozen=True)
class HexLayout:
    centers: dict
    radius: float
    bbox: tuple
    offset: tuple

    def center(self, cell):
        return self.centers[tuple(cell)]

    def tile_box(self, cell, factor=1.0):
        x, y = self.center(cell)
        rx, ry = self.radius * factor, math.sqrt(3) / 2 * self.radius * factor
        return (x - rx, y - ry, 2 * rx, 2 * ry)


def fit_cells(cells, bbox, padding=20, flip_y=True):
    """Fit exact complete geometry, retaining holes, not a rectangular crop."""
    cells = [tuple(c) for c in cells]
    if not cells:
        raise ValueError('Cannot fit an empty shape')
    centers = {c: axial_pixel(*c, flip_y=flip_y) for c in cells}
    xs, ys = zip(*centers.values())
    left, top = min(xs) - 1, min(ys) - math.sqrt(3) / 2
    width, height = max(xs) + 1 - left, max(ys) + math.sqrt(3) / 2 - top
    x, y, w, h = bbox
    scale = min((w - 2 * padding) / width, (h - 2 * padding) / height)
    ox, oy = x + (w - width * scale) / 2 - left * scale, y + (h - height * scale) / 2 - top * scale
    return HexLayout({c: (ox + p[0] * scale, oy + p[1] * scale) for c, p in centers.items()},
                     scale, tuple(bbox), (ox, oy))



def _mirror_texture(image, size):
    """Use existing natural wood pixels; mirror-repeat without hard tile seams."""
    image = image.convert('RGB')
    tile = Image.new('RGB', (image.width * 2, image.height * 2))
    tile.paste(image, (0, 0)); tile.paste(image.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (image.width, 0))
    tile.paste(tile.crop((0, 0, tile.width, image.height)).transpose(Image.Transpose.FLIP_TOP_BOTTOM), (0, image.height))
    out = Image.new('RGB', size)
    for y in range(0, size[1], tile.height):
        for x in range(0, size[0], tile.width):
            out.paste(tile, (x, y))
    return out



def render_board(cells, bbox=(75, 480, 703, 725), supersample=2, flip_y=True, materials=None, resolver=None, padding=24):
    """Return layered sculpted wood silhouette and individually reusable wells.

    Border follows every real target/obstacle edge including internal holes.
    Textures come from the final empty tray, not a flat color substitute. Each
    cell remains an independent asset instance; no puzzle state is baked here.
    """
    import cv2
    layout = fit_cells(cells, bbox, padding=padding,flip_y=flip_y)
    x, y, w, h = bbox
    size = (math.ceil(w), math.ceil(h))
    big_size = (size[0] * supersample, size[1] * supersample)
    mask = Image.new('L', big_size)
    draw = ImageDraw.Draw(mask)
    for cell in cells:
        cx, cy = layout.center(cell)
        draw.polygon([((px-x)*supersample, (py-y)*supersample)
                      for px, py in hex_vertices(cx, cy, layout.radius)], fill=255)
    binary = np.asarray(mask)
    inside = cv2.distanceTransform((binary > 0).astype(np.uint8), cv2.DIST_L2, 5)
    outside = cv2.distanceTransform((binary == 0).astype(np.uint8), cv2.DIST_L2, 5)
    distance = (inside - outside) / supersample
    distance /= min(1.,max(.25,layout.radius/60))
    floor_texture = _material(materials, 'hex_wood_floor', resolver).convert('RGB')
    rim_pixels=np.asarray(floor_texture,dtype=float)
    rim_texture=Image.fromarray(np.clip(rim_pixels*[.7,.78,.65]+[106,65,23],0,255).astype(np.uint8))
    well = _material(materials, 'hex_empty_well', resolver)
    rim_rgb = np.asarray(_mirror_texture(rim_texture, size).resize(big_size, Image.Resampling.BICUBIC), dtype=float)
    # A light ridge, dark outer drop, and inner bevel create actual depth while
    # retaining source wood grain at all positions of arbitrary contour.
    # Distinct original-style gold edge / wood fascia / dark inset. Narrow
    # transitions preserve crisp joinery instead of a broad orange glow.
    native=np.asarray(_material(materials, 'hex_rail_profile', resolver).convert('RGB'),dtype=float)
    # Direct native top-rail material cross-section: bright 2 px gold lip,
    # 9 px wood face, 5 px darker vertical side, then the inset shadow.
    rail=native.mean(axis=1)
    band=np.clip(np.rint(distance+18),0,len(rail)-1).astype(int)
    rgb=rail[band]
    grain=rim_rgb/np.maximum(rim_rgb.mean(axis=(0,1)),1)
    rgb*=np.clip(grain,.94,1.06)
    gy, gx = np.gradient(distance)
    rgb*=np.clip(1-.03*gx+.06*gy,.88,1.12)[...,None]
    alpha = ((distance >= -18) & (distance < 7)).astype(np.uint8) * 255
    rim_arr = np.dstack((np.clip(rgb, 0, 255).astype(np.uint8), alpha))
    rim_image = Image.fromarray(rim_arr).resize(size, Image.Resampling.LANCZOS)
    floor_image = _mirror_texture(floor_texture, size).convert('RGBA')
    inner = Image.fromarray(((distance >= 3)*255).astype(np.uint8)).resize(size, Image.Resampling.LANCZOS)
    floor_image.putalpha(inner)
    shadow_mask = Image.fromarray(((distance >= -18)*90).astype(np.uint8)).resize(size, Image.Resampling.LANCZOS)
    shadow_mask = ImageChops.offset(shadow_mask, 0, 5).filter(ImageFilter.GaussianBlur(1))
    shadow = Image.new('RGBA', size, (53, 29, 12, 0)); shadow.putalpha(shadow_mask)
    wells = []
    for cell in cells:
        tx, ty, tw, th = layout.tile_box(cell, .982)
        wells.append({'cell': list(cell), 'image': well.copy(), 'box': [tx, ty, tw, th]})
    return {'layout': layout, 'position': (x, y), 'shadow': shadow, 'floor': floor_image,
            'rim': rim_image, 'wells': wells,
            'source_textures': ['hex_wood_floor', 'hex_rail_profile', 'hex_empty_well']}



if __name__ == '__main__':
    import argparse
    parser=argparse.ArgumentParser(description='Rebuild one non-runtime hex layer from its serialized contract.')
    parser.add_argument('--spec',type=Path,required=True,help='A single metadata.procedural object as JSON')
    parser.add_argument('--output',type=Path,required=True,help='Editor/QA output, never export as per-level runtime PNG')
    parser.add_argument('--material-root',type=Path,help='Resolve material paths against package root; defaults to spec directory')
    args=parser.parse_args()
    spec=json.loads(args.spec.read_text(encoding='utf-8-sig'))
    def resolve(value):
        if isinstance(value,dict):value=value.get('file')or value.get('source_file')
        path=Path(value)
        return (args.material_root or args.spec.resolve().parent)/path if not path.is_absolute() else path
    result=render_component(spec,resolver=resolve)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    result.save(args.output)


