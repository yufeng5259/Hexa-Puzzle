import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseFlax } from '../src/parse-flax.mjs';
import { validateFlax } from '../src/validate-flax.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/minimal-valid.json', import.meta.url), 'utf8'));

test('rejects atlas regions outside metadata bounds', () => {
  const invalid = structuredClone(fixture);
  invalid.frames.frame_0000.frame = '{{5,5},{10,10}}';
  assert.throws(() => validateFlax(parseFlax(invalid)), /ATLAS_REGION_OUT_OF_BOUNDS/);
});

test('rejects missing child references', () => {
  const invalid = structuredClone(fixture);
  invalid.mcs.root.children.child.class = 'missing';
  assert.throws(() => validateFlax(parseFlax(invalid)), /DISPLAY_REFERENCE_MISSING/);
});

test('rejects invalid display ranges', () => {
  const invalid = structuredClone(fixture);
  invalid.displays.image.end = 2;
  assert.throws(() => validateFlax(parseFlax(invalid)), /DISPLAY_RANGE_INVALID/);
});
