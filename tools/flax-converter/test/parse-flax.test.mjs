import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseFlax } from '../src/parse-flax.mjs';
import { validateFlax } from '../src/validate-flax.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/minimal-valid.json', import.meta.url), 'utf8'));

test('normalizes a valid Flax document', () => {
  const document = validateFlax(parseFlax(fixture));
  assert.equal(document.atlasFrames.length, 1);
  assert.deepEqual(document.displays[0].frameIds, ['frame_0000']);
  assert.equal(document.movieClips[0].children[0].displayId, 'image');
});

test('rejects unsafe external paths', () => {
  const invalid = structuredClone(fixture);
  invalid.displays.image = { anchorX: 0, anchorY: 1, type: 'png', url: '../escape.png' };
  assert.throws(() => parseFlax(invalid), /EXTERNAL_PATH_UNSAFE/);
});
