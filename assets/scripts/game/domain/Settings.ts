/** Player settings (F047) and tutorial progress (F048/F049). */
export interface SettingsState {
    music: boolean;
    sfx: boolean;
    vibrate: boolean;
    reduceMotion: boolean;
    largeText: boolean;
}

export function newSettingsState(): SettingsState {
    return { music: true, sfx: true, vibrate: true, reduceMotion: false, largeText: false };
}

export interface GuideState {
    /** Completed guide step ids. */
    done: string[];
}

export function newGuideState(): GuideState {
    return { done: [] };
}
