"""Align the generated stream with the actual B34 arch, retaining the art's pixels/materials.

Only the new M07 background is edited. Monotone local horizontal remapping moves
the narrow stream about 120px left below the bridge opening, with smooth vertical
taper back into the generated channel. No building, template, or old map changes.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image
from scipy.interpolate import PchipInterpolator
from scipy.ndimage import map_coordinates

ROOT = Path(__file__).resolve().parent
source = ROOT / 'rejected/background_ext_before_local_alignment.png'
image = np.asarray(Image.open(source).convert('RGB'))
assert image.shape == (2040, 1120, 3)
yy, xx = np.indices(image.shape[:2], dtype=np.float64)
xmap = xx.copy()
for row in range(2040):
    distance = abs(row - (1310 + 99))
    if distance >= 210:
        continue
    shift = 120 * np.cos(distance / 210 * np.pi / 2) ** 2
    destination = np.array([0, 533, 728, 1119], dtype=float)
    origin = destination.copy()
    origin[2] += shift
    curve = PchipInterpolator(destination, origin)
    xmap[row] = curve(xx[row])
    assert np.all(np.diff(xmap[row]) > 0), 'No folded or duplicated strip'
result = np.stack([map_coordinates(image[:, :, channel], [yy, xmap], order=1,
                                  mode='nearest') for channel in range(3)], axis=2)
target = ROOT / 'raw/background.png'
Image.fromarray(result.astype(np.uint8), 'RGB').save(target)
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
record = dict(method='local monotone stream alignment, not a new AI generation',
              source=source.relative_to(ROOT).as_posix(), sourceSHA256=digest(source),
              output='raw/background.png', outputSHA256=digest(target),
              originalViewShiftPx=120, originalViewArchCenter=[595, 1310],
              verticalTaperHalfHeightPx=210,
              note='Move water through the arch; leave both stone feet on the banks. '
                   'Final background and extension are cropped from this same corrected image.')
(ROOT / 'stream_alignment.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
jobs = ROOT / 'jobs.json'
data = json.loads(jobs.read_text(encoding='utf-8'))
if isinstance(data, dict):
    data['localStreamAlignment'] = record
else:
    data = [job for job in data if job.get('id') != 'M07-stream-alignment']
    for job in data:
        if job.get('kind') == 'background':
            job['final_deliverable_source'] = record
    data.append(dict(id='M07-stream-alignment', **record))
jobs.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('M07: stream aligned to actual bridge arch; 1120x2040 source saved')
