"""Harmonic color correction for a generated frame around a locked RGB image.

The source image defines Dirichlet values on the inner boundary and the existing
generated image defines the outer boundary. Only the generated frame changes.
No source pixels, texture coordinates, masks or existing files are modified.
"""
from time import perf_counter

import cv2
import numpy as np


_AVERAGE_NEIGHBORS = np.array(
    [[0, .25, 0], [.25, 0, .25], [0, .25, 0]], dtype=np.float32
)


def harmonic_border(generated_rgb, original_rgb, offset):
    """Return uint8 RGB with an exact original rectangle and blended exterior.

    Multiresolution weighted Jacobi solves Laplace(delta)=0 in the frame. Delta
    is fixed to original-minus-generated in the protected rectangle and to zero
    on the canvas edge. Thus generated gradients continue outward without the
    long repeated color streaks of nearest-boundary extrapolation.
    """
    generated = np.asarray(generated_rgb)
    original = np.asarray(original_rgb)
    if generated.ndim != 3 or original.ndim != 3:
        raise ValueError('Both inputs must be RGB arrays')
    if generated.shape[2] != 3 or original.shape[2] != 3:
        raise ValueError('Both inputs must have exactly three channels')
    height, width = generated.shape[:2]
    oh, ow = original.shape[:2]
    ox, oy = map(int, offset)
    if not (0 < ox and 0 < oy and ox + ow < width and oy + oh < height):
        raise ValueError('The protected rectangle must leave an exterior frame')
    generated = np.clip(generated, 0, 255).astype(np.uint8)
    original = np.clip(original, 0, 255).astype(np.uint8)
    prescribed = original.astype(np.float32) - generated[oy:oy+oh, ox:ox+ow].astype(np.float32)

    # Start with a small, inexpensive domain so long-wavelength color offsets
    # settle before finer grids introduce the precise boundary details.
    sizes = [(width, height)]
    while max(sizes[-1]) > 72:
        w, h = sizes[-1]
        sizes.append((max(4, (w+1)//2), max(4, (h+1)//2)))
    sizes.reverse()
    delta = None
    for level, (w, h) in enumerate(sizes):
        if w == width and h == height:
            x0, y0, x1, y1 = ox, oy, ox+ow, oy+oh
            fixed = prescribed
        else:
            x0 = max(1, round(ox*w/width))
            y0 = max(1, round(oy*h/height))
            x1 = min(w-1, max(x0+1, round((ox+ow)*w/width)))
            y1 = min(h-1, max(y0+1, round((oy+oh)*h/height)))
            fixed = cv2.resize(prescribed, (x1-x0, y1-y0), interpolation=cv2.INTER_AREA)
        delta = (np.zeros((h, w, 3), dtype=np.float32) if delta is None else
                 cv2.resize(delta, (w, h), interpolation=cv2.INTER_LINEAR))
        delta[y0:y1, x0:x1] = fixed
        delta[0] = delta[-1] = 0
        delta[:, 0] = delta[:, -1] = 0
        iterations = 420 if level == 0 else max(64, 240 // level)
        for _ in range(iterations):
            average = cv2.filter2D(delta, -1, _AVERAGE_NEIGHBORS,
                                   borderType=cv2.BORDER_CONSTANT)
            # Weighted Jacobi damps the checkerboard mode of the four-neighbor
            # stencil without imposing a blur on protected source pixels.
            cv2.addWeighted(average, .8, delta, .2, 0, dst=average)
            average[y0:y1, x0:x1] = fixed
            average[0] = average[-1] = 0
            average[:, 0] = average[:, -1] = 0
            delta = average

    result = np.rint(np.clip(generated.astype(np.float32)+delta, 0, 255)).astype(np.uint8)
    result[oy:oy+oh, ox:ox+ow] = original
    return result


def _self_test():
    generated = np.full((160, 120, 3), (74, 111, 145), dtype=np.uint8)
    original = np.full((100, 70, 3), (134, 141, 165), dtype=np.uint8)
    offset = (25, 30)
    start = perf_counter()
    result = harmonic_border(generated, original, offset)
    assert np.array_equal(result[30:130, 25:95], original)
    assert np.array_equal(result[0], generated[0])
    assert np.array_equal(result[-1], generated[-1])
    assert np.array_equal(result[:, 0], generated[:, 0])
    assert np.array_equal(result[:, -1], generated[:, -1])
    before = np.abs(original[:, 0].astype(int)-generated[30:130, 24].astype(int)).max()
    after = np.abs(original[:, 0].astype(int)-result[30:130, 24].astype(int)).max()
    assert after <= 8 and after < before, (before, after)
    # A localized boundary feature must spread and decay rather than being
    # repeated as a solid bar all the way out to the generated canvas edge.
    patterned = original.copy()
    patterned[43:57, :, 0] = 174
    patterned_result = harmonic_border(generated, patterned, offset)
    assert np.array_equal(patterned_result[30:130, 25:95], patterned)
    near = abs(int(patterned_result[80, 23, 0])-int(result[80, 23, 0]))
    far = abs(int(patterned_result[80, 5, 0])-int(result[80, 5, 0]))
    assert near > far and far < 8, (near, far)
    print({'result': 'PASS', 'boundaryStepBefore': int(before),
           'boundaryStepAfter': int(after), 'featureNear': near,
           'featureFar': far, 'seconds': round(perf_counter()-start, 3)})


if __name__ == '__main__':
    _self_test()
