export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const integer = Math.max(0, Math.floor(value));
  if (integer < 100000) return String(integer);
  if (integer < 1000000) return `${Math.floor(integer / 1000)}K`;
  if (integer < 100000000) return `${Math.floor(integer / 1000000)}M`;
  return '99M+';
}
