const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { BOARD_COORDS, gridToPoint2, point2ToGrid } = require('../../.omx/tmp/g005-tests/model/HexGrid.js');
const { isPointInFlatHexagon } = require('../../.omx/tmp/g005-tests/model/HexHitTest.js');
const { PuzzleModel } = require('../../.omx/tmp/g005-tests/model/PuzzleModel.js');

(async () => {
  assert.equal(isPointInFlatHexagon(0, 0, 115, 103), true);
  assert.equal(isPointInFlatHexagon(0, 51.5, 115, 103), true);
  assert.equal(isPointInFlatHexagon(57.5, 0, 115, 103), true);
  assert.equal(isPointInFlatHexagon(28.75, 51.5, 115, 103), true);
  assert.equal(isPointInFlatHexagon(57.5, 51.5, 115, 103), false);
  assert.equal(isPointInFlatHexagon(40, 40, 115, 103), false);
  assert.equal(isPointInFlatHexagon(0, 0, 0, 103), false);
  for (const coord of BOARD_COORDS) assert.deepEqual(point2ToGrid(gridToPoint2(coord)), coord);
  const root = path.resolve(__dirname, '../..');
  let levels = 0;
  for (const mapId of ['classic', 'novice']) {
    const source = JSON.parse(await readFile(path.join(root, `assets/resources/data/levels/${mapId}.json`), 'utf8'));
    for (const level of source) {
      const model = new PuzzleModel(level);
      for (const piece of model.pieces) {
        const preview = model.findPlacement(piece.id, piece.targetCells[0]);
        assert.ok(preview?.valid, `${mapId} level ${levels}: ${piece.id}`);
        assert.equal(preview.correctlyMatched, true);
        assert.equal(model.place(piece.id, preview), true);
      }
      assert.equal(model.isWon, true, `${mapId} level ${levels} should win`);
      model.reset();
      assert.equal(model.isWon, false);
      assert.equal(Object.keys(model.snapshot().occupied).length, 0);
      levels += 1;
    }
  }
  const synthetic = [[
    { tx: 0, ty: 0, data: [{ x: 0, y: 0, tx: 0, ty: 0 }], texureName: '1_png', x: 0, y: 0, type: 'edit_game_elements' },
    { tx: 1, ty: 0, data: [{ x: 0, y: 0, tx: 1, ty: 0 }], texureName: '2_png', x: 0, y: 0, type: 'edit_game_elements' },
  ]][0];
  const model = new PuzzleModel(synthetic);
  const first = model.pieces[0];
  const wrong = model.previewPlacement(first.id, { tx: 1, ty: 0 });
  assert.equal(wrong.valid, true);
  assert.equal(wrong.correctlyMatched, false);
  assert.equal(model.place(first.id, wrong), true);
  assert.equal(model.nextHint().textureName, '2_png');
  assert.equal(model.beginMove(first.id), true);
  assert.equal(Object.keys(model.snapshot().occupied).length, 0);
  const correct = model.previewPlacement(first.id, { tx: 0, ty: 0 });
  assert.equal(model.place(first.id, correct), true);
  const conflict = model.previewPlacement(model.pieces[1].id, { tx: 0, ty: 0 });
  assert.equal(conflict.failure, 'occupied');
  console.log(`G006: grid, placement, occupancy, hints, reset, and original solutions validated for ${levels} levels.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
