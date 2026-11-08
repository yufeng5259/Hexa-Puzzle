export interface GuidePoint { x: number; y: number }
export type GuidePolygon = readonly GuidePoint[];
/** Includes polygon edges so a touch on the rendered cell border remains valid. */
export function pointInPolygon(polygon: GuidePolygon, point: GuidePoint): boolean {
    if (polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[j], b = polygon[i];
        const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
        if (Math.abs(cross) < .0001 && point.x >= Math.min(a.x,b.x)-.0001 && point.x <= Math.max(a.x,b.x)+.0001 && point.y >= Math.min(a.y,b.y)-.0001 && point.y <= Math.max(a.y,b.y)+.0001) return true;
        if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) inside = !inside;
    }
    return inside;
}
export interface GuideRegion { x: number; y: number; width: number; height: number; radius?: number; shape: 'rect' | 'roundRect' | 'circle' }
export function contains(region: GuideRegion, point: GuidePoint): boolean {
    const x = Math.abs(point.x - region.x), y = Math.abs(point.y - region.y);
    if (region.shape === 'circle') return x * x + y * y <= (region.radius ?? Math.max(region.width, region.height) / 2) ** 2;
    if (x > region.width / 2 || y > region.height / 2) return false;
    if (region.shape === 'rect') return true;
    const r = Math.min(region.radius ?? 20, region.width / 2, region.height / 2);
    const dx = Math.max(0, x - region.width / 2 + r), dy = Math.max(0, y - region.height / 2 + r);
    return dx * dx + dy * dy <= r * r;
}
/** Captures an allowed pointer for its whole gesture, including travel over dim areas. */
export class GuideInput {
    public enabled = false;
    public regions: GuideRegion[] = [];
    public sourcePolygons: readonly GuidePolygon[] | null = null;
    public action: 'click' | 'drag' | 'wait' | 'continue' = 'wait';
    private pointer: number | null = null;
    public canStart(point: GuidePoint): boolean {
        if (!this.enabled) return true;
        if (this.action === 'wait') return false;
        if (this.action === 'drag' && this.sourcePolygons) return this.sourcePolygons.some(polygon => pointInPolygon(polygon, point));
        return this.regions.some(region => contains(region, point));
    }
    public accepts(phase: 'start' | 'move' | 'end' | 'cancel', id: number, point: GuidePoint): boolean {
        if (!this.enabled) return true;
        if (phase === 'start') {
            if (this.pointer !== null && this.pointer !== id) return false;
            if (!this.canStart(point)) return false;
            this.pointer = id;
            return true;
        }
        if (this.pointer !== id) return false;
        if (phase === 'end' || phase === 'cancel') this.pointer = null;
        return true;
    }
    public reset(): void { this.enabled = false; this.regions = []; this.sourcePolygons = null; this.pointer = null; }
}
