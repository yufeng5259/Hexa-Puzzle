/**
 * Pure sampling of migrated effect data (tools/v2/import-build-fx.mjs): Creator 2.x clip
 * tracks and Spine 3.6 skeleton timelines, evaluated to flat 2D transforms. No 'cc'.
 */
export type Key = number[];
export interface Transform2D { x: number; y: number; angle: number; scaleX: number; scaleY: number }
export interface SlotPose extends Transform2D { slot: string; attachment: string | null; asset: string | null; width: number; height: number; color: [number, number, number, number] }

interface Bone { name: string; parent: string | null; x: number; y: number; rotation: number; scaleX: number; scaleY: number }
interface Slot { name: string; bone: string; attachment: string | null; color: string }
interface Attachment { asset: string; x: number; y: number; rotation: number; scaleX: number; scaleY: number; width: number; height: number }
type Curve = 'stepped' | [number, number, number, number] | undefined;
interface Frame { time: number; curve?: Curve; [k: string]: unknown }
export interface SkeletonData {
    offset: [number, number]; scale: [number, number]; timeScale: number;
    bones: Bone[]; slots: Slot[]; attachments: Record<string, Record<string, Attachment>>;
    animation: { bones?: Record<string, Record<string, Frame[]>>; slots?: Record<string, Record<string, Frame[]>> };
}

/** 2.x clip track: [time, ...values]; linear, held before the first and after the last key. */
export function sampleTrack(keys: readonly Key[], t: number): number[] {
    if (t <= keys[0][0]) return keys[0].slice(1);
    const last = keys[keys.length - 1];
    if (t >= last[0]) return last.slice(1);
    let i = 1;
    while (keys[i][0] < t) i++;
    const a = keys[i - 1], b = keys[i], k = (t - a[0]) / (b[0] - a[0]);
    return a.slice(1).map((v, j) => v + (b[j + 1] - v) * k);
}

/** Spine bezier: curve x is time, y is progress. Solved by bisection on the curve parameter. */
export function bezier(curve: Curve, x: number): number {
    if (curve === 'stepped') return 0;
    if (!curve) return x;
    const [cx1, cy1, cx2, cy2] = curve;
    const at = (p: number, c1: number, c2: number) => 3 * (1 - p) * (1 - p) * p * c1 + 3 * (1 - p) * p * p * c2 + p * p * p;
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (at(mid, cx1, cx2) < x) lo = mid; else hi = mid; }
    return at((lo + hi) / 2, cy1, cy2);
}

/** Interval containing t and its eased progress; null before the first frame (setup pose applies). */
function interval(frames: Frame[], t: number): { a: Frame; b: Frame; p: number } | null {
    if (!frames.length || t < frames[0].time) return null;
    const last = frames[frames.length - 1];
    if (t >= last.time) return { a: last, b: last, p: 0 };
    let i = 1;
    while (frames[i].time <= t) i++;
    const a = frames[i - 1], b = frames[i];
    return { a, b, p: bezier(a.curve, (t - a.time) / (b.time - a.time)) };
}
const num = (f: Frame, k: string, d: number) => typeof f[k] === 'number' ? f[k] as number : d;
const wrap = (deg: number) => deg - Math.round(deg / 360) * 360;
export function hexColor(hex: string): [number, number, number, number] {
    return [0, 2, 4, 6].map(i => parseInt((hex + 'ff').slice(i, i + 2), 16) / 255) as [number, number, number, number];
}

type Matrix = { a: number; b: number; c: number; d: number; x: number; y: number };
function local(x: number, y: number, rotation: number, sx: number, sy: number): Matrix {
    const r = rotation * Math.PI / 180, cos = Math.cos(r), sin = Math.sin(r);
    return { a: cos * sx, b: -sin * sy, c: sin * sx, d: cos * sy, x, y };
}
function mul(p: Matrix, m: Matrix): Matrix {
    return { a: p.a * m.a + p.b * m.c, b: p.a * m.b + p.b * m.d, c: p.c * m.a + p.d * m.c, d: p.c * m.b + p.d * m.d, x: p.a * m.x + p.b * m.y + p.x, y: p.c * m.x + p.d * m.y + p.y };
}
function decompose(m: Matrix): Transform2D {
    const scaleX = Math.hypot(m.a, m.c);
    return { x: m.x, y: m.y, angle: Math.atan2(m.c, m.a) * 180 / Math.PI, scaleX, scaleY: scaleX ? (m.a * m.d - m.b * m.c) / scaleX : 0 };
}

/** Animation length in skeleton time (before timeScale). */
export function skeletonLength(data: SkeletonData): number {
    let end = 0;
    for (const group of [data.animation.bones ?? {}, data.animation.slots ?? {}]) for (const timelines of Object.values(group)) for (const frames of Object.values(timelines)) end = Math.max(end, frames[frames.length - 1]?.time ?? 0);
    return end;
}

/**
 * Pose of every slot at real time t (timeScale applied), in the skeleton node's space
 * (offset and scale of the original node included). Draw order = slot order.
 */
export function sampleSkeleton(data: SkeletonData, t: number): SlotPose[] {
    const time = t * data.timeScale, world = new Map<string, Matrix>();
    const root = local(data.offset[0], data.offset[1], 0, data.scale[0], data.scale[1]);
    for (const bone of data.bones) {
        const tl = data.animation.bones?.[bone.name] ?? {};
        let { x, y, rotation, scaleX, scaleY } = bone;
        const rot = tl.rotate && interval(tl.rotate, time);
        if (rot) { const r0 = num(rot.a, 'angle', 0); rotation += r0 + wrap(num(rot.b, 'angle', 0) - r0) * rot.p; }
        const tr = tl.translate && interval(tl.translate, time);
        if (tr) { x += num(tr.a, 'x', 0) + (num(tr.b, 'x', 0) - num(tr.a, 'x', 0)) * tr.p; y += num(tr.a, 'y', 0) + (num(tr.b, 'y', 0) - num(tr.a, 'y', 0)) * tr.p; }
        const sc = tl.scale && interval(tl.scale, time);
        if (sc) { scaleX *= num(sc.a, 'x', 1) + (num(sc.b, 'x', 1) - num(sc.a, 'x', 1)) * sc.p; scaleY *= num(sc.a, 'y', 1) + (num(sc.b, 'y', 1) - num(sc.a, 'y', 1)) * sc.p; }
        world.set(bone.name, mul(bone.parent ? world.get(bone.parent)! : root, local(x, y, rotation, scaleX, scaleY)));
    }
    return data.slots.map(slot => {
        const tl = data.animation.slots?.[slot.name] ?? {};
        let attachment = slot.attachment, color = hexColor(slot.color);
        if (tl.attachment?.length && time >= tl.attachment[0].time) {
            let i = 0;
            while (i + 1 < tl.attachment.length && tl.attachment[i + 1].time <= time) i++;
            attachment = (tl.attachment[i].name as string | null) ?? null;
        }
        const col = tl.color && interval(tl.color, time);
        if (col) { const a = hexColor(col.a.color as string), b = hexColor(col.b.color as string); color = a.map((v, i) => v + (b[i] - v) * col.p) as typeof color; }
        const region = attachment ? data.attachments[slot.name]?.[attachment] : undefined;
        const m = region ? mul(world.get(slot.bone)!, local(region.x, region.y, region.rotation, region.scaleX, region.scaleY)) : world.get(slot.bone)!;
        return { slot: slot.name, attachment: region ? attachment : null, asset: region?.asset ?? null, width: region?.width ?? 0, height: region?.height ?? 0, color, ...decompose(m) };
    });
}

export interface BuildFxTuning {
    /** Longest side of each tool as a fraction of the building width. */
    readonly toolFraction: number;
    /** Horizontal swing positions of the tools multiplied by this, so the enlarged hammer and saw stay apart. */
    readonly toolSpread: number;
    /** Smoke puff size and drift multiplier. */
    readonly smokeScale: number;
}

const scaleMoves = (frames: Frame[] | undefined, kx: number, ky: number): void => {
    for (const f of frames ?? []) { if (typeof f.x === 'number') f.x *= kx; if (typeof f.y === 'number') f.y *= ky; }
};
const TOOLS = ['hammer', 'saw'];
/** Setup x of a bone chain plus its first animated translate (the effect's parent bones are unrotated, unscaled). */
function parentX(sk: SkeletonData, name: string | null): number {
    let x = 0;
    for (let b = sk.bones.find(o => o.name === name); b; b = sk.bones.find(o => o.name === b!.parent)) {
        const first = sk.animation.bones?.[b.name]?.translate?.[0];
        x += b.x + (typeof first?.x === 'number' ? first.x : 0);
    }
    return x;
}

/**
 * Copy of the build skeleton resized for one building: the hammer and saw are enlarged
 * independently to toolFraction × buildingWidth (their swing radius, the attachment offset
 * from the bone, grows with them), their swing positions are pushed apart horizontally and
 * the smoke is scaled. nodeScale is the scale of the node the skeleton is drawn on, clamped
 * from buildingWidth / referenceWidth; the spread follows the unclamped ratio so wide
 * buildings keep the tools as far apart as their size needs. Timing is unchanged.
 */
export function tuneBuildSkeleton(data: SkeletonData, buildingWidth: number, nodeScale: number, tuning: BuildFxTuning, referenceWidth = 420): SkeletonData {
    const sk: SkeletonData = JSON.parse(JSON.stringify(data));
    const bones = sk.animation.bones ?? {}, spread = tuning.toolSpread * buildingWidth / (nodeScale * referenceWidth);
    for (const slot of sk.slots) {
        const tool = TOOLS.includes(slot.name), smoke = slot.name.startsWith('smoke');
        if (!tool && !smoke) continue;
        const bone = sk.bones.find(b => b.name === slot.bone)!;
        for (const a of Object.values(sk.attachments[slot.name] ?? {})) {
            const k = tool ? tuning.toolFraction * buildingWidth / (Math.max(a.width, a.height) * Math.abs(sk.scale[0]) * nodeScale) : tuning.smokeScale;
            a.x *= k; a.y *= k; a.width *= k; a.height *= k;
        }
        const [kx, ky] = tool ? [spread, 1] : [tuning.smokeScale, tuning.smokeScale];
        bone.x *= kx; bone.y *= ky;
        scaleMoves(bones[bone.name]?.translate, kx, ky);
        // Spread about the effect centre (node origin), not about the parent bone, which sits off-centre:
        // x_node = offset + scale·(parentX + x)  →  shift x so that x_node becomes spread·x_node.
        if (tool) bone.x += (spread - 1) * (sk.offset[0] / sk.scale[0] + parentX(sk, bone.parent));
    }
    return sk;
}

/** Box the visible hammer and saw sweep over the whole animation, in the skeleton node's space. */
export function toolExtent(data: SkeletonData, step = 1 / 30): { left: number; right: number; bottom: number; top: number } {
    const box = { left: Infinity, right: -Infinity, bottom: Infinity, top: -Infinity };
    const end = skeletonLength(data) / data.timeScale;
    for (let t = 0; t <= end + 1e-9; t += step) {
        for (const p of sampleSkeleton(data, t)) {
            if (!TOOLS.includes(p.slot) || !p.asset || p.color[3] < 0.01) continue;
            const r = p.angle * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
            for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
                const x = u * p.width / 2 * p.scaleX, y = v * p.height / 2 * p.scaleY, px = p.x + x * c - y * s, py = p.y + x * s + y * c;
                box.left = Math.min(box.left, px); box.right = Math.max(box.right, px); box.bottom = Math.min(box.bottom, py); box.top = Math.max(box.top, py);
            }
        }
    }
    return box;
}

/** Shift (dx, dy) that moves a box inside a frame; centred when it is larger than the frame. */
export function fitInside(box: { left: number; right: number; bottom: number; top: number }, frame: { left: number; right: number; bottom: number; top: number }): { dx: number; dy: number } {
    const axis = (lo: number, hi: number, flo: number, fhi: number) => hi - lo > fhi - flo ? (flo + fhi) / 2 - (lo + hi) / 2 : lo < flo ? flo - lo : hi > fhi ? fhi - hi : 0;
    return { dx: axis(box.left, box.right, frame.left, frame.right), dy: axis(box.bottom, box.top, frame.bottom, frame.top) };
}
