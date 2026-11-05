/** Copied from BigHero core/random/SeededRandom (sequence rules unchanged; compatibility sampler removed). */
export class SeededRandom {
    constructor(public seed = 0) {}

    next(): number {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    integer(minimum: number, maximum?: number): number {
        return Math.round(this.decimal(minimum, maximum));
    }

    decimal(minimum: number, maximum?: number): number {
        const lower = maximum === undefined ? 0 : minimum;
        const upper = maximum === undefined ? minimum : maximum;
        return lower + this.next() * (upper - lower);
    }

    /** Index in [0, size). */
    range(size: number): number {
        return Math.floor(this.next() * size);
    }

    /** Weighted pick; weights must be positive. */
    weighted<T>(items: readonly T[], weight: (item: T) => number): T {
        const total = items.reduce((sum, item) => sum + weight(item), 0);
        let roll = this.next() * total;
        for (const item of items) {
            roll -= weight(item);
            if (roll < 0) return item;
        }
        return items[items.length - 1];
    }
}
