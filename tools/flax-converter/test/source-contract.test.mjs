import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseFlax } from '../src/parse-flax.mjs';
import { summarizeFlax } from '../src/summarize-flax.mjs';
import { validateFlax } from '../src/validate-flax.mjs';

const sourcePath = process.env.FLAX_GAME_JSON;
test('matches the real game.json contract', { skip: !sourcePath }, async () => {
  const document = validateFlax(parseFlax(JSON.parse(await readFile(sourcePath, 'utf8'))));
  assert.deepEqual(summarizeFlax(document), {
    atlas: 'game.png (1766x1486)',
    frames: 42,
    displays: 45,
    atlasDisplays: 42,
    externalImages: 3,
    movieClips: 15,
    children: 79,
    textChildren: 14,
  });
  assert.equal(document.atlasFrames[0].id, 'game_0000');
  assert.equal(document.atlasFrames.at(-1).id, 'game_0041');
  const music = document.movieClips.find((item) => item.id === 'music');
  assert.deepEqual(music.children.map((child) => child.states.map(Boolean)), [[true, false], [false, true]]);
  const item = document.movieClips.find((movieClip) => movieClip.id === 'itemrender2');
  assert.equal(item.totalFrames, 3);
  assert.deepEqual(item.children.find((child) => child.instanceName === 'txt').states.map(Boolean), [true, true, true]);
});
