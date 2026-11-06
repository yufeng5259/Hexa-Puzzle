import { DEBUG } from 'cc/env';

/** Development-build log with a tag; compiled out of release builds. */
export function debugLog(tag: string, ...args: unknown[]): void {
    if (DEBUG) console.log(`[${tag}]`, ...args);
}
