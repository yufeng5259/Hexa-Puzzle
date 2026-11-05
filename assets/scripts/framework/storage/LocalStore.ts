import { sys } from 'cc';

/** BigHero PlatformStorage reduced to JSON get/set on sys.localStorage (wx storage on WeChat). */
export const LocalStore = {
    read<T>(key: string): T | null {
        const raw = sys.localStorage.getItem(key);
        return raw === null || raw === '' ? null : JSON.parse(raw) as T;
    },
    write(key: string, value: unknown): void {
        sys.localStorage.setItem(key, JSON.stringify(value));
    },
    remove(key: string): void {
        sys.localStorage.removeItem(key);
    },
};
