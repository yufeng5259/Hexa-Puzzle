/** Pure guide-hand motion (no 'cc'), so its timing and re-targeting are testable in node. */
export interface Point { readonly x: number; readonly y: number }
export interface DragMotion { sourceHold: number; pressDuration: number; dragDuration: number; destinationHold: number; fadeDuration: number; loopDelay: number }
export const DEFAULT_DRAG: DragMotion = { sourceHold: 0.25, pressDuration: 0.15, dragDuration: 0.9, destinationHold: 0.2, fadeDuration: 0.2, loopDelay: 0.25 };
const TAP = { down: 0.35, press: 0.18, up: 0.35, rest: 0.2, nudge: 10 };

export interface HandPose { readonly visible: boolean; readonly at: Point; readonly pressed: boolean; readonly opacity: number }
const HIDDEN: HandPose = { visible: false, at: { x: 0, y: 0 }, pressed: false, opacity: 0 };

/**
 * One looping hand gesture. The end points are read again at the start of every
 * loop, so a tray that re-flowed or a page that re-laid out is followed on the
 * next pass; while either point is unavailable (null) the hand stays hidden.
 */
export class HandLoop {
    private time = 0;
    private from: Point | null = null;
    private to: Point | null = null;
    private readonly motion: DragMotion;

    /** to = null: tap in place at from. */
    public constructor(private readonly source: () => Point | null, private readonly target: (() => Point | null) | null, motion: Partial<DragMotion> = {}) {
        this.motion = { ...DEFAULT_DRAG, ...motion };
    }
    private get length(): number {
        const m = this.motion;
        return this.target ? m.sourceHold + m.pressDuration + m.dragDuration + m.destinationHold + m.fadeDuration + m.loopDelay : TAP.down + TAP.press + TAP.up + TAP.rest;
    }
    /** Restarts from the first frame on the next step (e.g. after a pause). */
    public restart(): void { this.time = 0; this.from = null; }

    public step(dt: number): HandPose {
        if (this.from === null || this.time >= this.length) {
            // New loop: re-read both points; wait (hidden) until they exist.
            this.time = 0;
            this.from = this.source();
            this.to = this.target ? this.target() : null;
            if (!this.from || (this.target && !this.to)) { this.from = null; return HIDDEN; }
        } else this.time += dt;
        return this.target ? this.drag(this.time, this.from, this.to!) : this.tap(this.time, this.from);
    }

    private drag(t: number, a: Point, b: Point): HandPose {
        const m = this.motion;
        if (t < m.sourceHold) return { visible: true, at: a, pressed: false, opacity: 255 };
        t -= m.sourceHold;
        if (t < m.pressDuration) return { visible: true, at: a, pressed: true, opacity: 255 };
        t -= m.pressDuration;
        if (t < m.dragDuration) {
            const k = (1 - Math.cos(Math.PI * t / m.dragDuration)) / 2; // sine in-out
            return { visible: true, at: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, pressed: true, opacity: 255 };
        }
        t -= m.dragDuration;
        if (t < m.destinationHold) return { visible: true, at: b, pressed: false, opacity: 255 };
        t -= m.destinationHold;
        if (t < m.fadeDuration) return { visible: true, at: b, pressed: false, opacity: Math.round(255 * (1 - t / m.fadeDuration)) };
        return { ...HIDDEN, at: b };
    }
    private tap(t: number, a: Point): HandPose {
        const down = { x: a.x + TAP.nudge, y: a.y - TAP.nudge };
        if (t < TAP.down) { const k = t / TAP.down; return { visible: true, at: { x: a.x + TAP.nudge * k, y: a.y - TAP.nudge * k }, pressed: false, opacity: 255 }; }
        t -= TAP.down;
        if (t < TAP.press) return { visible: true, at: down, pressed: true, opacity: 255 };
        t -= TAP.press;
        if (t < TAP.up) { const k = t / TAP.up; return { visible: true, at: { x: down.x - TAP.nudge * k, y: down.y + TAP.nudge * k }, pressed: false, opacity: 255 }; }
        return { visible: true, at: a, pressed: false, opacity: 255 };
    }
}

/** Fade helper for the dim layer: moves current toward target at rate per second. */
export function approach(current: number, target: number, rate: number, dt: number): number {
    const d = target - current, max = rate * dt;
    return Math.abs(d) <= max ? target : current + Math.sign(d) * max;
}
