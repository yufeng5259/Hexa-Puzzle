import { isValid } from 'cc';

export function requireBinding<T>(owner: string, field: string, value: T | null | undefined): T {
    if (value === null || value === undefined || !isValid(value, true)) {
        throw new Error(`${owner}: missing or destroyed Inspector binding '${field}'`);
    }
    return value;
}
