import { _decorator, CCString, Color, Component, Graphics, Mask, Sprite, UITransform } from 'cc';
const { ccclass, property, executionOrder } = _decorator;
type Point = [number, number];
type Box = [number, number, number, number];
interface HexLayout { radius: number; offset: Point; centers: { cell: Point; center: Point }[] }
export interface SourceHexSpec {
    renderer: string;
    role: string;
    cells?: Point[];
    bbox?: Box;
    size?: Point;
    padding?: number;
    flip_y?: boolean;
    outline_cells?: Point[];
    layout?: HexLayout;
    width?: number;
    color?: number[];
}
interface Envelope { renderer?: string; spec: SourceHexSpec; crop?: Box }
const ROOT3 = Math.sqrt(3);
const CORNERS: Point[] = [[2, 0], [1, 1], [-1, 1], [-2, 0], [-1, -1], [1, -1]];
const pointKey = (p: Point): string => p.join(',');

/** Matches the source block_hex_runtime layout: bbox is x/y/width/height, crop is left/top/right/bottom. */
export function fitSourceHex(cells: Point[], box: Box, padding = 24, flip = true): HexLayout {
    if (!cells.length || cells.some(c => c.length !== 2 || !c.every(Number.isSafeInteger))
        || new Set(cells.map(pointKey)).size !== cells.length) throw new Error('SourceGeometry requires unique integer axial cells');
    const points: Point[] = cells.map(([q, r]) => [q * 1.5, ROOT3 * (r + q / 2) * (flip ? -1 : 1)]);
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const left = Math.min(...xs) - 1, top = Math.min(...ys) - ROOT3 / 2;
    const width = Math.max(...xs) + 1 - left, height = Math.max(...ys) + ROOT3 / 2 - top;
    const radius = Math.min((box[2] - 2 * padding) / width, (box[3] - 2 * padding) / height);
    if (!(radius > 0) || !Number.isFinite(radius)) throw new Error('SourceGeometry bounds are smaller than padding');
    const offset: Point = [box[0] + (box[2] - width * radius) / 2 - left * radius,
        box[1] + (box[3] - height * radius) / 2 - top * radius];
    return { radius, offset, centers: cells.map((cell, i) => ({ cell, center: [offset[0] + points[i][0] * radius, offset[1] + points[i][1] * radius] })) };
}

/** Integer edge identity cancels shared edges exactly, including holes and disconnected shapes. */
export function sourceBoundary(cells: Point[]): Point[][] {
    const edges = new Map<string, [Point, Point]>();
    for (const [q, r] of cells) {
        const vertices = CORNERS.map(([x, y]) => [3 * q + x, 2 * r + q + y] as Point);
        vertices.forEach((a, i) => {
            const b = vertices[(i + 1) % 6], key = [pointKey(a), pointKey(b)].sort().join('|');
            if (edges.has(key)) edges.delete(key); else edges.set(key, [a, b]);
        });
    }
    return [...edges.values()];
}

function loops(edges: Point[][]): Point[][] {
    const outgoing = new Map<string, Point>();
    edges.forEach(([a, b]) => outgoing.set(pointKey(a), b));
    const result: Point[][] = [];
    while (outgoing.size) {
        const first = outgoing.keys().next().value as string, ring: Point[] = [];
        let key = first;
        do {
            const next = outgoing.get(key);
            if (!next) throw new Error('SourceGeometry boundary is not closed');
            ring.push(key.split(',').map(Number) as Point); outgoing.delete(key); key = pointKey(next);
        } while (key !== first);
        result.push(ring);
    }
    return result;
}

/** Clip filled cells to the original exported crop, without stretching their fit to that crop. */
function clip(points: Point[], width: number, height: number): Point[] {
    let output = points;
    for (const [axis, bound, sign] of [[0, -width / 2, 1], [0, width / 2, -1], [1, -height / 2, 1], [1, height / 2, -1]]) {
        const input = output; output = [];
        for (let i = 0; i < input.length; i++) {
            const a = input[i], b = input[(i + 1) % input.length];
            const insideA = (a[axis] - bound) * sign >= 0, insideB = (b[axis] - bound) * sign >= 0;
            if (insideA) output.push(a);
            if (insideA !== insideB) {
                const t = (bound - a[axis]) / (b[axis] - a[axis]);
                output.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
            }
        }
    }
    return output;
}

export function buildSourceGeometry(input: Envelope | SourceHexSpec, width: number, height: number) {
    const envelope = input as Envelope, spec = envelope.spec || input as SourceHexSpec;
    if (spec.renderer !== 'block.hex.v1' || ['floor', 'rim', 'shadow', 'obstacle', 'well', 'outline', 'selection'].indexOf(spec.role) < 0)
        throw new Error('SourceGeometry does not support this renderer/role');
    const board = ['obstacle', 'well', 'selection'].indexOf(spec.role) < 0;
    const size = board ? spec.bbox?.slice(2) : spec.size;
    if (!size || size.length !== 2 || ![...size, width, height].every(n => Number.isFinite(n) && n > 0))
        throw new Error('SourceGeometry requires positive canvas and node dimensions');
    const crop: Box = envelope.crop || [0, 0, Math.ceil(size[0]), Math.ceil(size[1])];
    if (crop.length !== 4 || !crop.every(Number.isFinite) || crop[2] <= crop[0] || crop[3] <= crop[1]) throw new Error('Invalid SourceGeometry crop');
    const sx = width / (crop[2] - crop[0]), sy = height / (crop[3] - crop[1]);
    const project = ([x, y]: Point): Point => [(x - crop[0]) * sx - width / 2, height / 2 - (y - crop[1]) * sy];
    let radius = Math.min(size[0] / 2, size[1] / ROOT3), cellPolygons: Point[][] = [], boundaries: Point[][] = [];
    let outlinePolygons: Point[][] = [];
    if (board) {
        const box = spec.bbox!, cells = spec.cells || [];
        const fitted = spec.role === 'outline' && spec.layout ? spec.layout : fitSourceHex(cells, box, spec.padding ?? 24, spec.flip_y !== false);
        radius = fitted.radius;
        const polygon = (center: Point, factor = 1): Point[] => CORNERS.map(([x, y]) => project([
            center[0] - box[0] + x * radius * factor / 2,
            center[1] - box[1] + y * radius * factor * ROOT3 / 2]));
        cellPolygons = fitted.centers.map(entry => clip(polygon(entry.center), width, height));
        const fit = fitSourceHex(cells, box, spec.padding ?? 24, spec.flip_y !== false);
        boundaries = loops(sourceBoundary(cells)).map(ring => ring.map(([x, y]) => project([
            fit.offset[0] - box[0] + x * fit.radius / 2,
            fit.offset[1] - box[1] + y * fit.radius * ROOT3 / 2 * (spec.flip_y === false ? 1 : -1)])));
        const wanted = new Set((spec.outline_cells || cells).map(pointKey));
        outlinePolygons = fitted.centers.filter(entry => wanted.has(pointKey(entry.cell))).map(entry => polygon(entry.center, .95));
    } else if (spec.role !== 'selection') {
        cellPolygons = [clip(CORNERS.map(([x, y]) => project([size[0] / 2 + x * size[0] / 4, size[1] / 2 + y * size[1] / 2])), width, height)];
    }
    return { spec, crop, size, project, radius, scale: Math.min(sx, sy), cellPolygons, boundaries, outlinePolygons };
}

/** Serialized presentation only: no node creation, resource loading, rules or input handling. */
@ccclass('SourceGeometry')
@executionOrder(120) // Mask initializes its already-serialized Graphics at execution order 110.
export class SourceGeometry extends Component {
    @property(Graphics) public graphics: Graphics | null = null;
    @property(Mask) public mask: Mask | null = null;
    @property(Sprite) public texture: Sprite | null = null;
    @property(CCString) public spec = '';
    public onLoad(): void { this.render(); }
    public onEnable(): void { this.render(); }
    public render(): void {
        const g = this.graphics, ui = this.node.getComponent(UITransform);
        if (!g || !ui || g.node !== this.node) throw new Error('SourceGeometry requires its serialized root Graphics and UITransform');
        const shape = buildSourceGeometry(JSON.parse(this.spec), ui.width, ui.height), { spec, scale } = shape;
        g.clear();
        const path = (points: Point[]): void => {
            if (points.length < 3) return;
            g.moveTo(points[0][0], points[0][1]); points.slice(1).forEach(p => g.lineTo(p[0], p[1])); g.close();
        };
        const fill = (polygons: Point[][], color: Color): void => {
            g.fillColor = color; polygons.forEach(points => { if (points.length >= 3) { path(points); g.fill(); } });
        };
        const stroke = (polygons: Point[][], width: number, color: Color): void => {
            g.lineWidth = width * scale; g.strokeColor = color; g.lineJoin = Graphics.LineJoin.ROUND;
            polygons.forEach(points => { path(points); g.stroke(); });
        };
        if (this.texture) {
            const textureUI = this.texture.node.getComponent(UITransform);
            if (!textureUI || this.texture.node.parent !== this.node) throw new Error('SourceGeometry texture must be a bound child with UITransform');
            const cw = shape.crop[2] - shape.crop[0], ch = shape.crop[3] - shape.crop[1];
            textureUI.setContentSize(shape.size[0] * ui.width / cw, shape.size[1] * ui.height / ch);
            const center = shape.project([shape.size[0] / 2, shape.size[1] / 2]); this.texture.node.setPosition(center[0], center[1]);
            this.texture.sizeMode = Sprite.SizeMode.CUSTOM;
            this.texture.type = spec.role === 'floor' ? Sprite.Type.TILED : Sprite.Type.SIMPLE;
            this.texture.grayscale = spec.role === 'obstacle';
        }
        if (spec.role === 'floor') {
            if (this.texture && (!this.mask || this.mask.node !== this.node || this.mask.type !== Mask.Type.GRAPHICS_STENCIL))
                throw new Error('Textured SourceGeometry floor requires its serialized GRAPHICS_STENCIL Mask');
            // Match Mask._createGraphics: invisible color still writes the stencil.
            fill(shape.cellPolygons, this.mask ? new Color(255, 255, 255, 0) : new Color(183, 122, 52));
        } else if (spec.role === 'obstacle' || spec.role === 'well') {
            if (this.mask) fill(shape.cellPolygons, new Color(255, 255, 255, 0));
            else if (!this.texture) fill(shape.cellPolygons, new Color(112, 108, 98));
        } else if (spec.role === 'shadow') {
            // Original role already contains its five-pixel downshift; keep it in source units.
            const dy = 5 * ui.height / (shape.crop[3] - shape.crop[1]);
            const moved = shape.boundaries.map(ring => ring.map(([x, y]) => [x, y - dy] as Point));
            fill(shape.cellPolygons.map(ring => ring.map(([x, y]) => [x, y - dy] as Point)), new Color(53, 29, 12, 90));
            stroke(moved, 36 * Math.min(1, Math.max(.25, shape.radius / 60)), new Color(53, 29, 12, 90));
        } else if (spec.role === 'rim') {
            const k = Math.min(1, Math.max(.25, shape.radius / 60));
            stroke(shape.boundaries, 36 * k, new Color(104, 55, 20));
            stroke(shape.boundaries, 27 * k, new Color(185, 113, 42));
            stroke(shape.boundaries, 12 * k, new Color(237, 177, 85));
        } else if (spec.role === 'outline') {
            const width = spec.width || 5, c = spec.color || [255, 228, 105, 255];
            stroke(shape.outlinePolygons, width + 6, new Color(107, 52, 12, 245));
            stroke(shape.outlinePolygons, width + 3, new Color(242, 159, 29));
            stroke(shape.outlinePolygons, width, new Color(c[0], c[1], c[2], c[3] ?? 255));
        } else {
            g.strokeColor = new Color(255, 226, 125); g.lineWidth = 4 * scale;
            const a = shape.project([4, 4]), b = shape.project([shape.size[0] - 4, shape.size[1] - 4]);
            g.roundRect(a[0], b[1], b[0] - a[0], a[1] - b[1], 17 * scale); g.stroke();
        }
    }
}
