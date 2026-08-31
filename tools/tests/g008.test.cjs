const assert = require('node:assert/strict');
const { PageFlow, clampPage, levelButtonState, nextLevelIndex, pageCount, pageLevelIndices } = require('../../.omx/tmp/g005-tests/app/PageFlow.js');

assert.equal(pageCount(80), 4);
assert.equal(pageCount(0), 1);
assert.equal(clampPage(-2, 80), 0);
assert.equal(clampPage(99, 80), 3);
assert.deepEqual(pageLevelIndices(0, 80), Array.from({ length: 20 }, (_, index) => index));
assert.deepEqual(pageLevelIndices(3, 80), Array.from({ length: 20 }, (_, index) => index + 60));
assert.equal(levelButtonState(2, 3), 'completed');
assert.equal(levelButtonState(3, 3), 'available');
assert.equal(levelButtonState(4, 3), 'locked');
assert.equal(nextLevelIndex(78, 80), 79);
assert.equal(nextLevelIndex(79, 80), null);

const flow = new PageFlow();
assert.deepEqual(flow.current, { name: 'home' });
flow.push({ name: 'maps' });
flow.push({ name: 'levels', mapId: 'classic', page: 0 });
flow.replace({ name: 'levels', mapId: 'classic', page: 1 });
assert.equal(flow.depth, 3);
assert.deepEqual(flow.back(), { name: 'maps' });
assert.deepEqual(flow.back(), { name: 'home' });
for (let index = 0; index < 20; index += 1) {
  flow.push({ name: 'maps' });
  assert.deepEqual(flow.back(), { name: 'home' });
}
assert.equal(flow.depth, 1);
console.log('G008: pagination, level states, final-level behavior, and 20 navigation cycles validated.');
