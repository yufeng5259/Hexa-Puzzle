/** Business clock (F022): local calendar day, weeks start on Monday. */
export function dayKey(date: Date): string {
    const m = date.getMonth() + 1, d = date.getDate();
    return `${date.getFullYear()}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`;
}

export function weekKey(date: Date): string {
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return dayKey(monday);
}

/** Never moves backwards: a clock set into the past keeps the last accepted day. */
export function acceptDay(lastDay: string, today: string): string {
    return today > lastDay ? today : lastDay;
}
