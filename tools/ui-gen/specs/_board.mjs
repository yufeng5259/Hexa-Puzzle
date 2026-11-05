import { prefabRef, slot } from '../lib/dsl.mjs';

/**
 * Hex board container: HexBoard draws the wood floor and rim once into Frame (Graphics) and lays out pooled
 * BoardCell / PieceCell instances under Cells / Pieces. Used by the puzzle, endless and preview boards.
 */
export const board = (rect, note) => slot('BoardRoot', rect, {
  script: 'game/features/board/HexBoard', bind: ['board', 'HexBoard'], note,
  props: { cellPrefab: prefabRef('BoardCell'), piecePrefab: prefabRef('PieceCell') },
  children: [
    slot('Frame', rect, { graphics: true, bind: 'frame' }),
    slot('Cells', rect, { bind: ['cells', 'Node'] }),
    slot('Pieces', rect, { bind: ['pieces', 'Node'] }),
  ],
});
