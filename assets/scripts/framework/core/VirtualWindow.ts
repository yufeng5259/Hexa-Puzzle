export interface ListWindow { first: number; end: number; offset: number; extent: number }

/** Fixed-extent one-axis list math, independent of engine nodes and rendering. */
export function listWindow(count: number, itemExtent: number, spacing: number, viewport: number, offset: number, buffer: number): ListWindow {
    if (!Number.isSafeInteger(count) || count < 0 || !Number.isFinite(itemExtent) || itemExtent <= 0
        || !Number.isFinite(spacing) || spacing < 0 || !Number.isFinite(viewport) || viewport < 0
        || !Number.isFinite(offset) || !Number.isSafeInteger(buffer) || buffer < 0) {
        throw new Error('Invalid virtual list dimensions');
    }
    const stride = itemExtent + spacing;
    const extent = Math.max(0, count * stride - spacing);
    const clamped = Math.max(0, Math.min(offset, Math.max(0, extent - viewport)));
    if (!count) return { first: 0, end: 0, offset: 0, extent: 0 };
    return {
        first: Math.max(0, Math.floor(clamped / stride) - buffer),
        end: Math.min(count, Math.ceil((clamped + viewport) / stride) + buffer),
        offset: clamped, extent,
    };
}
