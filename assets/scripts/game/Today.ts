import { acceptDay, dayKey, weekKey } from './domain/Clock';
import { services } from './Services';

/** Business day for commands: device local date, never earlier than the last accepted day (F022). */
export function today(): string {
    return acceptDay(services.save.data.clock.lastDay, dayKey(new Date()));
}

export function thisWeek(): string {
    return weekKey(new Date());
}

/** Records the accepted day once per launch so a clock moved backwards keeps the later day. */
export function acceptToday(): void {
    const day = today();
    if (day !== services.save.data.clock.lastDay) services.save.transact(draft => { draft.clock.lastDay = day; });
}
