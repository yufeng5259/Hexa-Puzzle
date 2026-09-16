interface LayoutBox { x: number; y: number; width: number; height: number }
export const TRAY_ART_HEIGHTS = [228, 258, 288] as const;
export interface GameplayLayout {
  height: number;
  headerScale: number;
  headerY: number;
  footerY: number;
  board: LayoutBox;
  tray: LayoutBox;
}

/** Centered game coordinates; the authored reference is 720 x 1560. */
export function gameplayLayout(visibleHeight: number): GameplayLayout {
  const height = Math.max(1280, Number.isFinite(visibleHeight) ? visibleHeight : 1280);
  const expansion = Math.min(1, (height - 1280) / 280);
  const headerScale = 0.9 + expansion * 0.1;
  const trayHeight = 228 + expansion * 60;
  const trayTop = height - 168 - trayHeight;
  const boardTop = 280 + expansion * 4;
  const available = trayTop - (100 + expansion * 40) - boardTop;
  const boardHeight = Math.min(680, available);
  return {
    height, headerScale,
    headerY: height / 2 - 780 * headerScale,
    footerY: -(height - 1560) / 2,
    board: { x: 0, y: height / 2 - boardTop - available / 2, width: 672, height: boardHeight },
    tray: { x: 0, y: height / 2 - trayTop - trayHeight / 2, width: 672, height: trayHeight },
  };
}
