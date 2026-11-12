/**
 * Device-local calendar. Day ids are YYYY-MM-DD and week ids are the date of
 * that week's Monday, so plain string comparison orders them.
 */
export interface Clock {
    now(): number;
    /** Minutes to add to UTC to get local time (UTC+8 => 480). */
    offsetMinutes(): number;
}

export const systemClock: Clock = {
    now: () => Date.now(),
    offsetMinutes: () => -new Date().getTimezoneOffset(),
};

function localDate(time: number, offsetMinutes: number): Date { return new Date(time + offsetMinutes * 60000); }
function format(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function dayId(time: number, offsetMinutes: number): string { return format(localDate(time, offsetMinutes)); }

export function weekId(time: number, offsetMinutes: number): string {
    const date = localDate(time, offsetMinutes);
    const sinceMonday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - sinceMonday);
    return format(date);
}

/** Milliseconds until the next local midnight / next local Monday 0:00. */
export function msUntilNextDay(time: number, offsetMinutes: number): number {
    const local = time + offsetMinutes * 60000;
    return 86400000 - (((local % 86400000) + 86400000) % 86400000);
}

export function msUntilNextWeek(time: number, offsetMinutes: number): number {
    const sinceMonday = (localDate(time, offsetMinutes).getUTCDay() + 6) % 7;
    return msUntilNextDay(time, offsetMinutes) + (6 - sinceMonday) * 86400000;
}
