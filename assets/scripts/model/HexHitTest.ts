export function isPointInFlatHexagon(x: number, y: number, width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  const normalizedX = Math.abs(x) / (width / 2);
  const normalizedY = Math.abs(y) / (height / 2);
  return normalizedX <= 1 && normalizedY <= 1 && normalizedX * 2 + normalizedY <= 2;
}
