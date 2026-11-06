import { acceptDay, dayKey, weekKey } from './domain/Clock';
import { startDay } from './domain/Daily';
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
    // Also counts the login day for sign-in and locks today's task variants (F043/F041).
    services.save.transact(draft => {
        draft.clock.lastDay = day;
        startDay(draft, day);
    });
}
