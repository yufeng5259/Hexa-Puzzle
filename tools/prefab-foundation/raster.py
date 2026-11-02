"""Rebuild individual layer derivatives; source art and text are never flattened."""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image, __version__ as pillow_version


def nine_slice(image, size, insets=None):
    width, height = map(int, size)
    sw, sh = image.size
    left, top, right, bottom = insets or (round(sw * .17), round(sh * .12), round(sw * .17), round(sh * .12))
    if min(left, top, right, bottom) < 0 or left + right >= sw or top + bottom >= sh:
        raise ValueError('Invalid nine-slice insets')
    scale = min(1., width / max(1, left + right), height / max(1, top + bottom))
    dl, dt, dr, db = [round(v * scale) for v in (left, top, right, bottom)]
    dr, db = min(dr, max(0, width - dl - 1)), min(db, max(0, height - dt - 1))
    xs, ys = [0, left, sw - right, sw], [0, top, sh - bottom, sh]
    xd, yd = [0, dl, width - dr, width], [0, dt, height - db, height]
    result = Image.new('RGBA', (width, height))
    for row in range(3):
        for col in range(3):
            target = (xd[col + 1] - xd[col], yd[row + 1] - yd[row])
            if min(target) <= 0:
                continue
            tile = image.crop((xs[col], ys[row], xs[col + 1], ys[row + 1]))
            if tile.size != target:
                tile = tile.resize(target, Image.Resampling.LANCZOS)
            result.alpha_composite(tile, (xd[col], yd[row]))
    return result


def transform(image, spec):
    image = image.convert('RGBA')
    if spec.get('source_crop'):
        image = image.crop(tuple(spec['source_crop']))
    if spec.get('resize') or spec.get('nine_slice'):
        size = tuple(spec.get('resize') or image.size)
        image = nine_slice(image, size, spec['nine_slice'].get('insets')) if spec.get('nine_slice') else image.resize(size, Image.Resampling.LANCZOS)
    if 'alpha_multiplier' in spec:
        alpha = spec['alpha_multiplier']
        if not 0 <= alpha <= 1:
            raise ValueError('Alpha outside 0..1')
        image.putalpha(image.getchannel('A').point(lambda value: round(value * alpha)))
    if spec.get('rotation_degrees'):
        image = image.rotate(spec['rotation_degrees'], Image.Resampling.BICUBIC, expand=True)
    if spec.get('alpha_crop'):
        image = image.crop(tuple(spec['alpha_crop']))
    return image


def main(job_file):
    batch = json.loads(Path(job_file).read_text('utf-8-sig'))
    report = []
    for job in batch['jobs']:
        source = Path(job['source'])
        if hashlib.sha256(source.read_bytes()).hexdigest() != job['sourceSha256']:
            raise ValueError('Source hash mismatch: ' + job['id'])
        with Image.open(source) as original:
            image = transform(original, job['transform'])
        destination = Path(job['destination'])
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, compress_level=9)
        report.append({'id': job['id'], 'size': list(image.size), 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(), 'rgbaSha256': hashlib.sha256(image.tobytes()).hexdigest(), 'pillowVersion': pillow_version})
    Path(batch['report']).write_text(json.dumps(report, indent=2) + '\n', 'utf-8')


if __name__ == '__main__':
    main(sys.argv[1])
