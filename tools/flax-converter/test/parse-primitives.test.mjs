import assert from 'node:assert/strict';
import test from 'node:test';
import { expandFrameStates, parseAtlasRect, parseFrameState, parseMovieClipRect, parsePair } from '../src/parse-primitives.mjs';

test('parses supported geometry formats', () => {
  assert.deepEqual(parsePair('{ -1.5, 2 }', 'pair'), { x: -1.5, y: 2 });
  assert.deepEqual(parseAtlasRect('{{1,2},{3,4}}', 'rect'), { x: 1, y: 2, width: 3, height: 4 });
  assert.deepEqual(parseMovieClipRect('0,0,100.5,200', 'mc'), { x: 0, y: 0, width: 100.5, height: 200 });
});

test('parses display and text states', () => {
  assert.equal(parseFrameState('1,2,3,1,1,0.5,4,0,0', 'state', false).alpha, 0.5);
  const text = parseFrameState('1,2,0,1,1,1,0,0,0,Arial Bold,20,#ffffff,center,40,30', 'text', true);
  assert.equal(text.fontFamily, 'Arial Bold');
  assert.equal(text.color, '#FFFFFF');
});

test('distinguishes null from inherited empty slots', () => {
  const states = expandFrameStates('1,2,0,1,1,1,0,0,0||null', 3, 'frames', false);
  assert.equal(states[1], states[0]);
  assert.equal(states[2], null);
});

test('rejects malformed geometry and slot counts', () => {
  assert.throws(() => parseAtlasRect('{1,2,3,4}', 'rect'), /GEOMETRY_INVALID/);
  assert.throws(() => expandFrameStates('null|null', 3, 'frames', false), /FRAME_SLOT_COUNT_MISMATCH/);
});
